// src/features/profile/ProfilePage.jsx
import { useAuth } from "../../../shared/hooks/AuthContext.jsx";
import { ProfileCard } from "../components/ProfileCard.jsx";
import { SecurityCard } from "../components/SecurityCard.jsx";
import { AdminUserTable } from "../components/AdminUserTable.jsx";
import { useBookstore } from "../../bookstore/bookstoreContext.js";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { context } = useBookstore();
  if (!user) return null;

  return (
    <div
      className="screen-wrap"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="eyebrow">UPHSD BOOKSTORE POS</div>
            <h1 className="text-2xl font-bold">{context?.canManageAccounts ? "Users & account" : "My account"}</h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: "var(--color-muted)" }}
            >
              Manage your account settings and security
            </p>
          </div>
          <button
            onClick={logout}
            className="secondary-action"
          >
            Logout
          </button>
        </div>

        {/* Profile & Security */}
        <div className="max-w-3xl mx-auto space-y-6">
          <ProfileCard />
          <SecurityCard />
        </div>

        {/* Admin section */}
        {context?.canManageAccounts && (
          <div className="mt-10 max-w-6xl">
            <AdminUserTable />
          </div>
        )}
      </div>
    </div>
  );
}
