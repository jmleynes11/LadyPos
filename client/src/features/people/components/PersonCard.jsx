import { usePersonApi } from "../services/api";
import { useState } from "react";
import DebtForm from "../components/DebtForm";
import { logClientError } from "../../../shared/utils/safeDiagnostics.js";

export default function PersonCard({ person, refresh }) {
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [isPayment, setIsPayment] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addDebt, addPayment, updatePerson, deletePerson } = usePersonApi();

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: person.name,
    contactInfo: person.contactInfo || "",
    notes: person.notes || "",
  });
  // ✅ Safe balance calc
  const balance =
    person.debts?.reduce((acc, t) => {
      if (t.kind === "charge") return acc + t.amount;
      if (t.kind === "payment" && t.context === "debt") return acc - t.amount;
      return acc;
    }, 0) ?? 0;

  // ✅ Add handler with real debugging
  const handleAdd = async (data) => {
    try {
      setLoading(true);

      const payload = {
        amount: data.amount,
        notes: data.notes,
      };

      if (isPayment) {
        await addPayment(person._id, payload);
      } else {
        await addDebt(person._id, payload);
      }

      if (refresh) {
        await refresh();
      }

      setShowDebtForm(false);
    } catch (err) {
      logClientError("people.transaction_failed", err);
      alert("Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await updatePerson(person._id, editForm);
      await refresh();
      setShowEdit(false);
    } catch (err) {
      logClientError("people.update_failed", err);
      alert("Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this person? This cannot be undone.")) return;

    try {
      await deletePerson(person._id);
      await refresh();
    } catch (err) {
      logClientError("people.delete_failed", err);
      alert("Failed to delete");
    }
  };

  // ✅ Robust sorting (handles missing/bad dates)
  const sortedTransactions = person.debts?.slice().sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-semibold text-base">{person.name}</h2>

          {person.contactInfo && (
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              {person.contactInfo}
            </p>
          )}

          {person.notes && (
            <p
              className="text-xs italic"
              style={{ color: "var(--color-muted)" }}
            >
              {person.notes}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Balance
          </p>

          <p
            className="text-lg font-bold"
            style={{
              color: balance < 0 ? "var(--color-danger)" : "var(--color-text)",
            }}
          >
            ₱ {balance}
          </p>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setIsPayment(false);
            setShowDebtForm((prev) => !prev);
          }}
          className="flex-1 py-2 rounded-xl text-sm text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          + Debt
        </button>

        <button
          onClick={() => {
            setIsPayment(true);
            setShowDebtForm((prev) => !prev);
          }}
          className="flex-1 py-2 rounded-xl text-sm text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          + Payment
        </button>
      </div>

      {/* FORM */}
      {showDebtForm && <DebtForm onSubmit={handleAdd} isPayment={isPayment} />}

      {/* MANAGE */}
      <div className="flex justify-start pt-2">
        <button
          onClick={() => setShowEdit(true)}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{
            backgroundColor: "var(--color-border)",
          }}
        >
          ⚙ Manage
        </button>
      </div>

      {/* TRANSACTIONS */}
      <div className="pt-2">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="w-full text-left text-sm font-medium"
          style={{ color: "var(--color-muted)" }}
        >
          Transactions {open ? "▲" : "▼"}
        </button>

        {open && (
          <div
            className="mt-2 p-2 rounded-2xl border space-y-2 max-h-64 overflow-y-auto"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            {sortedTransactions?.length ? (
              sortedTransactions.map((t) => {
                const isDebt = t.kind === "charge";

                return (
                  <div
                    key={t._id || t.id}
                    className="p-3 rounded-xl text-sm flex justify-between border"
                    style={{
                      backgroundColor: isDebt
                        ? "rgba(239,68,68,0.1)"
                        : "rgba(34,197,94,0.1)",
                      borderColor: "var(--color-border)",
                    }}
                  >
                    <div>
                      <p className="font-medium">
                        {t.kind} • {t.context}
                      </p>

                      <p
                        className="text-xs"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {new Date(
                          t.date || t.createdAt || Date.now(),
                        ).toLocaleString()}
                      </p>

                      {t.notes && (
                        <p
                          className="text-xs italic"
                          style={{ color: "var(--color-muted)" }}
                        >
                          {t.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs">
                      <p style={{ color: "var(--color-muted)" }}>Amount</p>
                      <p className="font-semibold">₱{t.amount}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p
                className="text-xs text-center"
                style={{ color: "var(--color-muted)" }}
              >
                No transactions yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEdit && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="rounded-xl p-4 w-[90%] max-w-sm space-y-3 border"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <h3 className="font-semibold text-sm">Manage Person</h3>

            <input
              className="input w-full text-sm"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              placeholder="Name"
            />

            <input
              className="input w-full text-sm"
              value={editForm.contactInfo}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  contactInfo: e.target.value,
                })
              }
              placeholder="Contact"
            />

            <input
              className="input w-full text-sm"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
              placeholder="Notes"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUpdate}
                className="flex-1 py-1.5 rounded text-sm text-white"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Save
              </button>

              <button
                onClick={handleDelete}
                className="flex-1 py-1.5 rounded text-sm text-white"
                style={{ backgroundColor: "var(--color-danger)" }}
              >
                Delete
              </button>
            </div>

            <button
              onClick={() => setShowEdit(false)}
              className="w-full text-xs pt-1"
              style={{ color: "var(--color-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
