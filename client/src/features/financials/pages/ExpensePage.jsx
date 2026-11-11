import { useEffect, useState } from "react";
import { useExpenseApi } from "../services/expenseApi";
import { logClientError } from "../../../shared/utils/safeDiagnostics.js";

export default function ExpensePage({ readOnly = false }) {
  const { getExpenses, createExpense, deleteExpense, updateExpense } =
    useExpenseApi();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("misc");
  const [note, setNote] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState("");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadExpenses();
  }, []);

  const startEdit = (expense) => {
    setEditingId(expense._id);
    setItemName(expense.itemName);
    setAmount(expense.amount);
    setCategory(expense.category);
    setNote(expense.note || "");
    setDate(expense.date ? expense.date.substring(0, 10) : "");
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      logClientError("expenses.load_failed", err);
    } finally {
      setLoading(false);
    }
  };
  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!editingId) return;

    try {
      await updateExpense(editingId, {
        itemName,
        amount,
        category,
        note,
        date,
      });

      resetForm();
      loadExpenses();
    } catch (err) {
      logClientError("expenses.update_failed", err);
    }
  };

  const resetForm = () => {
    setAmount("");
    setItemName("");
    setCategory("misc");
    setNote("debit");
    setDate("");
    setEditingId(null);
  };

  const addExpense = async (e) => {
    e.preventDefault();

    if (!amount || amount <= 0) return;

    try {
      await createExpense({
        itemName,
        amount,
        category,
        note,
        date: date || undefined, // 👈 important
      });
      setItemName("");
      setAmount("");
      setDate("");
      loadExpenses();
    } catch (err) {
      logClientError("expenses.create_failed", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id);
      loadExpenses();
    } catch (err) {
      logClientError("expenses.delete_failed", err);
    }
  };

  return (
    <div
      className="p-4 space-y-4"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        minHeight: "100vh",
      }}
    >
      <h1 className="text-xl font-bold">Expenses</h1>

      {/* ADD EXPENSE */}
      {!readOnly && <div
        className="p-4 rounded-xl border space-y-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2 className="font-semibold">Add Expense</h2>

        <form
          onSubmit={editingId ? handleUpdate : addExpense}
          className="flex gap-2 flex-wrap"
        >
          <input
            type="text"
            placeholder="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="input"
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            <option value="inventory">Inventory</option>
            <option value="rent">Rent</option>
            <option value="utilities">Utilities</option>
            <option value="misc">Misc</option>
          </select>

          <select
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
            <option value="cash">Cash</option>
            <option value="e-wallet">E-Wallet</option>
          </select>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />

          <button
            className="px-3 rounded text-white"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {editingId ? "Update" : "Add"}
          </button>
        </form>
      </div>}

      {/* EXPENSE LIST */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2 className="font-semibold">Expenses</h2>

        {loading && <p style={{ color: "var(--color-muted)" }}>Loading...</p>}

        {!loading && expenses.length === 0 && (
          <p style={{ color: "var(--color-muted)" }}>No expenses yet</p>
        )}

        <div className="space-y-2">
          {expenses.map((e) => (
            <div
              key={e._id}
              className="flex justify-between p-3 rounded border"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div>
                <p className="font-bold">{e.itemName}</p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {e.category} : ₱ {e.amount}
                </p>

                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {new Date(e.date).toLocaleDateString()} |{" "}
                  {e.note == "" ? "No note" : e.note.toUpperCase()}
                </p>
              </div>

              {!readOnly && <div className="flex gap-2">
                <button
                  onClick={() => startEdit(e)}
                  style={{ color: "var(--color-primary)" }}
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(e._id)}
                  style={{ color: "var(--color-danger)" }}
                >
                  Delete
                </button>
              </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
