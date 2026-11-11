export const bookstoreDefaultView = context => context?.role === "cashier" ? "catalog" : "overview";
export const bookstoreLandingPath = account => account?.role === "cashier" ? "/bookstore?view=catalog" : "/bookstore";

export function bookstoreViewPath(context, view, storeId) {
  const params = new URLSearchParams({ view });
  if (context?.role === "cashier" && storeId) params.set("storeId", storeId);
  return `/bookstore?${params}`;
}

export function resolveBookstoreView(context, requested, views) {
  if (context?.role === "cashier" && requested === "payment") return "payment";
  return views.some(item => item.id === requested) ? requested : bookstoreDefaultView(context);
}

export function bookstoreNavigation(context) {
  const base = [{ name: "Bookstore", path: "/bookstore" }, { name: "Profile", path: "/profile" }];
  if (!context) return base.filter(tab => tab.path === "/profile");
  if (context.legacyReadOnly || context.canManageAccounts) base.push(
    { name: "Historical products", path: "/products" }, { name: "Historical orders", path: "/orders" },
    { name: "Historical customers", path: "/customers" }, { name: "Historical receipts", path: "/invoices" },
    { name: "Historical dashboard", path: "/dashboard" }, { name: "Historical expenses", path: "/expenses" },
  );
  return context.role === "cashier" ? base.filter(tab => tab.path !== "/dashboard") : base;
}
