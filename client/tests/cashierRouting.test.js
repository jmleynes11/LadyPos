import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { transformWithOxc } from "vite";
import { bookstoreViews } from "../src/features/bookstore/presentation.js";
import { bookstoreDefaultView, bookstoreLandingPath, bookstoreNavigation, bookstoreViewPath, resolveBookstoreView } from "../src/features/bookstore/navigation.js";

test("Cashier login, bare workspace, removed dashboard and invalid views land on the existing catalog", () => {
  const cashier = { role: "cashier", capabilities: { "order.fulfill": true, "salesHistory.own": true } };
  assert.equal(bookstoreLandingPath(cashier), "/bookstore?view=catalog");
  assert.equal(bookstoreDefaultView(cashier), "catalog");
  for (const view of [null, "", "overview", "dashboard", "unknown"]) assert.equal(resolveBookstoreView(cashier, view, bookstoreViews(cashier)), "catalog");
  for (const view of ["catalog", "queue", "history", "payment"]) assert.equal(resolveBookstoreView(cashier, view, bookstoreViews(cashier)), view);
  assert(!bookstoreNavigation({ ...cashier, legacyReadOnly: true }).some(item => item.path === "/dashboard"));
  assert.equal(bookstoreViewPath(cashier, "queue", "store-a"), "/bookstore?view=queue&storeId=store-a");
});

for (const role of ["admin", "store_manager", "customer", "user"]) test(`${role} retains its login destination and dashboard default`, () => {
  const context = { role, legacyReadOnly: role === "user", capabilities: {} };
  assert.equal(bookstoreLandingPath(context), "/bookstore");
  assert.equal(bookstoreDefaultView(context), "overview");
  for (const view of [null, "overview", "unknown", "payment"]) assert.equal(resolveBookstoreView(context, view, bookstoreViews(context)), "overview");
  assert.equal(bookstoreViewPath(context, "overview", "store-a"), "/bookstore?view=overview");
});

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const fixtureUrl = moduleUrl("export const fixture = { account: null, destinations: [] };");
const { fixture } = await import(fixtureUrl);
const routerUrl = moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useNavigate = () => path => fixture.destinations.push(path); export function Link() { return null; } export function Navigate() { return null; }`);
async function compile(path, replacements) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  let { code } = await transformWithOxc(source, "Routing.jsx", { jsx: { runtime: "automatic", development: false } });
  for (const [name, url] of Object.entries({ "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"), "react-router-dom": routerUrl, ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return import(moduleUrl(code));
}
const { default: LoginPage } = await compile("../src/features/auth/pages/LoginPage.jsx", {
  react: moduleUrl("export const useState = initial => [initial, () => {}];"),
  "../../../shared/hooks/AuthContext.jsx": moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useAuth = () => ({ login: async () => fixture.account, isLoading: false, error: null });`),
  "../../../shared/components/BookstoreUI.jsx": moduleUrl("export function Brand() { return null; } export function Icon() { return null; } export function Notice() { return null; }"),
  "../../bookstore/navigation.js": new URL("../src/features/bookstore/navigation.js", import.meta.url).href,
});
const { default: LegacyBoundary } = await compile("../src/features/bookstore/LegacyBoundary.jsx", {
  "./bookstoreContext.js": moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useBookstore = () => ({ context: fixture.account });`),
});
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}

for (const role of ["cashier", "admin", "store_manager", "customer"]) test(`actual ${role} login handler selects the authorized role's destination`, async () => {
  fixture.account = { role }; fixture.destinations = [];
  const form = nodes(LoginPage()).find(node => node.type === "form");
  await form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(fixture.destinations, [role === "cashier" ? "/bookstore?view=catalog" : "/bookstore"]);
});

test("actual historical route boundary redirects Cashier dashboard URLs while preserving administrator history", () => {
  fixture.account = { role: "cashier" };
  assert.equal(LegacyBoundary({ children: "old dashboard" }).props.to, "/bookstore?view=catalog");
  fixture.account = { role: "admin", canManageAccounts: true };
  assert(nodes(LegacyBoundary({ children: "old dashboard" })).some(node => node.props?.children?.includes?.("old dashboard")));
  for (const role of ["store_manager", "customer"]) {
    fixture.account = { role };
    assert.equal(LegacyBoundary({ children: "old dashboard" }).props.to, "/bookstore");
  }
});
