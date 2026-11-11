// Lost-response recovery uses only staged synthetic records.
// Uses the existing in-memory adapter. Never opens a database connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import Customer from '../models/Person.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import * as controls from '../models/BookstoreControl.js';
import { accountAdapter } from '../tests/accountManagementAdapter.js';
import { createBookstoreProduct, updateBookstoreProduct } from '../services/catalogService.js';
import { submitAuthenticatedOrder, quoteOrder, completeOrder, requestReversal, applyReversal } from '../services/bookstoreOrders.js';
import { manageCategory } from '../services/categoryService.js';
import { pendingQueue, reconcileBookstoreOperation, transactionHistory } from '../services/bookstoreReads.js';

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

test('lost direct-checkout commit response reconciles the persisted result, retries once and completes the existing checkout', async t => {
  const f = fixture(t), { productId } = await f.create();
  const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: productId, quantity: 1, size: 'M' }] };
  f.faults.afterCommit = Error('Synthetic lost commit response');
  await assert.rejects(submitAuthenticatedOrder(f.actor(2), body), e => e.name === 'AccountMutationIndeterminateError');
  delete f.faults.afterCommit;
  assert.equal(f.rows(Order).length, 1);
  const receipt = f.rows(controls.BookstoreReceipt).find(row => row.operationId === body.operationId);
  const effects = f.stats.effects, commits = f.stats.commits;
  const recovered = await reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId);
  assert.equal(recovered.outcome, 'applied'); assert.equal(recovered.operationId, body.operationId);
  assert.equal(recovered.orderId, String(f.rows(Order)[0]._id)); assert.deepEqual(recovered.result, receipt.result);
  assert.equal(recovered.result.orderStatus, 'pending'); assert.equal(recovered.result.payment.orderId, recovered.orderId);
  assert.equal(recovered.result.items[0].size, 'M'); assert.equal(recovered.result.total, 10000);
  assert.deepEqual(await reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId), recovered);
  assert.equal(f.stats.effects, effects); assert.equal(f.stats.commits, commits);
  assert.deepEqual((await pendingQueue(f.actor(2), f.storeId)).orders, []);
  assert.deepEqual((await transactionHistory(f.actor(2), f.storeId)).transactions, []);
  assert.deepEqual(await submitAuthenticatedOrder(f.actor(2), body), receipt.result);
  assert.equal(f.rows(Order).length, 1);
  await assert.rejects(submitAuthenticatedOrder(f.actor(2), { ...body, items: [{ product: productId, size: 'S', quantity: 1 }] }), e => e.statusCode === 409);
  const paid = await f.settle(recovered.orderId);
  assert.equal(paid.orderId, recovered.orderId); assert.equal(paid.orderStatus, 'completed');
  assert.equal(f.rows(Order).length, 1); assert.equal(f.rows(controls.BookstorePayment).length, 1);
});

test('recovery returns the original persisted snapshot even when catalog prices subsequently change', async t => {
  const f = fixture(t), { productId } = await f.create();
  const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: productId, quantity: 1, size: 'M' }] };
  const submitted = await submitAuthenticatedOrder(f.actor(2), body);
  f.store.get(Product.modelName).get(productId).price = 15000;
  const recovered = await reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId);
  assert.deepEqual(recovered.result, submitted); assert.equal(recovered.result.total, 10000);
  const current = await quoteOrder(f.actor(2), recovered.orderId, f.storeId);
  assert.equal(current.total, 15000); assert.equal(current.pricesChanged, true);
  assert.equal(f.rows(Order).length, 1);
});

test('reconciliation authenticates current account and enforces operation ownership, membership and checkout assignment', async t => {
  const f = fixture(t), { productId } = await f.create();
  const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: productId, quantity: 1, size: 'M' }] };
  const submitted = await submitAuthenticatedOrder(f.actor(2), body);
  const otherId = id(), original = f.store.get(User.modelName).get(f.actor(2).id);
  f.store.get(User.modelName).set(String(otherId), { ...original, _id: otherId, identifier: 'other-cashier' });
  const other = { ...f.actor(2), id: String(otherId) };
  await assert.rejects(reconcileBookstoreOperation(other, f.storeId, body.operationId), e => e.statusCode === 404);
  await assert.rejects(reconcileBookstoreOperation({ ...f.actor(2), tokenVersion: 1 }, f.storeId, body.operationId), e => e.statusCode === 401);
  await assert.rejects(reconcileBookstoreOperation(f.actor(2), id(), body.operationId), e => e.statusCode === 404);
  original.storeIds = [];
  await assert.rejects(reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId), e => e.statusCode === 403);
  original.storeIds = [f.storeId];
  f.store.get(Order.modelName).get(submitted.orderId).assignedTo = otherId;
  await assert.rejects(reconcileBookstoreOperation(f.actor(2), f.storeId, body.operationId), e => e.statusCode === 404);
  assert.equal(f.rows(Order).length, 1);
});

test('normal direct and customer submissions retain their separate results and idempotency', async t => {
  const f = fixture(t), { productId } = await f.create();
  for (const index of [2, 3]) {
    const body = { storeId: String(f.storeId), operationId: randomUUID(), items: [{ product: productId, quantity: 1, size: 'M' }] };
    const result = await submitAuthenticatedOrder(f.actor(index), body);
    assert.deepEqual(await submitAuthenticatedOrder(f.actor(index), body), result);
    assert.equal(Boolean(result.payment), index === 2);
    assert.equal(result.orderStatus, 'pending');
  }
  assert.equal(f.rows(Order).length, 2);
  assert.equal((await pendingQueue(f.actor(2), f.storeId)).orders.length, 1);
});

