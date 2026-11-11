import Product from "../models/Product.js";
import Store from "../models/Store.js";
import { fail } from "./accountManagement.js";
import { bookstoreReadScope } from "./bookstoreAccess.js";
import { bookstoreCommand } from "./bookstoreCommand.js";
import { isClothing, validSizeStocks } from "../utils/clothingSizes.js";

const key = name => name.toLowerCase();
function categoryName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100 || /[\x00-\x1f\x7f]/.test(value)) fail(400, "Category name must contain 1 to 100 characters");
  return value.trim();
}
function namesFor(store, products) {
  return [...new Set([...(store.categoryNames || []), ...products.map(product => product.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}
export async function readCategories(actor, storeId) {
  const scope = await bookstoreReadScope(actor, storeId, "category.manage");
  const [store, products] = await Promise.all([Store.findById(scope.storeId), Product.find(scope)]);
  return { categories: namesFor(store, products).map(name => ({ name, productCount: products.filter(product => product.category === name).length })) };
}

export async function manageCategory(actor, body) {
  const actions = { create: ["name"], rename: ["name", "newName"], delete: ["name", "replacement"] };
  if (!body || !Object.hasOwn(actions, body.action) || Object.keys(body).some(field => !["storeId", "operationId", "reason", "action", ...actions[body.action]].includes(field))) fail(400, "Unsupported category change");
  const name = categoryName(body.name);
  const destination = body.action === "rename" ? categoryName(body.newName) : body.replacement === undefined || body.replacement === "" ? undefined : categoryName(body.replacement);
  return bookstoreCommand(actor, body.storeId, "category.manage", body, async ({ session, scope, audit }) => {
    const store = await Store.findById(scope.storeId).session(session);
    const products = await Product.find(scope).session(session);
    const names = namesFor(store, products), exists = names.includes(name);
    let next = [...names];
    if (body.action === "create") {
      if (names.some(entry => key(entry) === key(name))) fail(409, "Category already exists");
      next.push(name);
    } else {
      if (!exists) fail(404, "Category not found");
      if (destination === name) fail(400, "Choose a different category name");
      if (body.action === "rename" && names.some(entry => entry !== name && key(entry) === key(destination))) fail(409, "Category already exists");
      const assigned = products.filter(product => product.category === name);
      if (body.action === "delete" && assigned.length && !destination) fail(409, "Select a replacement category for assigned products");
      if (body.action === "delete" && destination && !names.includes(destination)) fail(400, "Replacement category must already exist");
      next = names.filter(entry => entry !== name);
      if (body.action === "rename") next.push(destination);
      for (const product of assigned) {
        if (isClothing(product.category) !== isClothing(destination) && !validSizeStocks(product.sizeStocks) && (product.stock > 0 || isClothing(destination))) {
          fail(409, "Configure size inventory before changing this category");
        }
        product.category = destination;
        await product.save({ session });
        await audit("product.updated", "Product", product._id, { category: name }, { category: destination });
      }
    }
    store.categoryNames = next;
    await store.save({ session });
    await audit(`category.${body.action === "create" ? "created" : body.action === "rename" ? "renamed" : "deleted"}`, "Store", store._id, { categories: names }, { categories: next });
    return { categories: next };
  });
}
