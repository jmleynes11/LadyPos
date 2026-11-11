import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePersonApi } from "../services/api";

const formatMoney = (centavos = 0) =>
  `PHP ${(Number(centavos) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toCentavos = (value) => Math.round((Number(value) || 0) * 100);
const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "None";

export default function PersonsPage({ readOnly = false }) {
  const params = useParams();
  if (params.id) return <CustomerProfile id={params.id} readOnly={readOnly} />;
  return <CustomerList readOnly={readOnly} />;
}

function CustomerList({ readOnly }) {
  const { getPersons, createPerson } = usePersonApi();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [debtStatus, setDebtStatus] = useState("all");
  const [name, setName] = useState("");

  const load = async () => {
    const res = await getPersons({
      search,
      debtStatus: debtStatus === "all" ? undefined : debtStatus,
      limit: 50,
      sortBy: debtStatus === "withDebt" ? "totalDebt" : "name",
    });
    setCustomers(res.data);
  };

  useEffect(() => {
    load();
  }, [search, debtStatus]);

  const addCustomer = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createPerson({ name: trimmed });
    setName("");
    load();
  };

  return (
    <div className="screen-wrap">
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] pb-3">
        <h1 className="mb-3 text-xl font-semibold">Customers</h1>
        <input
          className="input min-h-11"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or phone"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {[
            ["all", "All"],
            ["withDebt", "With Debt"],
            ["paid", "Paid"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`filter-chip ${debtStatus === value ? "selected" : ""}`}
              onClick={() => setDebtStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!readOnly && <div className="mb-4 flex gap-2">
        <input
          className="input min-h-11"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New customer"
        />
        <button className="secondary-action" onClick={addCustomer}>
          Add
        </button>
      </div>}

      <div className="space-y-3">
        {customers.map((customer) => (
          <button
            key={customer._id}
            className="customer-card"
            onClick={() => navigate(`/customers/${customer._id}`)}
          >
            <span>
              <strong>{customer.name}</strong>
              <small>
                {customer.phone || customer.contactInfo || "No phone"}
              </small>
            </span>
            <span
              className={customer.totalDebt > 0 ? "debt-text" : "paid-text"}
            >
              {customer.totalDebt > 0
                ? formatMoney(customer.totalDebt)
                : "Paid"}
              <small>{formatDate(customer.lastTransaction)}</small>
            </span>
          </button>
        ))}
        {customers.length === 0 && (
          <p className="text-center text-sm text-[var(--color-muted)]">
            No customers found
          </p>
        )}
      </div>
    </div>
  );
}

function CustomerProfile({ id, readOnly }) {
  const { getPersonById, addPayment } = usePersonApi();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("transactions");
  const [detail, setDetail] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const load = async () => {
    const res = await getPersonById(id, { limit: 20 });
    setProfile(res.data);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!profile) return <div className="screen-wrap">Loading...</div>;

  const { customer, transactions, payments, debtSummary } = profile;

  return (
    <div className="screen-wrap pb-28">
      <header className="profile-head">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {customer.phone || customer.contactInfo || "No phone"}
          </p>
        </div>
        <span
          className={`debt-badge ${debtSummary.totalDebt > 0 ? "danger" : "ok"}`}
        >
          {formatMoney(debtSummary.totalDebt)}
        </span>
      </header>

      <div className="summary-strip">
        <SummaryCard label="Total Orders" value={debtSummary.totalOrders} />
        <SummaryCard
          label="Total Spent"
          value={formatMoney(debtSummary.totalSpent)}
        />
        <SummaryCard
          label="Outstanding"
          value={formatMoney(debtSummary.totalDebt)}
        />
        <SummaryCard
          label="Last Sale"
          value={formatDate(debtSummary.lastTransaction)}
        />
      </div>

      <div className="tab-row">
        <button
          className={tab === "transactions" ? "selected" : ""}
          onClick={() => setTab("transactions")}
        >
          Transactions
        </button>
        <button
          className={tab === "payments" ? "selected" : ""}
          onClick={() => setTab("payments")}
        >
          Debt Payments
        </button>
      </div>

      {tab === "transactions" ? (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <button
              key={transaction._id}
              className="transaction-row"
              onClick={() => setDetail(transaction)}
            >
              <span>
                <strong>
                  {transaction.invoice?.invoiceNumber || "No invoice"}
                </strong>
                <small>{formatDate(transaction.createdAt)}</small>
              </span>
              <span>
                <strong>{formatMoney(transaction.totalAmount)}</strong>
                <small>Paid {formatMoney(transaction.amountPaid)}</small>
              </span>
              <span className={`status-chip ${transaction.paymentStatus}`}>
                {transaction.paymentStatus}
              </span>
              <span className="debt-text">
                {formatMoney(transaction.balance)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div key={payment._id} className="payment-row">
              <span>
                <strong>{formatMoney(payment.amountPaid)}</strong>
                <small>{formatDate(payment.paidAt)}</small>
              </span>
              <span>{payment.paymentMethod?.toUpperCase()}</span>
              <small>
                {payment.transaction ? "Linked invoice" : "General payment"}
              </small>
            </div>
          ))}
        </div>
      )}

      {!readOnly && <button className="fab" onClick={() => setPaymentOpen(true)}>
        Record Payment
      </button>}

      {detail && (
        <TransactionDrawer
          transaction={detail}
          onClose={() => setDetail(null)}
        />
      )}
      {paymentOpen && (
        <PaymentSheet
          transactions={transactions}
          onClose={() => setPaymentOpen(false)}
          onSubmit={async (data) => {
            await addPayment(id, data);
            setPaymentOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function TransactionDrawer({ transaction, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="cart-grip"
          onClick={onClose}
          aria-label="Close transaction"
        />
        <h2 className="mb-3 text-lg font-semibold">
          {transaction.invoice?.invoiceNumber || "Transaction"}
        </h2>
        <div className="space-y-2">
          {transaction.items.map((item) => (
            <div key={item.product?._id || item.product} className="cart-line">
              <span>{item.product?.name || "Product"}</span>
              <span>x {item.quantity}</span>
              <strong>{formatMoney(item.subtotal)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaymentSheet({ transactions, onClose, onSubmit }) {
  const unpaid = useMemo(
    () => transactions.filter((transaction) => transaction.balance > 0),
    [transactions],
  );
  const [transaction, setTransaction] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="cart-grip"
          onClick={onClose}
          aria-label="Close payment"
        />
        <h2 className="mb-3 text-lg font-semibold">Record Payment</h2>
        <div className="space-y-3">
          <select
            className="input min-h-11"
            value={transaction}
            onChange={(event) => setTransaction(event.target.value)}
          >
            <option value="">General payment</option>
            {unpaid.map((item) => (
              <option key={item._id} value={item._id}>
                {item.invoice?.invoiceNumber || formatDate(item.createdAt)} -{" "}
                {formatMoney(item.balance)}
              </option>
            ))}
          </select>
          <input
            className="input min-h-11"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount"
          />
          <div className="grid grid-cols-3 gap-2">
            {["cash", "gcash", "credit"].map((method) => (
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
          <textarea
            className="input min-h-20"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
          />
          <button
            className="primary-action"
            onClick={() =>
              onSubmit({
                transaction: transaction || undefined,
                amountPaid: toCentavos(amount),
                paymentMethod,
                notes,
              })
            }
          >
            Save payment
          </button>
        </div>
      </div>
    </div>
  );
}
