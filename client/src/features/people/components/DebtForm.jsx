import { useState } from "react";
import { logClientError } from "../../../shared/utils/safeDiagnostics.js";

export default function DebtForm({ onSubmit, isPayment }) {
  const [form, setForm] = useState({ amount: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = parseFloat(form.amount);

    // 🔴 HARD GUARDS (you were missing this)
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);

      await onSubmit({
        amount,
        notes: form.notes?.trim(),
      });

      // ✅ Reset after success
      setForm({ amount: "", notes: "" });
    } catch (err) {
      logClientError("people.transaction_failed", err);
      alert("Something went wrong while saving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-xl p-3 space-y-2"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        placeholder={isPayment ? "Enter payment amount" : "Enter debt amount"}
        value={form.amount}
        onChange={handleChange}
        required
        className="input w-full text-sm"
      />

      <input
        name="notes"
        placeholder="Optional note (e.g. paid cash)"
        value={form.notes}
        onChange={handleChange}
        className="input w-full text-sm"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-xl text-white text-sm"
        style={{
          backgroundColor: isPayment
            ? "var(--color-primary)"
            : "var(--color-accent)",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Saving..." : isPayment ? "Confirm Payment" : "Add Debt"}
      </button>
    </form>
  );
}
