// Disposable browser verification only. No environment file or database.
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import mongoose from "../../backend/node_modules/mongoose/index.js";
import bcrypt from "../../backend/node_modules/bcryptjs/index.js";
import { accountAdapter } from "../../backend/tests/accountManagementAdapter.js";
import { installProductManagementQueries } from "../../backend/tests/productManagementAdapter.js";
import { createApp } from "../../backend/app.js";
import Store from "../../backend/models/Store.js";
import Customer from "../../backend/models/Person.js";
import Product from "../../backend/models/Product.js";
import Order from "../../backend/models/Order.js";
import Invoice from "../../backend/models/Invoice.js";
import * as controls from "../../backend/models/BookstoreControl.js";

if (process.env.MANAGE_PRODUCTS_FIXTURE_ONLY !== "1") throw Error("Explicit disposable fixture activation required");
process.env.JWT_SECRET = "synthetic-manage-products-browser-signing-key";
const storeId = new mongoose.Types.ObjectId(), customerId = new mongoose.Types.ObjectId();
const account = { _id: new mongoose.Types.ObjectId(), identifier: "synthetic-manager", role: "store_manager", password: await bcrypt.hash("Synthetic-Products-Only!", 4), confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] };
const clone = value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value));
const fixture = accountAdapter({ mock, after() {} }, [account], { extraModels: [Store, Customer, Invoice, ...Object.values(controls).filter(value => value?.modelName)], cloneValue: clone });
installProductManagementQueries({ mock }, fixture, clone);
fixture.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Disposable product management fixture", createdBy: account._id, orderCustomer: customerId });
fixture.store.get(Customer.modelName).set(String(customerId), { _id: customerId, owner: account._id, storeId, name: "Synthetic orders", isDeleted: false });
for (let i = 0; i < 125; i++) {
  const productId = new mongoose.Types.ObjectId();
  fixture.store.get(Product.modelName).set(String(productId), { _id: productId, owner: account._id, storeId, name: i === 0 ? "Book 000 · protected history" : `Book ${String(i).padStart(3, "0")}`, sku: `TEST-${i}`, category: i % 2 ? "Books" : "Supplies", price: (i + 1) * 100, stock: 0, isActive: i % 4 !== 0, moneyUnit: "PHP-centavos" });
  if (i === 0) {
    const orderId = new mongoose.Types.ObjectId();
    fixture.store.get(Order.modelName).set(String(orderId), { _id: orderId, owner: account._id, storeId, customer: customerId, items: [{ product: productId, name: "Original historical book", quantity: 1, unitPrice: 100, subtotal: 100 }], orderStatus: "pending", totalAmount: 100, moneyUnit: "PHP-centavos" });
  }
}
const backend = createApp().listen(0, "127.0.0.1"); await new Promise(resolve => backend.once("listening", resolve));
const { createServer } = await import("../node_modules/vite/dist/node/index.js");
const frontend = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)), envDir: false,
  define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") }, server: { host: "127.0.0.1", port: 5187, strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${backend.address().port}`, configure: proxy => proxy.on("proxyReq", request => request.setHeader("origin", "http://localhost:5173")) } } } });
await frontend.listen();
process.stdout.write("Disposable Manage Products fixture: http://127.0.0.1:5187/login; synthetic-manager / Synthetic-Products-Only!; 125 synthetic products; no database\n");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await frontend.close(); backend.close(() => process.exit(0)); });
