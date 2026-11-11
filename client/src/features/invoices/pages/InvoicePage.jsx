import { useEffect, useState } from "react";
import { useInvoiceApi } from "../services/invoiceApi";
import Invoice from "../components/Invoice";

export default function InvoicesPage() {
  const { getInvoices, ensureInvoice } = useInvoiceApi();

  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const loadInvoices = async (params = {}) => {
    try {
      const res = await getInvoices(params);
      setInvoices(res.data);
      setError("");
    } catch {
      setError("Unable to load invoices.");
    }
  };
  useEffect(() => {
    if (selected) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    }
  }, [selected]);
  useEffect(() => {
    loadInvoices();
  }, []);

  const handlePrint = async (orderId) => {
    try {
      const res = await ensureInvoice(orderId);
      if (!Array.isArray(res.data?.items)) throw new Error("Receipt data unavailable");
      setSelected(res.data);
      setError("");
    } catch {
      setError("Unable to prepare receipt.");
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
      <h1 className="text-xl font-bold">Invoices</h1>
      {error && <p role="alert">{error}</p>}

      {/* FILTERS */}
      <div
        className="flex gap-2 p-3 rounded-xl border"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <input
          type="date"
          onChange={(e) => loadInvoices({ from: e.target.value })}
          className="input"
        />

        <select
          onChange={(e) => loadInvoices({ status: e.target.value })}
          className="input"
        >
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {invoices.map((inv) => (
          <div
            key={inv._id}
            className="p-4 rounded-xl border flex justify-between items-center"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div>
              <p className="font-bold">{inv.invoiceNumber}</p>

              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                {typeof inv.total === "number" ? `PHP ${(inv.total / 100).toFixed(2)}` : "Total unavailable"}
              </p>

              <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                {new Date(inv.issuedAt).toLocaleString()}
              </p>
            </div>

            <button
              onClick={() => handlePrint(inv.orderId)}
              className="px-3 py-2 rounded text-white"
              style={{
                backgroundColor: "var(--color-primary)",
              }}
            >
              Print
            </button>
          </div>
        ))}
      </div>

      {/* PRINT AREA */}
      {selected && (
        <div style={{ position: "absolute", top: "-9999px" }}>
          <Invoice invoice={selected} />
        </div>
      )}
    </div>
  );
}
