import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Invoice from "../models/Invoice.js";
import { StockMovement, SaleReversal, BookstoreReceipt } from "../models/BookstoreControl.js";
function valuesAt(value, path) {
  if (Array.isArray(value)) return value.flatMap(entry => valuesAt(entry, path));
  if (!path.length) return [value];
  return valuesAt(value?.[path[0]], path.slice(1));
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some(part => matches(row, part));
    return valuesAt(row, key.split(".")).some(value => {
      if (expected && typeof expected === "object" && "$in" in expected) return expected.$in.some(item => String(item) === String(value));
      if (expected?.$regex !== undefined) return new RegExp(expected.$regex, expected.$options).test(value || "");
      return String(value) === String(expected);
    });
  });
}

// Disposable query semantics for product-management tests; never connects to MongoDB.
export function installProductManagementQueries(t, f, clone) {
  const Models = [Product, Order, Invoice, StockMovement, SaleReversal, BookstoreReceipt];
  for (const Model of Models) {
    const query = (filter, one = false, count = false) => {
      let session, offset = 0, limit = Infinity, sort = {};
      const q = { session(value) { session = value; return q; }, select() { return q; }, sort(value) { sort = value; return q; }, skip(value) { offset = value; return q; }, limit(value) { limit = value; return q; },
        then(ok, no) { return Promise.resolve().then(() => {
          let rows = [...(session?.staged || f.store).get(Model.modelName).values()].filter(row => matches(row, filter));
          if (count) return rows.length;
          rows.sort((a, b) => { for (const [key, direction] of Object.entries(sort)) { const compared = typeof a[key] === "number" ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key])); if (compared) return direction * compared; } return 0; });
          rows = rows.slice(offset, offset + limit).map(row => Model.hydrate(clone(row)));
          return one ? rows[0] || null : rows;
        }).then(ok, no); },
      }; return q;
    };
    t.mock.method(Model, "findOne", filter => query(filter, true));
    t.mock.method(Model, "find", filter => query(filter));
    t.mock.method(Model, "countDocuments", filter => query(filter, false, true));
  }
}
