import { validateProductPhoto } from "../utils/productPhoto.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { accountId, fail } from "./accountManagement.js";
import { StockMovement } from "../models/BookstoreControl.js";
import { isClothing, supportsSizes, validSizeStocks, sizeStockTotal } from "../utils/clothingSizes.js";

export function catalogFields(body, { create = false } = {}) {
  const allowed = ["storeId", "operationId", "reason", "name", "sku", "price", "sellingPrice", "category", "isActive", "active", "sizeStocks"];
  if (create) allowed.push("imageUrl");
  if (!body || Object.keys(body).some(key => !allowed.includes(key))) fail(403, "Unsupported catalog field");
  const fields = {};
  if (Object.hasOwn(body, "sizeStocks")) {
    if (!validSizeStocks(body.sizeStocks)) fail(400, "Select clothing sizes with nonnegative whole stock quantities");
    fields.sizeStocks = { ...body.sizeStocks };
  }
  if (create && Object.hasOwn(body, "imageUrl")) fields.imageUrl = validateProductPhoto(body.imageUrl);
  for (const key of ["name", "sku", "category"]) if (Object.hasOwn(body, key)) {
    if (typeof body[key] !== "string" || (key !== "sku" && !body[key].trim())) fail(400, "Invalid product text");
    fields[key] = body[key].trim();
  }
  if (Object.hasOwn(body, "price") || Object.hasOwn(body, "sellingPrice")) {
    if (body.price !== undefined && body.sellingPrice !== undefined && body.price !== body.sellingPrice) fail(400, "Conflicting price aliases");
    fields.price = body.price ?? body.sellingPrice;
    if (!Number.isSafeInteger(fields.price) || fields.price < 0) fail(400, "Price must be integer PHP centavos");
  }
  if (Object.hasOwn(body, "isActive") || Object.hasOwn(body, "active")) {
    if (body.isActive !== undefined && body.active !== undefined && body.isActive !== body.active) fail(400, "Conflicting availability aliases");
    fields.isActive = body.isActive ?? body.active;
    if (typeof fields.isActive !== "boolean") fail(400, "Availability must be boolean");
  }
  if (create && (!fields.name || fields.price === undefined)) fail(400, "Product name and price required");
  if (!create && !Object.keys(fields).length) fail(400, "Catalog change required");
  return fields;
}

const snapshot = product => ({ name: product.name, sku: product.sku, price: product.price, category: product.category, isActive: product.isActive,
  ...(supportsSizes(product) ? { stock: product.stock, ...(product.sizeStocks ? { sizeStocks: { ...product.sizeStocks } } : {}) } : {}) });

async function configureSizes(product, fields, context) {
  const category = fields.category ?? product.category;
  if (!isClothing(category) && !supportsSizes(product)) {
    if (fields.sizeStocks !== undefined) fail(400, "Sizes apply only to Clothing products");
    return;
  }
  if (fields.sizeStocks === undefined) {
    if (!validSizeStocks(product.sizeStocks)) fail(400, "Select at least one clothing size and its stock quantity");
    return;
  }
  const beforeSizes = product.sizeStocks || {}, afterSizes = fields.sizeStocks;
  const removed = Object.keys(beforeSizes).filter(size => !Object.hasOwn(afterSizes, size));
  if (removed.length || !product.sizeStocks) {
    const orders = await Order.find({ ...context.scope, orderStatus: { $in: ["pending", "completed"] } }).session(context.session);
    for (const order of orders) for (const item of order.items) {
      if (String(item.product) !== String(product._id)) continue;
      if ((order.orderStatus === "pending" && removed.includes(item.size)) ||
        (!product.sizeStocks && !item.size && (order.orderStatus === "pending" || !order.reversalId))) {
        fail(409, "Size configuration conflicts with existing orders or saleable returns");
      }
    }
  }
  const stockChanged = Object.keys({ ...beforeSizes, ...afterSizes }).some(size => (beforeSizes[size] || 0) !== (afterSizes[size] || 0)) ||
    (product.stock || 0) !== sizeStockTotal(afterSizes);
  if (stockChanged) await context.requireCapability("inventory.adjust");
  const before = product.stock || 0, after = sizeStockTotal(afterSizes), delta = after - before;
  // Historical unallocated clothing stock is allocated explicitly by the manager.
  // Changes with the same aggregate total are retained in the product audit.
  const sizeChanges = Object.keys({ ...beforeSizes, ...afterSizes }).map(size => ({ size, before: beforeSizes[size] || 0,
    after: afterSizes[size] || 0, delta: (afterSizes[size] || 0) - (beforeSizes[size] || 0) })).filter(change => change.delta);
  if (delta) await StockMovement.create([{ storeId: context.scope.storeId, productId: product._id, actorId: context.actorId,
    operationId: context.operationId, reason: context.reason, source: "adjustment", before, after, delta, occurredAt: new Date(),
    ...(sizeStockTotal(beforeSizes) === before ? { sizeChanges } : {}) }], { session: context.session });
  product.stock = after;
  product.sizeStocks = { ...afterSizes };
}

export async function createBookstoreProduct(actor, body) {
  const fields = catalogFields(body, { create: true });
  return bookstoreCommand(actor, body.storeId, actor.role === "store_manager" ? "catalog.create" : "catalog.manage", body, async context => {
    const { session, scope, actorId, audit } = context;
    const { sizeStocks: _sizes, ...metadata } = fields;
    const product = new Product({ owner: actorId, ...scope, ...metadata, moneyUnit: "PHP-centavos", stock: 0 });
    await configureSizes(product, fields, context);
    await product.save({ session });
    await audit("product.created", "Product", product._id, { absent: true }, snapshot(product));
    return { productId: String(product._id), ...snapshot(product), moneyUnit: "PHP-centavos", stock: product.stock };
  });
}

export async function updateBookstoreProduct(actor, productId, body) {
  const target = accountId(productId), fields = catalogFields(body);
  if (actor.role === "store_manager" && fields.price !== undefined) fail(403, "Product price changes require Administrator access");
  return bookstoreCommand(actor, body.storeId, actor.role === "store_manager" ? "product.manage" : fields.price === undefined ? "catalog.manage" : "product.price.write", { ...body, productId: target }, async context => {
    const { session, scope, audit } = context;
    const product = await Product.findOne({ _id: target, ...scope }).session(session);
    if (!product) fail(404, "Product not found");
    if (product.moneyUnit !== "PHP-centavos") fail(409, "Historical monetary units require reviewed attribution");
    const before = snapshot(product);
    // Unrelated edits and archiving remain available for historical garments.
    if (fields.sizeStocks !== undefined || (fields.category !== undefined && fields.category !== product.category)) await configureSizes(product, fields, context);
    Object.assign(product, fields); await product.save({ session });
    await audit(fields.price !== undefined && before.price !== product.price ? "product.price_changed" : "product.updated", "Product", target, before, snapshot(product));
    return { productId: target, ...snapshot(product), moneyUnit: "PHP-centavos" };
  });
}

export async function archiveBookstoreProduct(actor, productId, body) {
  if (!body || Object.keys(body).some(key => !["storeId", "operationId", "reason"].includes(key))) fail(403, "Unsupported archive field");
  return updateBookstoreProduct(actor, productId, { ...body, isActive: false });
}

export async function setBookstoreActiveProducts(actor, body) {
  if (!body || Object.keys(body).some(key => !["storeId", "operationId", "reason", "productIds"].includes(key)) || !Array.isArray(body.productIds)) fail(400, "Explicit product list required");
  const ids = [];
  for (let i = 0; i < body.productIds.length; i++) {
    if (!Object.hasOwn(body.productIds, i)) fail(400, "Invalid product list");
    ids.push(accountId(body.productIds[i]));
  }
  if (new Set(ids).size !== ids.length) fail(400, "Duplicate product identity");
  return bookstoreCommand(actor, body.storeId, "catalog.manage", body, async ({ session, scope, audit }) => {
    const products = await Product.find(scope).session(session);
    if (ids.some(id => !products.some(product => String(product._id) === id))) fail(403, "Product outside bookstore");
    for (const product of products) {
      const active = ids.includes(String(product._id));
      if (product.isActive === active) continue;
      const before = product.isActive; product.isActive = active; await product.save({ session });
      await audit("product.updated", "Product", product._id, { isActive: before }, { isActive: active });
    }
    return { activeProductIds: ids };
  });
}
