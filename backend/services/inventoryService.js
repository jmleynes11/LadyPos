import Product from "../models/Product.js";
import { changeProductStock } from "./sizeInventory.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { accountId, fail } from "./accountManagement.js";

export async function adjustBookstoreStock(actor, productId, input) {
  const target = accountId(productId);
  if (!input || Object.keys(input).some(key => !["storeId", "operationId", "reason", "delta", "size"].includes(key))) fail(400, "Unsupported inventory field");
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) fail(400, "Nonzero integer delta required");
  return bookstoreCommand(actor, input.storeId, "inventory.adjust", { ...input, productId: target }, async ({ session, scope, actorId, operationId, reason, audit }) => {
    const product = await Product.findOne({ _id: target, ...scope }).session(session);
    if (!product) fail(404, "Product not found");
    const { before, after, sizeStocks } = await changeProductStock(product, [{ size: input.size, delta: input.delta }],
      { session, scope, actorId, operationId, reason, source: "adjustment" });
    await audit("inventory.adjusted", "Product", target, { stock: before }, { stock: after, delta: input.delta });
    return { productId: target, stock: after, ...(sizeStocks ? { sizeStocks } : {}) };
  });
}
