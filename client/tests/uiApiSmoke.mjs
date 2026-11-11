// Explicitly run against uiBrowserFixture.mjs only. No configured environment or DB is read.
import assert from "node:assert/strict";
if (process.env.B03_FIXTURE_ONLY !== "1") throw new Error("Synthetic fixture guard required");
const base = "http://127.0.0.1:5186/api";
const identity = await fetch("http://127.0.0.1:5186/__ui-fixture-identity");
assert.equal(await identity.text(), "UPHSD-UI-FIXTURE-NO-DATABASE", "Refuse to test any server without the explicit fixture identity");
const actors = {};
const results = [];
async function request(path, { role, method = "GET", body, status = 200 } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(role ? { Authorization: `Bearer ${actors[role].token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: expected ${status}, got ${response.status}`);
  return data;
}
for (const role of ["admin", "store_manager", "cashier", "customer"]) {
  actors[role] = await request("/users/login", { method: "POST", body: { identifier: role, password: "Synthetic-B03-Only!" } });
  const context = (await request("/bookstore/context", { role })).data;
  assert.equal(context.role, role);
  actors[role].storeId = context.stores[0].id;
}
results.push("Four canonical roles authenticate through actual localhost API and receive matching context");
const storeId = actors.admin.storeId;
const catalog = () => request(`/products?storeId=${storeId}&limit=100`, { role: "admin" }).then(row => row.data);
const product = (await catalog()).find(row => row.sku === "LOCAL-ONLY");
assert(product);
for (const role of ["cashier", "customer", "store_manager"]) {
  await request(`/products/${product._id}`, { role, method: "PUT", status: 403, body: { storeId, operationId: crypto.randomUUID(), reason: "Synthetic denial probe", price: 1 } });
}
await request(`/products/${product._id}/stock`, { role: "cashier", method: "PATCH", status: 403, body: { storeId, operationId: crypto.randomUUID(), reason: "Synthetic denial probe", delta: 1 } });
await request(`/bookstore/transactions?storeId=${storeId}`, { role: "customer", status: 403 });
await request("/users", { role: "cashier", status: 403 });
await request(`/products?storeId=${storeId}`, { status: 401 });
results.push("Backend denies non-admin pricing, cashier adjustment/account directory, customer history and anonymous protected catalog");
const before = (await catalog()).find(row => row._id === product._id).stock;
assert.equal(before, product.stock);
assert.equal((await catalog()).find(row => row._id === product._id).price, product.price);
const created = (await request("/bookstore/orders", { role: "customer", method: "POST", body: { storeId, operationId: crypto.randomUUID(), items: [{ product: product._id, quantity: 1 }] } })).data;
assert.equal((await catalog()).find(row => row._id === product._id).stock, before);
results.push("Student unpaid submission leaves stock unchanged");
await request(`/bookstore/orders/${created.orderId}/claim`, { role: "cashier", method: "POST", body: { storeId, operationId: crypto.randomUUID() } });
const quote = (await request(`/bookstore/orders/${created.orderId}/quote?storeId=${storeId}`, { role: "cashier" })).data;
const common = { storeId, quote: quote.quote, confirmedTotal: quote.total, paymentMethod: "cash", paymentReference: "" };
await request(`/bookstore/orders/${created.orderId}/complete`, { role: "cashier", method: "POST", status: 400, body: { ...common, operationId: crypto.randomUUID(), paymentConfirmed: false } });
assert.equal((await catalog()).find(row => row._id === product._id).stock, before);
results.push("Unverified payment is rejected without inventory deduction");
const completion = { ...common, operationId: crypto.randomUUID(), paymentConfirmed: true };
const sale = (await request(`/bookstore/orders/${created.orderId}/complete`, { role: "cashier", method: "POST", body: completion })).data;
assert(sale.receipt.invoiceNumber);
const replay = (await request(`/bookstore/orders/${created.orderId}/complete`, { role: "cashier", method: "POST", body: completion })).data;
assert.equal(replay.receipt.invoiceNumber, sale.receipt.invoiceNumber);
assert.equal((await catalog()).find(row => row._id === product._id).stock, before - 1);
const history = (await request(`/bookstore/transactions?storeId=${storeId}`, { role: "cashier" })).data;
assert.equal(history.transactions.filter(row => row.orderId === created.orderId).length, 1);
results.push("Confirmed completion returns a receipt; replay records one sale and deducts inventory exactly once in staged persistence");
process.stdout.write(JSON.stringify({ environment: "Disposable in-memory localhost fixture only", passed: results.length, results }, null, 2) + "\n");
