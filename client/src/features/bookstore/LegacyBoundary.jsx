import { Navigate } from "react-router-dom";
import { useBookstore } from "./bookstoreContext.js";
export default function LegacyBoundary({ children }) {
  const { context, error } = useBookstore();
  if (!context) return <p role="status">{error || "Checking access…"}</p>;
  if (context.role === "cashier") return <Navigate to="/bookstore?view=catalog" replace />;
  if (!context.legacyReadOnly && !context.canManageAccounts) return <Navigate to="/bookstore" replace />;
  return <><p className="p-3 text-sm">Historical records · read only. Unverified monetary units require review.</p>{children}</>;
}
