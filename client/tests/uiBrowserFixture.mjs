// Disposable in-memory browser fixture. No database URI, provider or production data.
// Run explicitly with B03_FIXTURE_ONLY=1. Not part of node --test *.test.js.
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import mongoose from "../../backend/node_modules/mongoose/index.js";
import bcrypt from "../../backend/node_modules/bcryptjs/index.js";
import { accountAdapter } from "../../backend/tests/accountManagementAdapter.js";
import { createApp } from "../../backend/app.js";
import Store from "../../backend/models/Store.js";
import Customer from "../../backend/models/Person.js";
import Product from "../../backend/models/Product.js";
import Invoice from "../../backend/models/Invoice.js";
import * as controls from "../../backend/models/BookstoreControl.js";
import { submitAuthenticatedOrder, cancelOrder, claimOrder } from "../../backend/services/bookstoreOrders.js";

if (process.env.B03_FIXTURE_ONLY !== "1") throw Error("Explicit synthetic fixture activation required");
process.env.JWT_SECRET = "synthetic-browser-fixture-not-an-environment-secret";
const write = message => process.stdout.write(message + "\n");
const storeId = new mongoose.Types.ObjectId(), customerId = new mongoose.Types.ObjectId();
const password = await bcrypt.hash("Synthetic-B03-Only!", 4);
const accounts = ["admin", "store_manager", "cashier", "customer"].map(role => ({ _id: new mongoose.Types.ObjectId(), identifier: role, role, password, confirmed: true, accountState: "active", tokenVersion: 0, authorityVersion: 0, storeIds: [storeId] }));
const models = [Store, Customer, Invoice, ...Object.values(controls).filter(value => value?.modelName)];
const fixture = accountAdapter({ mock, after() {} }, accounts, { extraModels: models, cloneValue: value => mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(value)) });
fixture.store.get(Store.modelName).set(String(storeId), { _id: storeId, name: "Synthetic local bookstore", createdBy: accounts[0]._id, orderCustomer: customerId });
fixture.store.get(Customer.modelName).set(String(customerId), { _id: customerId, owner: accounts[0]._id, storeId, name: "Bookstore orders", isDeleted: false });
const productId = new mongoose.Types.ObjectId();
fixture.store.get(Product.modelName).set(String(productId), { _id: productId, owner: accounts[0]._id, storeId, name: "Synthetic notebook", sku: "LOCAL-ONLY", category: "Books", price: 15050, stock: 10, isActive: true, moneyUnit: "PHP-centavos" });
// Optional queue-removal preview uses real commands against this memory fixture.
if (process.env.CASHIER_QUEUE_REMOVAL_PREVIEW === "1") {
  const actor = role => ({ id: String(accounts.find(account => account.role === role)._id), role, tokenVersion: 0 });
  const body = () => ({ storeId: String(storeId), operationId: crypto.randomUUID(), items: [{ product: String(productId), quantity: 1 }] });
  const cancelled = await submitAuthenticatedOrder(actor("customer"), body());
  await cancelOrder(actor("store_manager"), cancelled.orderId, { storeId: String(storeId), operationId: crypto.randomUUID(), reason: "Synthetic existing cancellation for queue-removal preview" });
  await submitAuthenticatedOrder(actor("customer"), body());
  const assigned = await submitAuthenticatedOrder(actor("customer"), body());
  await claimOrder(actor("cashier"), assigned.orderId, { storeId: String(storeId), operationId: crypto.randomUUID() });
}
const backend = createApp({ bookstoreConfig: { publicStoreId: String(storeId), guestRateLimit: 1000, guestWindowMs: 60000 } }).listen(0, "127.0.0.1");
await new Promise((resolve, reject) => { backend.once("listening", resolve); backend.once("error", reject); });
const { createServer } = await import("../../client/node_modules/vite/dist/node/index.js");
const frontend = await createServer({ root: fileURLToPath(new URL("../../client", import.meta.url)), configFile: fileURLToPath(new URL("../../client/vite.config.js", import.meta.url)), envDir: false, plugins: [{ name: "ui-fixture-identity", configureServer(server) { server.middlewares.use("/__ui-fixture-identity", (_request, response) => { response.setHeader("Content-Type", "text/plain"); response.end("UPHSD-UI-FIXTURE-NO-DATABASE"); }); } }], define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") }, server: { host: "127.0.0.1", port: 5186, strictPort: true, proxy: { "/api": { target: `http://127.0.0.1:${backend.address().port}`, configure: proxy => proxy.on("proxyReq", request => request.setHeader("origin", "http://localhost:5173")) } } } });
await frontend.listen();
write("Synthetic browser fixture: http://127.0.0.1:5186/kiosk; no database; all state disappears at process exit");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await frontend.close(); backend.close(() => process.exit(0)); });





