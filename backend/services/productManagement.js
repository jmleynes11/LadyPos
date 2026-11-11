import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { StockMovement, SaleReversal, BookstoreReceipt } from "../models/BookstoreControl.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { accountId, fail } from "./accountManagement.js";

const requireManager = actor => { if (actor?.role !== "store_manager") fail(403, "Product management requires Store Manager access"); };
const literalPattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Opt-in listing for Manage Products. Existing catalog consumers keep their
// existing defaults, response fields, filters and role restrictions.
export async function managedProducts(actor, scope, query) {
  requireManager(actor);
  if (!scope?.storeId) fail(403, "Explicit bookstore scope required");
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? 10);
  if (!Number.isSafeInteger(page) || page < 1 || ![10, 20, 50, 100].includes(limit)) fail(400, "Invalid product pagination");
  const filter = { ...scope };
  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 150) fail(400, "Invalid product search");
    const search = literalPattern(query.search.trim());
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { sku: { $regex: search, $options: "i" } }];
  }
  if (query.category !== undefined && query.category !== "") {
    if (typeof query.category !== "string" || query.category.length > 100) fail(400, "Invalid product category");
    filter.category = query.category;
  }
  if (query.isActive !== undefined && query.isActive !== "") {
    if (!["true", "false"].includes(query.isActive)) fail(400, "Invalid product availability");
    filter.isActive = query.isActive === "true";
  }
  const sortBy = query.sortBy ?? "name", direction = query.sortDirection ?? "asc";
  if (!["name", "price", "category"].includes(sortBy) || !["asc", "desc"].includes(direction)) fail(400, "Invalid product sort");
  const total = await Product.countDocuments(filter), pages = Math.ceil(total / limit);
  const current = Math.min(page, Math.max(1, pages));
  const products = await Product.find(filter).sort({ [sortBy]: direction === "asc" ? 1 : -1, _id: 1 }).skip((current - 1) * limit).limit(limit);
  return { products, pagination: { page: current, limit, total, pages } };
}

// Check globally by product identity: historical/unmapped references must also
// prevent deletion. No order, invoice, return or inventory record is mutated.
export async function productDeletionStatus(product, session = null) {
  if (product.moneyUnit !== "PHP-centavos") return { canDelete: false, canArchive: false, reason: "Historical product units require reviewed attribution before deletion or archival." };
  const id = product._id, identities = [id, String(id)];
  const checks = [
    [Order, { $or: [{ "items.product": { $in: identities } }, { "products.product": { $in: identities } }] }],
    [Invoice, { $or: [{ "snapshot.items.productId": { $in: identities } }, { "snapshot.items.product": { $in: identities } }] }],
    [StockMovement, { productId: id }],
    [SaleReversal, { "returned.productId": { $in: identities } }],
    [BookstoreReceipt, { $or: ["result.items.productId", "result.receipt.items.productId", "result.payment.items.productId"].map(path => ({ [path]: { $in: identities } })) }],
  ];
  for (const [Model, filter] of checks) {
    if (await Model.findOne(filter).select("_id").session(session)) return { canDelete: false, reason: "This product has order, transaction, receipt or inventory history. Archive it to preserve historical records." };
  }
  if (product.stock !== 0 || Object.values(product.sizeStocks || {}).some(value => value !== 0)) {
    return { canDelete: false, reason: "Products with remaining stock must be archived instead." };
  }
  return { canDelete: true, reason: "No transaction or inventory references were found." };
}

export async function managedProductDeletionStatus(actor, product) {
  requireManager(actor);
  return productDeletionStatus(product);
}

export async function deleteManagedProduct(actor, productId, body) {
  requireManager(actor);
  if (!body || body.deletionMode !== "permanent" || Object.keys(body).some(key => !["storeId", "operationId", "reason", "deletionMode"].includes(key))) fail(400, "Explicit permanent product deletion required");
  const target = accountId(productId);
  return bookstoreCommand(actor, body.storeId, "product.manage", { ...body, productId: target }, async ({ session, scope, audit }) => {
    const product = await Product.findOne({ _id: target, ...scope }).session(session);
    if (!product) fail(404, "Product not found");
    const status = await productDeletionStatus(product, session);
    if (!status.canDelete) fail(409, status.reason);
    const result = await Product.deleteOne({ _id: target, ...scope }, { session });
    if (result.deletedCount !== 1) fail(409, "Product changed before deletion. Refresh and retry.");
    // Keep the existing audit vocabulary/schema; the after-state explicitly
    // records permanent removal and the before-state retains catalog metadata.
    await audit("product.updated", "Product", target, { name: product.name, sku: product.sku, category: product.category, price: product.price, moneyUnit: product.moneyUnit, isActive: product.isActive, stock: product.stock }, { deleted: true });
    return { productId: target, deleted: true };
  });
}
