import { createHmac, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Store from "../models/Store.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { GuestOrderIntent, BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { accountTransaction } from "../utils/accountTransaction.js";
import { lockAccountRealm, accountId, fail } from "./accountManagement.js";
import { issueGuestOrderCredential, verifyGuestOrderCredential } from "../auth/guestOrderAccess.js";
import { exactFields, pricedItems, makePendingOrder } from "./bookstoreOrders.js";
import { clothingAvailable, sizeOptions } from "../utils/clothingSizes.js";
import { withOrderReferenceRetry } from "../utils/orderReference.js";

async function publicStore(storeId, session) {
  const store = await Store.findById(accountId(storeId), null, session ? { session } : {});
  if (!store || !store.createdBy || !store.orderCustomer || !await User.findById(store.createdBy, null, session ? { session } : {})) fail(503, "Guest ordering requires verified bookstore setup");
  return store;
}
async function guestIntent(storeId, intentId, credential, session) {
  const intent = await GuestOrderIntent.findOne({ _id: accountId(intentId), storeId: accountId(storeId) }).select("+verification").session(session || null);
  if (!intent || !verifyGuestOrderCredential(intent._id, credential, intent.verification)) fail(403, "Private guest proof required");
  return intent;
}
export async function guestCatalog(storeId) {
  const store = await publicStore(storeId);
  const products = await Product.find({ storeId: store._id, isActive: true, moneyUnit: "PHP-centavos" }).sort({ name: 1 });
  return { name: store.name, products: products.map(product => ({ productId: String(product._id), name: product.name, sku: product.sku, category: product.category, ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}), ...sizeOptions(product), price: product.price, moneyUnit: "PHP-centavos", availability: clothingAvailable(product) })) };
}
export async function issueGuestIntent(storeId) {
  return accountTransaction(async session => {
    await lockAccountRealm(session);
    const store = await publicStore(storeId, session), intentId = new mongoose.Types.ObjectId();
    const { credential, verification } = issueGuestOrderCredential(intentId);
    await GuestOrderIntent.create([{ _id: intentId, storeId: store._id, verification }], { session });
    await BookstoreAudit.create([{ actorKey: `guest:${intentId}`, actorKind: "guest", operationId: randomUUID(), sequence: 0,
      storeId: store._id, action: "guest.intent_issued", targetKind: "GuestIntent", targetId: intentId, occurredAt: new Date(), reason: "Guest order proof issuance",
      before: { absent: true }, after: { expiresAt: verification.expiresAt.toISOString() } }], { session });
    return { intentId: String(intentId), credential, expiresAt: verification.expiresAt.toISOString() };
  });
}
export async function submitGuestOrder(storeId, credential, body) {
  exactFields(body, ["intentId", "operationId", "items"]);
  if (typeof body.operationId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.operationId)) fail(400, "Stable operation ID required");
  if (!process.env.JWT_SECRET) fail(503, "Guest ordering unavailable");
  return withOrderReferenceRetry(() => accountTransaction(async session => {
    await lockAccountRealm(session);
    const store = await publicStore(storeId, session), intent = await guestIntent(storeId, body.intentId, credential, session);
    const actorKey = `guest:${intent._id}`;
    const fingerprint = createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify({ storeId: String(store._id), body })).digest("hex");
    const receipt = await BookstoreReceipt.findOne({ actorKey, operationId: body.operationId }).select("+fingerprint").session(session);
    if (receipt) { if (receipt.fingerprint !== fingerprint) fail(409, "Operation ID conflict"); return receipt.result; }
    if (await Order.findById(intent._id, null, { session })) fail(409, "Guest order already submitted; track the existing order");
    const { items, total } = await pricedItems(body.items, { storeId: store._id }, session);
    const order = await makePendingOrder({ owner: store.createdBy, store, origin: "guest", items, total, orderId: intent._id, session });
    const result = { orderId: String(order._id), reference: order.bookstoreReference, orderStatus: "pending", operationId: body.operationId };
    await BookstoreAudit.create([{ actorKey, actorKind: "guest", operationId: body.operationId, sequence: 0, storeId: store._id,
      action: "order.submitted", targetKind: "Transaction", targetId: order._id, occurredAt: new Date(), reason: "Guest kiosk submission",
      before: { absent: true }, after: { reference: order.bookstoreReference, orderStatus: "pending" } }], { session });
    await BookstoreReceipt.create([{ actorKey, operationId: body.operationId, storeId: store._id, capability: "order.submit", fingerprint, result }], { session });
    return result;
  }));
}
export async function trackGuestOrder(storeId, intentId, credential) {
  const intent = await guestIntent(storeId, intentId, credential);
  const order = await Order.findOne({ _id: intent._id, storeId: intent.storeId, origin: "guest", moneyUnit: "PHP-centavos" });
  if (!order) fail(404, "Order not found");
  return { reference: order.bookstoreReference, orderStatus: order.reversalId ? "reversed" : order.orderStatus };
}
