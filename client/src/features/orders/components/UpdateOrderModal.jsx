import { useEffect, useState } from "react";
import { useProductApi } from "../../products/services/productApi";
import { usePersonApi } from "../../people/services/api";
import { useOrderApi } from "../services/ordersApi";
import { useInvoiceApi } from "../../invoices/services/invoiceApi";
import Invoice from "../../invoices/components/Invoice";
import { useAuth } from "../../../shared/hooks/AuthContext";

export default function UpdateOrderModal({ order, onClose, onSuccess }) {
  const { getProducts } = useProductApi();
  const { getPersons } = usePersonApi();
  const { updateOrder, deleteOrder } = useOrderApi();
  const { ensureInvoice } = useInvoiceApi();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [persons, setPersons] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [personId, setPersonId] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [notes, setNotes] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const isAdmin = user?.role === "admin";
  const isCompleted = order?.orderStatus?.toLowerCase() === "completed";
  const canDelete = user?.id === order?.userId || isAdmin;

  // 🔹 LOAD DATA
  useEffect(() => {
    getProducts().then((res) => setProducts(res.data));
    getPersons().then((res) => setPersons(res.data));

    if (order) {
      setPersonId(order.personId?._id || order.personId || "");
      setNotes(order.notes || "");

      const mapped = order.products.map((p) => ({
        productId:
          typeof p.productId === "object" ? p.productId._id : p.productId,
        name:
          p.name ||
          (typeof p.productId === "object" ? p.productId.name : "Unknown"),
        price:
          p.price ||
          (typeof p.productId === "object" ? p.productId.sellingPrice : 0),
        quantity: p.quantity,
      }));

      setSelectedProducts(mapped);
    }
  }, [order]);

  useEffect(() => {
    if (invoice) {
      setTimeout(() => window.print(), 100);
    }
  }, [invoice]);

  // 🔹 ADD PRODUCT
  const addProduct = (product) => {
    if (!isAdmin && isCompleted) return;

    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.productId === product._id);

      if (exists) {
        return prev.map((p) =>
          p.productId === product._id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }

      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: product.sellingPrice,
          quantity: 1,
        },
      ];
    });
  };

  // 🔹 UPDATE QTY
  const updateQty = (id, qty) => {
    if (!isAdmin && isCompleted) return;

    if (qty <= 0) {
      setSelectedProducts((prev) => prev.filter((p) => p.productId !== id));
      return;
    }

    setSelectedProducts((prev) =>
      prev.map((p) => (p.productId === id ? { ...p, quantity: qty } : p)),
    );
  };

  const total = selectedProducts.reduce(
    (acc, p) => acc + p.quantity * p.price,
    0,
  );

  // 🔹 SAVE (PRIMARY ACTION)
  const handleSave = async () => {
    await updateOrder(order._id, {
      products: selectedProducts,
      personId: personId || null,
      notes,
    });

    onSuccess();
  };

  // 🔹 COMPLETE (FROM MENU)
  const completeOrder = async (paymentType) => {
    if (paymentType === "debt" && !personId) {
      return alert("Debt requires customer");
    }

    await updateOrder(order._id, {
      orderStatus: "completed",
      paymentStatus: paymentType,
      personId: personId || null,
      notes,
    });

    const res = await ensureInvoice(order._id);
    setInvoice(res.data);

    onSuccess();
  };

  // 🔹 DELETE
  const handleDelete = async () => {
    if (!window.confirm("Delete this order?")) return;

    try {
      await deleteOrder(order._id);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  const handlePrintInvoice = async () => {
    try {
      const res = await ensureInvoice(order._id);
      setInvoice(res.data);
    } catch {
      alert("Failed to generate invoice");
    }
  };

  return (
    <>
      {/* PRINT */}
      {invoice && (
        <div style={{ position: "absolute", top: "-9999px" }}>
          <Invoice invoice={invoice} />
        </div>
      )}

      {/* MODAL */}
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <div
          className="w-full h-[95vh] md:h-auto md:max-w-lg rounded-t-2xl md:rounded-xl p-4 flex flex-col border"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* HEADER */}
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">Order</h2>

            <div className="flex items-center gap-2 relative">
              <button onClick={onClose}>✕</button>
              <button onClick={() => setShowMenu((p) => !p)}>⋯</button>

              {showMenu && (
                <div
                  className="absolute right-0 top-8 w-44 rounded shadow z-10 text-sm border"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  {!isCompleted && (
                    <>
                      <button
                        onClick={() => completeOrder("paid")}
                        className="block w-full text-left p-2"
                        style={{ color: "var(--color-text)" }}
                      >
                        ✅ Mark Paid
                      </button>

                      <button
                        onClick={() => completeOrder("debt")}
                        className="block w-full text-left p-2"
                        style={{ color: "var(--color-text)" }}
                      >
                        💳 Mark Debt
                      </button>
                    </>
                  )}

                  <button
                    onClick={handlePrintInvoice}
                    className="block w-full text-left p-2"
                  >
                    🧾 Print
                  </button>

                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="block w-full text-left p-2"
                      style={{ color: "var(--color-danger)" }}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* LOCK */}
          {isCompleted && !isAdmin && (
            <div
              className="mb-3 p-2 rounded text-center text-sm"
              style={{
                backgroundColor: "var(--color-border)",
              }}
            >
              🔒 Read-only
            </div>
          )}

          {/* CONTENT */}
          <div className="flex-1 overflow-y-auto space-y-3">
            <select
              disabled={!isAdmin && isCompleted}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="input w-full"
            >
              <option value="">Walk-in</option>
              {persons.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isAdmin && isCompleted}
              placeholder="Order instructions..."
              className="input w-full"
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {products.map((p) => (
                <button
                  key={p._id}
                  onClick={() => addProduct(p)}
                  disabled={!isAdmin && isCompleted}
                  className="px-3 py-2 rounded border whitespace-nowrap"
                  style={{
                    borderColor: "var(--color-border)",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {selectedProducts.map((p) => (
              <div
                key={p.productId}
                className="flex justify-between items-center p-2 rounded border"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div>
                  <p>{p.name}</p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                  >
                    ₱ {p.price}
                  </p>
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => updateQty(p.productId, p.quantity - 1)}
                  >
                    -
                  </button>

                  <span>{p.quantity}</span>

                  <button
                    onClick={() => updateQty(p.productId, p.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <div
            className="sticky bottom-0 pt-3 border-t space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-bold">₱ {total}</span>
            </div>

            {!isCompleted && (
              <>
                <button
                  onClick={handleSave}
                  className="w-full py-3 rounded text-white"
                  style={{
                    backgroundColor: "var(--color-primary)",
                  }}
                >
                  💾 Save
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => completeOrder("paid")}
                    className="py-2 rounded text-white"
                    style={{
                      backgroundColor: "rgba(34,197,94,0.8)",
                    }}
                  >
                    ✅ Paid
                  </button>

                  <button
                    onClick={() => completeOrder("debt")}
                    className="py-2 rounded text-white"
                    style={{
                      backgroundColor: "var(--color-accent)",
                    }}
                  >
                    💰 Debt
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePrintInvoice}
                className="flex-1 py-2 rounded border"
                style={{ borderColor: "var(--color-border)" }}
              >
                🧾 Print
              </button>

              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 rounded border"
                  style={{
                    borderColor: "var(--color-danger)",
                    color: "var(--color-danger)",
                  }}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
