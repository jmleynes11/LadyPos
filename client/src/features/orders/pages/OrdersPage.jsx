import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useOrderApi } from "../services/ordersApi";
import { useInvoiceApi } from "../../invoices/services/invoiceApi";

const formatMoney = (centavos = 0) =>
  `PHP ${(Number(centavos) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "None";

const toCentavos = (value) => Math.round((Number(value) || 0) * 100);
const customerName = (order) => order.customer?.name || order.personId?.name || "Walk-in";
const itemCount = (order) => (order.items || order.products || []).reduce((sum, item) => sum + item.quantity, 0);

export default function OrdersPage({ readOnly = false }) {
  const { getOrders, updateOrder, markOrderPaid, deleteOrder } = useOrderApi();
  const { ensureInvoice } = useInvoiceApi();
  const location = useLocation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [tab, setTab] = useState(location.pathname === "/transactions" ? "completed" : "pending");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [paymentSheet, setPaymentSheet] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await getOrders({ limit: 200 });
      setOrders(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (location.pathname === "/transactions") setTab("completed");
  }, [location.pathname]);

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.orderStatus === "pending").length,
      completed: orders.filter((order) => order.orderStatus === "completed").length,
      debt: orders.filter((order) => order.balance > 0 && order.orderStatus === "completed").length,
    }),
    [orders],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesTab =
        tab === "pending"
          ? order.orderStatus === "pending"
          : tab === "debt"
            ? order.orderStatus === "completed" && order.balance > 0
            : order.orderStatus === "completed";
      const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
      const matchesType = typeFilter === "all" || order.customerType === typeFilter;
      const matchesSearch =
        !needle ||
        customerName(order).toLowerCase().includes(needle) ||
        order.reference?.toLowerCase().includes(needle) ||
        order.invoice?.invoiceNumber?.toLowerCase().includes(needle);
      return matchesTab && matchesPayment && matchesType && matchesSearch;
    });
  }, [orders, tab, paymentFilter, typeFilter, search]);

  const completeOrder = async (payload) => {
    if (!paymentSheet?.order) return;
    const order = paymentSheet.order;
    const key = `${paymentSheet.mode}-${order._id}`;
    setActionLoading(key);
    try {
      if (paymentSheet.mode === "settle") {
        await markOrderPaid(order._id, payload);
        toast.success("Debt marked paid");
      } else {
        await updateOrder(order._id, {
          orderStatus: "completed",
          ...payload,
        });
        toast.success("Order completed");
      }
      setPaymentSheet(null);
      setSelected(null);
      await loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  const voidOrder = async (order) => {
    if (!window.confirm("Void this order?")) return;
    setActionLoading(`void-${order._id}`);
    try {
      await deleteOrder(order._id);
      toast.success("Order voided");
      setSelected(null);
      await loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Void failed");
    } finally {
      setActionLoading("");
    }
  };

  const printInvoice = async (order) => {
    setActionLoading(`invoice-${order._id}`);
    try {
      await ensureInvoice(order._id);
      toast.success("Invoice is ready");
      await loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Invoice failed");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="orders-shell">
      <header className="orders-toolbar">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-[var(--color-muted)]">Complete sales, settle debt, and check invoices.</p>
        </div>
        <div className="orders-nav">
          <Link to="/pos" className="secondary-action inline-flex items-center justify-center gap-2">
            <span aria-hidden="true">+</span>
            POS
          </Link>
          <Link to="/customers" className="secondary-action inline-flex items-center justify-center gap-2">
            <span aria-hidden="true">C</span>
            Customers
          </Link>
          <Link to="/transactions" className="secondary-action inline-flex items-center justify-center gap-2">
            <span aria-hidden="true">T</span>
            Transactions
          </Link>
        </div>
      </header>

      <section className="orders-filters">
        <input
          className="input min-h-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer, reference, invoice"
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <select className="input min-h-11" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="debt">Debt</option>
          </select>
          <select className="input min-h-11" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="walkin">Walk-in</option>
            <option value="customer">Customer</option>
            <option value="grab">Grab</option>
            <option value="foodpanda">Foodpanda</option>
          </select>
          <Link to="/transactions" className="secondary-action inline-flex items-center justify-center">
            Transactions
          </Link>
          <button className="secondary-action" onClick={loadOrders} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <nav className="tab-row orders-tabs" aria-label="Order status">
        {[
          ["pending", `Pending ${counts.pending}`],
          ["completed", `Completed ${counts.completed}`],
          ["debt", `Debt ${counts.debt}`],
        ].map(([value, label]) => (
          <button key={value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </nav>

      <main className="orders-list">
        {loading && <p className="text-sm text-[var(--color-muted)]">Loading orders...</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-[var(--color-muted)]">No orders found</p>}
        {filtered.map((order) => (
          <OrderCard
            key={order._id}
            order={order}
            selected={selected?._id === order._id}
            busy={actionLoading.endsWith(order._id)}
            onSelect={() => setSelected((current) => (current?._id === order._id ? null : order))}
            onComplete={() => setPaymentSheet({ mode: "complete", order })}
            onSettle={() => setPaymentSheet({ mode: "settle", order })}
            onInvoice={() => printInvoice(order)}
            onVoid={() => voidOrder(order)}
            readOnly={readOnly}
          />
        ))}
      </main>

      {paymentSheet && (
        <PaymentSheet
          mode={paymentSheet.mode}
          order={paymentSheet.order}
          busy={Boolean(actionLoading)}
          onClose={() => setPaymentSheet(null)}
          onSubmit={completeOrder}
        />
      )}
    </div>
  );
}

function OrderCard({ order, selected, busy, onSelect, onComplete, onSettle, onInvoice, onVoid, readOnly }) {
  const status = order.paymentStatus || "debt";
  return (
    <article className={`order-card ${selected ? "selected" : ""}`}>
      <button className="order-main" onClick={onSelect}>
        <span className="min-w-0">
          <strong>{customerName(order)}</strong>
          <small>{formatDateTime(order.createdAt)}</small>
        </span>
        <span>
          <strong>{formatMoney(order.totalAmount ?? order.total)}</strong>
          <small>{itemCount(order)} items</small>
        </span>
        <span className={`status-chip ${order.orderStatus}`}>{order.orderStatus}</span>
        <span className={`status-chip ${status}`}>{status}</span>
      </button>

      <div className="order-meta">
        <span>Method: {(order.paymentMethod || "cash").toUpperCase()}</span>
        <span>Type: {order.customerType || "customer"}</span>
        <span>Invoice: {order.invoice?.status || "not issued"}</span>
        <span>Debt: {formatMoney(order.balance)}</span>
        <span>Ref: {order.paymentReference || order.reference || "none"}</span>
        <span>Processed: {order.processedBy?.name || order.processedBy?.identifier || "Current user"}</span>
      </div>

      {selected && (
        <div className="order-detail">
          <div className="space-y-2">
            {(order.items || order.products || []).map((item) => (
              <div key={item.product?._id || item.product || item.productId} className="cart-line">
                <span>{item.product?.name || item.productId?.name || "Product"}</span>
                <span>x {item.quantity}</span>
                <strong>{formatMoney(item.subtotal ?? item.quantity * (item.unitPrice ?? item.price ?? 0))}</strong>
              </div>
            ))}
          </div>
          {order.notes && <p className="order-note">{order.notes}</p>}
        </div>
      )}

      <div className="order-actions">
        {!readOnly && order.orderStatus === "pending" && (
          <button className="primary-action" onClick={onComplete} disabled={busy}>
            Complete Sale
          </button>
        )}
        {!readOnly && order.orderStatus === "completed" && order.balance > 0 && (
          <button className="primary-action" onClick={onSettle} disabled={busy}>
            Settle Debt
          </button>
        )}
        {order.orderStatus === "completed" && (
          <button className="secondary-action" onClick={onInvoice} disabled={busy}>
            Invoice
          </button>
        )}
        {!readOnly && <button className="secondary-action danger-action" onClick={onVoid} disabled={busy}>
          Void
        </button>}
      </div>
    </article>
  );
}

function PaymentSheet({ mode, order, busy, onClose, onSubmit }) {
  const [paymentStatus, setPaymentStatus] = useState(mode === "settle" ? "paid" : "paid");
  const [paymentMethod, setPaymentMethod] = useState(mode === "settle" ? "cash" : "cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const needsReference = ["gcash", "bank"].includes(paymentMethod);
  const partial = paymentStatus === "partial";
  const disabled = busy || (needsReference && !paymentReference.trim()) || (partial && toCentavos(amountPaid) <= 0);

  const submit = () => {
    onSubmit({
      paymentStatus,
      paymentMethod,
      paymentReference,
      amountPaid: partial ? toCentavos(amountPaid) : undefined,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet action-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="cart-grip" onClick={onClose} aria-label="Close payment" />
        <h2 className="text-lg font-semibold">{mode === "settle" ? "Settle Debt" : "Complete Sale"}</h2>
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          {customerName(order)} • {formatMoney(mode === "settle" ? order.balance : order.totalAmount)}
        </p>

        {mode === "complete" && (
          <div className="grid grid-cols-3 gap-2">
            {["paid", "partial", "debt"].map((status) => (
              <button
                key={status}
                className={`pay-method ${paymentStatus === status ? "selected" : ""}`}
                onClick={() => setPaymentStatus(status)}
                type="button"
              >
                {status.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {partial && (
          <input
            className="input min-h-11"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
            placeholder="Amount paid"
          />
        )}

        <div className="grid grid-cols-4 gap-2">
          {["cash", "gcash", "bank", "credit"].map((method) => (
            <button
              key={method}
              className={`pay-method ${paymentMethod === method ? "selected" : ""}`}
              onClick={() => setPaymentMethod(method)}
              type="button"
            >
              {method.toUpperCase()}
            </button>
          ))}
        </div>

        {needsReference && (
          <input
            className="input min-h-11"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            placeholder={paymentMethod === "bank" ? "Bank reference number" : "GCash reference number"}
          />
        )}

        <div className="sticky-action-row">
          <button className="secondary-action" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary-action" onClick={submit} disabled={disabled}>
            {busy ? "Processing..." : mode === "settle" ? "Mark Paid" : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
