// src/features/profile/components/UserModal.jsx
import { useState, useEffect } from "react";

const EMPTY = {
  identifier: "",
  password: "",
  name: "",
  phone: "",
  address: "",
  role: "",
  reason: "",
  reviewId: "",
  confirmed: false,
};

export function UserModal({
  open,
  initialData = null,
  errors = {},
  loading = false,
  onSave,
  onClose,
}) {
  const isEdit = !!initialData?._id;
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, ...initialData, password: "", operationId: crypto.randomUUID() });
    }
  }, [open, initialData]);

  if (!open) return null;

  const set = (field) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-xl p-6 overflow-y-auto max-h-[90vh]"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h3 className="text-base font-semibold mb-4">
          {isEdit ? "Edit User" : "Create User"}
        </h3>

        {errors.general && (
          <div className="mb-4 p-3 rounded-lg text-sm text-red-600 bg-red-50 border border-red-200">
            {errors.general}
          </div>
        )}

        <div className="space-y-3">
          <FormField label="Identifier *" error={errors.identifier}>
            <input
              className="input w-full"
              value={form.identifier}
              onChange={set("identifier")}
              placeholder="e.g. johndoe"
              disabled={loading}
              autoFocus={!isEdit}
            />
          </FormField>

          <FormField
            label={
              isEdit
                ? "New Password (leave blank to keep current)"
                : "Password *"
            }
            error={errors.password}
          >
            <input
              className="input w-full"
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder={isEdit ? "Optional" : "Min 6 characters"}
              disabled={loading}
            />
          </FormField>

          <FormField label="Full Name" error={errors.name}>
            <input
              className="input w-full"
              value={form.name}
              onChange={set("name")}
              placeholder="Full name"
              disabled={loading}
            />
          </FormField>

          <FormField label="Phone *" error={errors.phone}>
            <input
              className="input w-full"
              value={form.phone}
              onChange={set("phone")}
              placeholder="09XXXXXXXXX or +639XXXXXXXXX"
              disabled={loading}
            />
          </FormField>

          <FormField label="Address" error={errors.address}>
            <input
              className="input w-full"
              value={form.address}
              onChange={set("address")}
              placeholder="Address"
              disabled={loading}
            />
          </FormField>

          <FormField label="Role" error={errors.role}>
            <select
              className="input w-full"
              value={form.role}
              onChange={set("role")}
              disabled={loading}
            >
              <option value="">Select approved role</option>
              {initialData?.role === "user" && <option value="user">Legacy user — awaiting review</option>}
              <option value="admin">Administrator</option>
              <option value="store_manager">Store Manager</option>
              <option value="cashier">Cashier</option>
              <option value="customer">Customer / Student</option>
            </select>
          </FormField>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.confirmed}
              onChange={set("confirmed")}
              disabled={loading || !isEdit}
              className="w-4 h-4"
            />
            Confirmed
          </label>
          <FormField label="Reason for account change *" error={errors.reason}>
            <input className="input w-full" value={form.reason} onChange={set("reason")} disabled={loading} />
          </FormField>
          {initialData?.role === "user" && form.role !== "user" && (
            <FormField label="Approved review ID *" error={errors.reviewId}>
              <input className="input w-full" value={form.reviewId} onChange={set("reviewId")} disabled={loading} />
            </FormField>
          )}
        </div>

        <div
          className="flex justify-end gap-3 pt-4 mt-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm"
          >
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (
    <div>
      <label
        className="block text-xs font-medium mb-1"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
