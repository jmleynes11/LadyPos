// These tests assert the observed bugs, so passing confirms reproduction.
// Uses the existing in-memory adapter. Never opens a database connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from '../../backend/node_modules/mongoose/index.js';
import Product from '../../backend/models/Product.js';
import Store from '../../backend/models/Store.js';
import Customer from '../../backend/models/Person.js';
import Order from '../../backend/models/Order.js';
import Invoice from '../../backend/models/Invoice.js';
import * as controls from '../../backend/models/BookstoreControl.js';
import { accountAdapter } from '../../backend/tests/accountManagementAdapter.js';
import { createBookstoreProduct, updateBookstoreProduct } from '../../backend/services/catalogService.js';
import { submitAuthenticatedOrder, quoteOrder, completeOrder, requestReversal, applyReversal } from '../../backend/services/bookstoreOrders.js';
import { manageCategory } from '../../backend/services/categoryService.js';
import { pendingQueue, reconcileBookstoreOperation, transactionHistory } from '../../backend/services/bookstoreReads.js';

process.env.JWT_SECRET = 'synthetic-audit-reproduction-only';
const id = () => new mongoose.Types.ObjectId();
function fixture(t) {
  const storeId = id(), customerId = id();
  const accounts = ['admin', 'store_manager', 'cashier', 'customer'].map(role => ({ _id: id(), identifier: role, role,
    confirmed: true, accountState: 'active', tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }));
  const f = accountAdapter(t, accounts, { extraModels: [Store, Customer, Invoice, ...Object.values(controls).filter(value => value?.modelName)],
    cloneValue: value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value)) });
  f.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: 'Synthetic audit', createdBy: accounts[0]._id, orderCustomer: customerId });
  f.store.get(Customer.modelName).set(String(customerId), { _id: customerId, owner: accounts[0]._id, storeId, name: 'Orders', isDeleted: false });
  const actor = index => ({ id: String(accounts[index]._id), role: accounts[index].role, tokenVersion: 0 });
  const body = extra => ({ storeId: String(storeId), operationId: randomUUID(), reason: 'Synthetic audit reproduction', ...extra });
  const create = (extra = {}) => createBookstoreProduct(actor(1), body({ name: 'Uniform', category: 'Clothing', price: 10000, sizeStocks: { S: 2, M: 1 }, ...extra }));
  const submit = items => submitAuthenticatedOrder(actor(2), { storeId: String(storeId), operationId: randomUUID(), items });
  const settle = async orderId => {
    const quote = await quoteOrder(actor(2), orderId, storeId);
    return completeOrder(actor(2), orderId, body({ quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: true, paymentMethod: 'cash' }));
  };
  t.after(() => assert.equal(mongoose.connection.readyState, 0));
  return { ...f, storeId, actor, body, create, submit, settle };
}

test('BUG: reconciliation confirms a cashier submission but cannot recover its hidden pending order', async t => {
  const f = fixture(t), { productId } = await f.create();
  const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: productId, quantity: 1, size: 'M' }] };
  const resultLostInTransit = await submitAuthenticatedOrder(f.actor(2), body);
  const recovered = await reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId);
  assert.deepEqual(recovered, { outcome: 'applied', operationId: body.operationId });
  assert.equal(recovered.orderId, undefined);
  assert.equal(recovered.result, undefined);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders, []);
  assert.deepEqual((await transactionHistory(f.actor(2), f.storeId)).transactions, []);
  assert.equal(f.rows(Order)[0].orderStatus, 'pending');
  assert.equal(f.rows(Order)[0].directPayment, true);
  // A replacement submission is a different operation and creates another order.
  await submitAuthenticatedOrder(f.actor(2), { ...body, operationId: randomUUID() });
  assert.equal(f.rows(Order).length, 2);
  assert.notEqual(f.rows(Order)[1]._id.toString(), resultLostInTransit.orderId);
});

test('BUG: renaming Clothing after submission makes the pending order impossible to quote', async t => {
  const f = fixture(t), { productId } = await f.create();
  const order = await f.submit([{ product: productId, quantity: 1, size: 'M' }]);
  await manageCategory(f.actor(1), f.body({ action: 'rename', name: 'Clothing', newName: 'Uniforms' }));
  await assert.rejects(quoteOrder(f.actor(2), order.orderId, f.storeId), error => error.statusCode === 400 && error.message === 'Sizes apply only to Clothing products');
});

test('BUG: renaming Clothing after a sale prevents a saleable return from being recorded', async t => {
  const f = fixture(t), { productId } = await f.create();
  const order = await f.submit([{ product: productId, quantity: 1, size: 'M' }]);
  await f.settle(order.orderId);
  await manageCategory(f.actor(1), f.body({ action: 'rename', name: 'Clothing', newName: 'Uniforms' }));
  const request = await requestReversal(f.actor(2), order.orderId, f.body());
  await assert.rejects(applyReversal(f.actor(1), request.requestId, f.body({ repaymentConfirmed: true, repaymentMethod: 'cash',
    returnsConfirmed: true, returned: [{ productId, quantity: 1, size: 'M' }] })), error => error.statusCode === 400 && error.message === 'Sizes apply only to Clothing products');
  assert.equal(f.rows(controls.SaleReversal).length, 0);
});

test('BUG: removing a sold-out size prevents returns of the previously sold size', async t => {
  const f = fixture(t), { productId } = await f.create();
  const order = await f.submit([{ product: productId, quantity: 1, size: 'M' }]);
  await f.settle(order.orderId);
  await updateBookstoreProduct(f.actor(1), productId, f.body({ sizeStocks: { S: 2 } }));
  const request = await requestReversal(f.actor(2), order.orderId, f.body());
  await assert.rejects(applyReversal(f.actor(1), request.requestId, f.body({ repaymentConfirmed: true, repaymentMethod: 'cash',
    returnsConfirmed: true, returned: [{ productId, quantity: 1, size: 'M' }] })), error => error.statusCode === 400 && error.message === 'Select an available clothing size');
  assert.equal(f.rows(controls.SaleReversal).length, 0);
});
