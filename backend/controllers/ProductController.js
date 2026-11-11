import Product from "../models/Product.js";
import { respond, respondError } from "../utils/responseHelpers.js";
import { adjustBookstoreStock } from "../services/inventoryService.js";
import { createBookstoreProduct, updateBookstoreProduct, archiveBookstoreProduct, setBookstoreActiveProducts } from "../services/catalogService.js";
import { supportsSizes, clothingAvailable, sizeOptions } from "../utils/clothingSizes.js";
import { managedProducts, managedProductDeletionStatus, deleteManagedProduct } from "../services/productManagement.js";

const ownerIdFrom = (req) => req.user?._id || req.user?.id;
const toInt = (value, fallback) => Math.max(1, Number.parseInt(value ?? fallback, 10));
const productReadDto = (product, role) => {
  if (role === "user") return product; // approved owner-only legacy read envelope
  const value = { _id: product._id, name: product.name, sku: product.sku, price: product.price, category: product.category,
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}), ...sizeOptions(product), moneyUnit: product.moneyUnit, availability: product.isActive === true && clothingAvailable(product) };
  if (["admin", "store_manager"].includes(role)) Object.assign(value, { stock: product.stock, isActive: product.isActive });
  if (["admin", "store_manager"].includes(role) && supportsSizes(product)) value.sizeStocks = product.sizeStocks || {};
  return value;
};

export async function createProduct(req, res) {
  try {
    const product = await createBookstoreProduct(req.user, req.body);
    respond(res, 201, "Product created", product);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
}

export async function getProducts(req, res) {
  try {
    if (req.query.management === "true") {
      const result = await managedProducts(req.user, req.productScope, req.query);
      return respond(res, 200, "Products loaded", result.products.map(product => productReadDto(product, req.user.role)), result.pagination);
    }
    const owner = ownerIdFrom(req);
    const page = toInt(req.query.page, 1);
    const limit = toInt(req.query.limit, 20);
    const filter = { ...(req.productScope || { owner }) };

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { sku: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.category) filter.category = req.query.category;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
    if (["cashier", "customer"].includes(req.user.role)) { filter.isActive = true; filter.moneyUnit = "PHP-centavos"; }

    const sortField = ["name", "stock"].includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
    const sort = { [sortField]: sortField === "createdAt" ? -1 : 1 };

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
    ]);

    respond(res, 200, "Products loaded", products.map(product => productReadDto(product, req.user.role)), {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (req.query.management === "true" && err.statusCode && err.statusCode < 500) return respondError(res, err.statusCode, err.message);
    respondError(res, 500, err.message);
  }
}

export async function getProductById(req, res) {
  try {
    const filter = { _id: req.params.id, ...(req.productScope || { owner: ownerIdFrom(req) }) };
    if (["cashier", "customer"].includes(req.user.role)) { filter.isActive = true; filter.moneyUnit = "PHP-centavos"; }
    const product = await Product.findOne(filter).session(req.accountSession || null);
    if (!product) return respondError(res, 404, "Product not found");
    if (req.query.management === "true") return respond(res, 200, "Product deletion eligibility loaded", { ...productReadDto(product, req.user.role), deletion: await managedProductDeletionStatus(req.user, product) });
    respond(res, 200, "Product loaded", productReadDto(product, req.user.role));
  } catch (err) {
    if (req.query.management === "true" && err.statusCode && err.statusCode < 500) return respondError(res, err.statusCode, err.message);
    respondError(res, 500, err.message);
  }
}

export async function updateProduct(req, res) {
  try {
    const product = await updateBookstoreProduct(req.user, req.params.id, req.body);
    respond(res, 200, "Product updated", product);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
}

export async function deleteProduct(req, res) {
  try {
    if (req.body?.deletionMode !== undefined) {
      const product = await deleteManagedProduct(req.user, req.params.id, req.body);
      return respond(res, 200, "Product deleted", product);
    }
    const product = await archiveBookstoreProduct(req.user, req.params.id, req.body);
    respond(res, 200, "Product deactivated", product);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
}

export async function adjustStock(req, res) {
  try {
    const result = await adjustBookstoreStock(req.user, req.params.id, req.body);
    respond(res, 200, "Stock adjusted", result);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
}

export const setActiveProducts = async (req, res) => {
  try {
    const result = await setBookstoreActiveProducts(req.user, req.body);
    respond(res, 200, "Active products updated", result);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
};
