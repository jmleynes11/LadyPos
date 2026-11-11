import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { bookstoreViews } from "../src/features/bookstore/presentation.js";
import { bookstoreNavigation } from "../src/features/bookstore/navigation.js";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const fixtureUrl = moduleUrl('export const fixture = { context: null, open: false, pathname: "/bookstore", search: "" };');
const { fixture } = await import(fixtureUrl);
const reactUrl = JSON.stringify(import.meta.resolve("react"));
const source = await fs.readFile(new URL("../src/shared/components/Layout.jsx", import.meta.url), "utf8");
let code = (await transformWithOxc(source, "Layout.jsx", { jsx: { runtime: "automatic", development: false } })).code;
const replacements = {
  react: moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export { useEffect, useRef } from ${reactUrl}; export const useState = () => [fixture.open, () => {}];`),
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  "react-router-dom": moduleUrl(`import { createElement } from ${reactUrl}; import { fixture } from ${JSON.stringify(fixtureUrl)}; export const Link = ({ to, children, ...props }) => createElement("a", { ...props, href: to }, children); export const Outlet = () => createElement("div", { "data-outlet": "preserved" }); export const useLocation = () => fixture; export const useNavigate = () => () => {};`),
  "../hooks/AuthContext.jsx": moduleUrl('export const useAuth = () => ({ user: { identifier: "synthetic" }, logout() {} });'),
  "../../features/bookstore/bookstoreContext.js": moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useBookstore = () => ({ context: fixture.context, cashierQueue: fixture.cashierQueue });`),
  "../../features/bookstore/navigation.js": new URL("../src/features/bookstore/navigation.js", import.meta.url).href,
  "../../features/bookstore/presentation.js": new URL("../src/features/bookstore/presentation.js", import.meta.url).href,
  "./BookstoreUI.jsx": moduleUrl('export function Brand() { return null; } export function Icon() { return null; }'),
};
const customerLayoutSource = await fs.readFile(new URL("../src/features/bookstore/CustomerLayout.jsx", import.meta.url), "utf8");
let customerLayoutCode = (await transformWithOxc(customerLayoutSource.replace('import "./customer-storefront.css";', ""), "CustomerLayout.jsx", { jsx: { runtime: "automatic", development: false } })).code;
for (const [name, url] of Object.entries({
  react: import.meta.resolve("react"),
  "react/jsx-runtime": replacements["react/jsx-runtime"],
  "react-router-dom": replacements["react-router-dom"],
  "../../shared/hooks/AuthContext.jsx": replacements["../hooks/AuthContext.jsx"],
  "../../shared/components/BookstoreUI.jsx": replacements["./BookstoreUI.jsx"],
})) customerLayoutCode = customerLayoutCode.replaceAll(JSON.stringify(name), JSON.stringify(url));
replacements["../../features/bookstore/CustomerLayout.jsx"] = moduleUrl(customerLayoutCode);
for (const [name, url] of Object.entries(replacements)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
const { default: Layout } = await import(moduleUrl(code));
const context = (role, keys = [], extra = {}) => ({ role, capabilities: Object.fromEntries(keys.map(key => [key, true])), ...extra });
const render = (value, options = {}) => {
  Object.assign(fixture, { context: value, open: false, pathname: "/bookstore", search: "", cashierQueue: undefined, ...options });
  const html = renderToStaticMarkup(createElement(Layout));
  const sidebar = html.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/)?.[0];
  assert(sidebar, "Actual Layout must render its sidebar");
  const paths = [...sidebar.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  return { html, sidebar, paths };
};
const historical = ["/products", "/orders", "/customers", "/invoices", "/dashboard", "/expenses"];
const workspace = ids => [...ids.map(id => `/bookstore?view=${id}`), "/profile"];
const admin = context("admin", ["catalog.manage", "product.price.write", "order.oversee", "inventory.history.read", "salesHistory.all", "reversal.apply", "order.status.own"], { canManageAccounts: true });

test("Admin sidebar hides the complete Historical Records section and only the requested workspace links", () => {
  const { sidebar, paths } = render(admin);
  assert.deepEqual(paths, [...workspace(["overview", "queue", "reversals", "my-orders", "settings"]), "/kiosk"]);
  for (const path of historical) assert(!paths.includes(path));
  assert(!sidebar.includes("Historical records")); assert(!sidebar.includes('aria-label="Historical navigation"'));
  for (const text of ["Products &amp; categories", "Inventory", "Transactions &amp; reports"]) assert(!sidebar.includes(text));
  for (const text of ["Dashboard", "Order queue", "Refunds &amp; voids", "My orders", "Store settings &amp; audit", "Users &amp; account", "Guest kiosk (signs out)", "Sign out"]) assert(sidebar.includes(text));
});

test("Admin sidebar visibility leaves shared view definitions and historical navigation definitions available", () => {
  for (const id of ["catalog", "inventory", "history"]) assert(bookstoreViews(admin).some(view => view.id === id));
  assert.deepEqual(bookstoreNavigation(admin).filter(item => item.name.startsWith("Historical")).map(item => item.path), historical);
  const direct = render(admin, { search: "?view=inventory" });
  assert(direct.html.includes('class="topbar-title">Inventory'));
  assert(direct.html.includes('data-outlet="preserved"'));
});

const unchanged = [
  ["Store/Inventory Manager", context("store_manager", ["product.manage", "category.manage", "order.oversee", "inventory.history.read", "salesHistory.all", "reversal.apply"]), ["overview", "products", "categories", "inventory", "history", "reversals"], false],
  ["legacy staff", context("user", [], { legacyReadOnly: true }), ["overview"], true],
  ["other staff with existing historical visibility", context("staff", ["inventory.history.read", "salesHistory.all"], { canManageAccounts: true }), ["overview", "catalog", "inventory", "history", "settings"], true],
];
const cashier = context("cashier", ["order.fulfill", "salesHistory.own", "reversal.request"]);
test("Cashier sidebar lands on catalog and shows the pending count only beside Order Queue", () => {
  const { html, sidebar, paths } = render(cashier, { cashierQueue: { storeId: "store-a", count: 7 } });
  assert.deepEqual(paths, ["catalog", "queue", "history", "reversals"].map(view => `/bookstore?view=${view}&amp;storeId=store-a`).concat("/profile", "/kiosk"));
  assert(!sidebar.includes("Dashboard"));
  assert(!sidebar.includes("view=overview"));
  assert(sidebar.includes("Transaction History"));
  assert(html.includes('class="topbar-title">Product catalog'));
  const badges = [...sidebar.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].filter(([link]) => link.includes('class="cashier-queue-badge"'));
  assert.equal(badges.length, 1);
  assert(badges[0][0].includes("view=queue"));
  assert(badges[0][0].includes('aria-label="7 pending orders">7</span>'));
  assert(sidebar.includes("Sign out"));
});

test("Cashier badge clears at zero and never appears for other roles", () => {
  for (const count of [0, null]) assert(!render(cashier, { cashierQueue: { count } }).sidebar.includes('class="cashier-queue-badge"'));
  for (const value of [admin, ...unchanged.map(row => row[1])]) assert(!render(value, { cashierQueue: { count: 5 } }).sidebar.includes('class="cashier-queue-badge"'));
});
for (const [name, value, ids, hasHistory] of unchanged) test(`${name} sidebar retains all existing links and their order`, () => {
  const { sidebar, paths } = render(value);
  assert.deepEqual(paths, [...workspace(ids), ...(hasHistory ? historical : []), "/kiosk"]);
  assert.equal(sidebar.includes('aria-label="Historical navigation"'), hasHistory);
  assert(sidebar.includes("Sign out"));
});

test("Admin-only visibility is identical in the existing desktop and mobile drawer markup", () => {
  for (const value of [admin, ...unchanged.map(row => row[1])]) {
    const desktop = render(value), mobile = render(value, { open: true });
    assert.deepEqual(mobile.paths, desktop.paths);
    assert(mobile.sidebar.includes('class="app-sidebar is-open"'));
    assert(desktop.sidebar.includes('class="app-sidebar "'));
    assert(mobile.html.includes('aria-controls="main-navigation"'));
  }
});

test("loading context retains its existing sidebar and guest entry", () => {
  assert.deepEqual(render(null).paths, [...workspace(["overview"]), "/kiosk"]);
});

test("Customer uses only shopping navigation in its own frame with existing catalog, orders, account and cart destinations", () => {
  const customer = context("customer", ["order.submit", "order.status.own"]);
  for (const [search, hash, current] of [["", "", "Home"], ["?view=catalog", "", "Shop"], ["?view=my-orders", "", "My Orders"], ["?view=catalog", "#customer-cart", "Cart"]]) {
    Object.assign(fixture, { context: customer, open: false, pathname: "/bookstore", search, hash });
    const html = renderToStaticMarkup(createElement(Layout));
    assert(html.includes('class="customer-store"')); assert(!html.includes("app-sidebar"));
    const nav = html.match(/<nav\b[^>]*aria-label="Shopping navigation"[\s\S]*?<\/nav>/)?.[0];
    assert(nav);
    assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ["/bookstore", "/bookstore?view=catalog", "/bookstore?view=my-orders", "/profile", "/bookstore?view=catalog#customer-cart"]);
    assert(nav.includes(`aria-current="page" href="${current === "Home" ? "/bookstore" : current === "My Orders" ? "/bookstore?view=my-orders" : current === "Cart" ? "/bookstore?view=catalog#customer-cart" : "/bookstore?view=catalog"}`));
    assert(html.includes('data-outlet="preserved"')); assert(html.includes('aria-label="Sign out"'));
    assert(!html.includes("Historical records")); assert(!html.includes("Dashboard"));
  }
});
