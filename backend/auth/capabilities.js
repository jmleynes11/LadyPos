import { freeze } from "./roles.js";
const A="Administrator", M="Store Manager", C="Cashier", S="Customer / Student";
const entries = {};
function define(actions, base, conditional=[], scope="store", fields="none", guards=[]) {
  for (const action of actions.split(" ")) entries[action]={base,conditional,scope,fields,guards};
}
define("account.list account.create account.update account.assignRole account.confirm account.reset account.deactivate account.delete permission.manage", [A], [], "account-realm", "account", ["current-account","actor-version","audit","canonical-target"]);
define("settings.manage systemAudit.read", [A], [], "system", "none", ["approved-contract"]);
define("catalog.create", [M], [], "store", "catalog", ["audit","field-validation"]);
define("product.manage category.manage", [M], [], "store", "catalog", ["audit","field-validation"]);
define("catalog.manage product.price.write", [A], [], "store", "catalog", ["audit","field-validation"]);
define("catalog.saleRead", [C,S,M], [A], "catalog", "sale", ["availability"]);
define("inventory.receive inventory.adjust", [M], [A], "store", "stock", ["atomic-stock","reason","movement","audit","operation-identity"]);
define("inventory.history.read inventory.report.read", [A,M], [], "store", "none");
define("sale.process payment.record receipt.issue", [C], [A,M], "authorized-transaction", "none", ["server-price","state-validation","atomic-effects","audit","operation-identity"]);
define("salesHistory.own salesSummary.own", [C], [A,M], "own-processor", "none");
define("salesHistory.all salesReport.all", [A,M], [], "store", "none");
define("reversal.request", [M,C], [A], "authorized-transaction", "none", ["reason","audit","approved-effects"]);
define("reversal.approve reversal.apply", [M], [A], "authorized-transaction", "none", ["reason","audit","approved-effects","atomic-effects","operation-identity"]);
define("order.submit", [S], [], "own-subject", "orderSubmit", ["identity-binding","privacy","approved-workflow","server-price","item-validation"]);
define("order.status.own", [S], [], "own-subject", "orderStatus", ["identity-binding","privacy","approved-workflow"]);
define("order.fulfill", [C], [A,M], "assigned-order", "none", ["approved-workflow","minimal-fields"]);
define("order.oversee", [M], [A], "store", "none", ["approved-workflow"]);
export const CAPABILITIES=freeze(entries);
export const UNRESOLVED=freeze(["costs","expenses","contact-crud","exports","guest-access-contract"]);

