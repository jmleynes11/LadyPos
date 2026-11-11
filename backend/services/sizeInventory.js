import Product from "../models/Product.js";
import { StockMovement } from "../models/BookstoreControl.js";
import { CLOTHING_SIZES, supportsSizes, validSizeStocks, sizeStockTotal } from "../utils/clothingSizes.js";
import { fail } from "./accountManagement.js";

// Keep the existing one-movement-per-product/operation ledger, including when
// several sizes of the same garment are purchased or returned together.
export function planProductStock(product, changes, { source }) {
  const before = product.stock, delta = changes.reduce((sum, change) => sum + change.delta, 0), after = before + delta;
  if (!Number.isSafeInteger(before) || before < 0 || !Number.isSafeInteger(after) || after < 0) fail(409, "Invalid stock result; no clamping is allowed");
  const sized = supportsSizes(product), sizeChanges = [], sizeStocks = { ...product.sizeStocks };
  if (sized && (!validSizeStocks(sizeStocks) || sizeStockTotal(sizeStocks) !== before)) fail(409, "Configure clothing size quantities before changing stock");
  for (const change of changes) {
    if (!Number.isSafeInteger(change.delta) || !change.delta) fail(400, "Nonzero integer delta required");
    if (sized) {
      if (!Object.hasOwn(sizeStocks, change.size)) {
        // Only the reversal service supplies returns, after matching the exact
        // product/size against the immutable sold line. Reintroduce that size.
        if (source !== "return" || change.delta <= 0 || !CLOTHING_SIZES.includes(change.size)) fail(400, "Select an available clothing size");
        sizeStocks[change.size] = 0;
      }
      const previous = sizeStocks[change.size], next = previous + change.delta;
      if (!Number.isSafeInteger(next) || next < 0) fail(409, "Selected size has insufficient stock");
      sizeStocks[change.size] = next;
      sizeChanges.push({ size: change.size, before: previous, after: next, delta: change.delta });
    } else if (change.size !== undefined) fail(400, "Sizes apply only to Clothing products");
  }
  return { before, after, delta, sized, sizeStocks, sizeChanges };
}

export async function changeProductStock(product, changes, context) {
  const { session, scope, actorId, operationId, reason, source, transactionId } = context;
  const { before, after, delta, sized, sizeStocks, sizeChanges } = planProductStock(product, changes, context);
  const result = await Product.updateOne({ _id: product._id, ...scope, stock: before,
    ...(sized ? { sizeStocks: product.sizeStocks } : {}) },
  { $inc: { stock: delta }, ...(sized ? { $set: { sizeStocks } } : {}) }, { session });
  if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) fail(409, "Stock changed; reconcile before retrying");
  await StockMovement.create([{ storeId: scope.storeId, productId: product._id, actorId, operationId,
    before, after, delta, reason, source, occurredAt: new Date(), ...(transactionId ? { transactionId } : {}),
    ...(sized ? { sizeChanges } : {}) }], { session });
  product.stock = after;
  if (sized) product.sizeStocks = sizeStocks;
  return { before, after, ...(sized ? { sizeStocks, sizeChanges } : {}) };
}
