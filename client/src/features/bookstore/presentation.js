export const ROLE_LABELS = { admin: "Administrator", store_manager: "Store Manager", cashier: "Cashier", customer: "Customer / Student", user: "Legacy account" };

export function filterCatalog(products, search, category) {
  const query = search.trim().toLowerCase();
  return products.filter(product => (category === "All products" || product.category === category) && `${product.name} ${product.sku || ""}`.toLowerCase().includes(query));
}

// Keep cancellation disabled until the separate AR01 domain correction is verified.
export const CANCELLATION_BLOCKER = "Unpaid order cancellation is unavailable pending the separately tracked AR01 authorization correction. No cancellation request will be sent.";

export function bookstoreViews(context) {
  if (!context || context.legacyReadOnly) return [{ id: "overview", name: "Overview", icon: "dashboard" }];
  const caps = context.capabilities || {};
  return [
    ...(context.role === "cashier" ? [] : [{ id: "overview", name: context.role === "customer" ? "Home" : "Dashboard", icon: "dashboard" }]),
    ...(context.role === "store_manager" ? [{ id: "products", name: "Products & Categories", icon: "book" }, { id: "categories", name: "Category management", icon: "book" }] : [{ id: "catalog", name: context.role === "admin" ? "Products & categories" : context.role === "customer" ? "Shop" : "Product catalog", icon: "book" }]),
    ...((context.role !== "store_manager" && (caps["order.fulfill"] || caps["order.oversee"])) ? [{ id: "queue", name: "Order queue", icon: "queue" }] : []),
    ...(caps["inventory.history.read"] ? [{ id: "inventory", name: "Inventory", icon: "inventory" }] : []),
    ...((caps["salesHistory.own"] || caps["salesHistory.all"]) ? [{ id: "history", name: context.role === "cashier" ? "Transaction History" : "Transactions & reports", icon: "report" }] : []),
    ...((caps["reversal.request"] || caps["reversal.apply"]) ? [{ id: "reversals", name: "Refunds & voids", icon: "refresh" }] : []),
    ...(caps["order.status.own"] ? [{ id: "my-orders", name: context.role === "customer" ? "My Orders" : "My orders", icon: "bag" }] : []),
    ...(context.canManageAccounts ? [{ id: "settings", name: "Store settings & audit", icon: "settings" }] : []),
  ];
}
