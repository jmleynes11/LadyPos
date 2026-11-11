import CustomerOrders from "./CustomerOrders.jsx";
import { ClothingSizeFields, ClothingSizeSelect } from "../products/components/ClothingSizes.jsx";
import { isClothing, supportsSizes, lineKey, cartLine } from "../products/clothingSizes.js";
import ManagerProductManagement, { ManagerCategoryManagement } from "../products/components/ManagerProductManagement.jsx";
import ProductPhotoInput from "../products/components/ProductPhotoInput.jsx";
import ManagerInventoryOverview, { InventoryProductsTable } from "./InventoryOverview.jsx";
import { canUseResource } from "./capability.js";
import PaymentReview from "./PaymentReview.jsx";
import { directPaymentReview } from "./directCheckout.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useBookstore } from "./bookstoreContext.js";
import { readPending, savePending, clearPending } from "./pendingOperation.js";
import { formatCentavos, parsePesos } from "./money.js";
import { Brand, CatalogFilters, EmptyState, Icon, Modal, Notice, Panel, ProductDetails, ProductVisual, StatCard } from "../../shared/components/BookstoreUI.jsx";
import { bookstoreViews, CANCELLATION_BLOCKER, filterCatalog, ROLE_LABELS } from "./presentation.js";
import { resolveBookstoreView } from "./navigation.js";
import CustomerHome from "./CustomerHome.jsx";
import CashierOrderQueue from "./CashierOrderQueue.jsx";
import CustomerOrderConfirmation from "./CustomerOrderConfirmation.jsx";

const field = "input min-h-11";
const NO_CAPABILITIES = Object.freeze({});
const Button = ({ children, ...props }) => <button className="secondary-action" {...props}>{children}</button>;
export default function BookstorePage() {
  const state = useBookstore();
  if (!state.context) return <Notice error={Boolean(state.error)}>{state.error || "Checking bookstore access…"}</Notice>;
  return <AuthorizedBookstorePage key={state.context.accountId} {...state} />;
}
function AuthorizedBookstorePage({ context, error, api, refresh, cashierQueue }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const views = bookstoreViews(context);
  const checkoutId = context.role === "cashier" ? searchParams.get("checkout") : null;
  const paymentView = context.role === "cashier" && searchParams.get("view") === "payment";
  const view = resolveBookstoreView(context, searchParams.get("view"), views);
  const customerSubmittedId = context.role === "customer" && view === "catalog" ? searchParams.get("submitted") : null;
  const customerConfirmationView = Boolean(customerSubmittedId);
  const [customerSubmission, setCustomerSubmission] = useState(null);
  const customerSubmitting = useRef(false);
  useEffect(() => {
    if (context.role === "cashier" && searchParams.get("view") !== view) {
      const params = new URLSearchParams(searchParams);
      params.set("view", view);
      setSearchParams(params, { replace: true });
    }
  }, [context.role, searchParams, setSearchParams, view]);
  const go = id => setSearchParams({ view: id, ...(context.role === "cashier" && storeId ? { storeId } : {}) });
  const [details, setDetails] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({}), [dialogSize, setDialogSize] = useState("");
  const [sizeStocks, setSizeStocks] = useState({});
  const [search, setSearch] = useState(""), [category, setCategory] = useState("All products");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (context.role === "customer" && view === "catalog" && !customerConfirmationView && location.hash === "#customer-cart" && !loading && !loadError) {
      document.getElementById("customer-cart")?.scrollIntoView({ block: "start" });
    }
  }, [context.role, view, customerConfirmationView, location.hash, loading, loadError]);
  const [catalogMeta, setCatalogMeta] = useState(null), [userTotal, setUserTotal] = useState(null);
  const [dialog, setDialog] = useState(null), [dialogValue, setDialogValue] = useState("");
  const [returnReview, setReturnReview] = useState(null), [returnedUnits, setReturnedUnits] = useState({}), [refundReference, setRefundReference] = useState(""), [repaid, setRepaid] = useState(false);
  const [returnValidated, setReturnValidated] = useState(false);
  const [restored] = useState(() => {
    try { return { operation: readPending(sessionStorage, context.accountId) }; }
    catch { return { blocked: true }; }
  });
  const [selected, setSelected] = useState(() => context.role === "cashier" || customerConfirmationView ? searchParams.get("storeId") || "" : "");
  const selectedStore = context.role === "cashier" || customerConfirmationView ? searchParams.get("storeId") || "" : selected;
  const storeId = context?.stores.some(store => store.id === selectedStore) ? selectedStore : context?.stores[0]?.id || "";
  const refreshCashierQueue = cashierQueue?.refresh;
  const caps = context?.capabilities || NO_CAPABILITIES;
  const loadQueue = context.role !== "store_manager" && (caps["order.fulfill"] || caps["order.oversee"]) && (context.role !== "cashier" || ["overview", "queue"].includes(view));
  const managingProducts = context.role === "store_manager" && view === "products";
  const can = (action, resourceId) => canUseResource(context, action, resourceId);
  const canComplete = orderId => ["sale.process", "payment.record", "receipt.issue"].every(action => can(action, orderId));
  const [products, setProducts] = useState([]), [loadedQueue, setQueue] = useState([]), [history, setHistory] = useState(null), [own, setOwn] = useState([]), [requests, setRequests] = useState([]);
  const queue = context.role === "cashier" && cashierQueue ? cashierQueue.orders || [] : loadedQueue;
  const [cart, setCart] = useState({}), [quote, setQuote] = useState(null), [receipt, setReceipt] = useState(null);
  const [checkout, setCheckout] = useState(null), [pricesConfirmed, setPricesConfirmed] = useState(false), [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const checkoutEstimate = useRef(null);
  const [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(restored.operation || null);
  const pending = useRef(restored.operation || null);
  const loadGeneration = useRef(0);
  const invalidateLoads = useCallback(() => { loadGeneration.current++; }, []);
  const [method, setMethod] = useState("cash"), [paymentReference, setPaymentReference] = useState(""), [paid, setPaid] = useState(false);
  const [photo, setPhoto] = useState(""), [photoBusy, setPhotoBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  const [productForm, setProductForm] = useState({ name: "", sku: "", category: "General", price: "" });
  const [movements, setMovements] = useState(null), [audit, setAudit] = useState(null);
  const [users, setUsers] = useState([]), [targetUser, setTargetUser] = useState(""), [membershipIds, setMembershipIds] = useState(""), [storeName, setStoreName] = useState("");
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!context || !storeId) { setLoading(false); return; }
    setLoading(true); setLoadError("");
    try {
    const [catalog, pendingOrders, sales, personal, reversals, accountCount, categoryResult] = await Promise.all([
      managingProducts ? null : api.get("/products", { params: { storeId, limit: 100 } }),
      context.role === "cashier" && refreshCashierQueue ? refreshCashierQueue() : loadQueue ? api.get("/bookstore/orders/queue", { params: { storeId } }) : null,
      caps["salesHistory.own"] || caps["salesHistory.all"] ? api.get("/bookstore/transactions", { params: { storeId } }) : null,
      caps["order.status.own"] ? api.get("/bookstore/orders/own", { params: { storeId } }) : null,
      (caps["reversal.request"] || caps["reversal.apply"]) ? api.get("/bookstore/reversals", { params: { storeId } }) : null,
      context.canManageAccounts ? api.get("/users", { params: { limit: 1 } }) : null,
      context.role === "store_manager" && caps["category.manage"] ? api.get("/bookstore/categories", { params: { storeId } }) : null,
    ]);
    if (generation !== loadGeneration.current) return;
    const allProducts = [...(catalog?.data.data || [])];
    for (let page = 2; page <= (catalog?.data.pagination?.pages || 1); page++) {
      const next = await api.get("/products", { params: { storeId, limit: 100, page } });
      if (generation !== loadGeneration.current) return;
      allProducts.push(...next.data.data);
    }
    setProducts(allProducts); setQueue(pendingOrders?.data.data.orders || []); setHistory(sales?.data.data || null);
    setOwn(personal?.data.data.orders || []); setRequests(reversals?.data.data.requests || []);
    setCategories(categoryResult?.data.data.categories || []);
    setCatalogMeta(catalog?.data.pagination); setUserTotal(accountCount?.data.total ?? null);
    } catch (err) { if (generation === loadGeneration.current) setLoadError(err.response?.data?.message || "Bookstore data unavailable. Refresh to retry."); }
    finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [api, context, storeId, caps, loadQueue, managingProducts, refreshCashierQueue]);
  useEffect(() => { load().catch(err => setMessage(err.response?.data?.message || "Bookstore data unavailable")); return invalidateLoads; }, [load, invalidateLoads]);

  useEffect(() => {
    if (!paymentView || !storeId || uncertain || restored.blocked) return;
    if (!/^[a-f0-9]{24}$/i.test(checkoutId || "")) { setMessage("A valid checkout reference is required."); return; }
    let active = true;
    setQuoteRefreshing(true); setPaid(false); setPricesConfirmed(false); setQuote(null);
    api.get(`/bookstore/orders/${checkoutId}/quote`, { params: { storeId } }).then(response => {
      if (!active) return;
      const current = response.data.data;
      if (current.orderId !== checkoutId || current.directPayment !== true) throw new Error("Cashier direct checkout response required. Restart or update the backend before retrying.");
      const previous = checkoutEstimate.current;
      const review = directPaymentReview(current, previous?.orderId === checkoutId ? previous : current);
      checkoutEstimate.current = review; setCheckout(review); setQuote(review);
    }).catch(err => { if (active) setMessage(err.response?.data?.message || err.message || "Checkout unavailable"); })
      .finally(() => { if (active) setQuoteRefreshing(false); });
    return () => { active = false; };
  }, [api, checkoutId, paymentView, storeId, uncertain, restored.blocked]);

  const command = async (verb, path, fields, { setup = false, refreshData = true } = {}) => {
    if (pending.current || restored.blocked) return null;
    const operationId = crypto.randomUUID(), body = { ...(setup ? {} : { storeId }), operationId, reason, ...fields };
    const directSubmission = context.role === "cashier" && verb === "post" && path === "/bookstore/orders";
    const marker = { accountId: context.accountId, operationId, storeId, setup, kind: directSubmission ? "directCheckout" : "command" };
    try { savePending(sessionStorage, marker); }
    catch { setMessage("Operation was not sent: reconciliation identity could not be retained."); return null; }
    pending.current = marker; setBusy(true); setMessage("");
    let result;
    try { result = (await (verb === "delete" ? api.delete(path, { data: body }) : api[verb](path, body))).data; }
    catch (err) {
      if (!err.response || err.response.status >= 500 || err.response.data?.operationOutcome === "indeterminate") {
        setUncertain({ ...pending.current, setup }); setMessage("Outcome not confirmed. Retain this operation ID and reconcile before another command.");
      } else { clearPending(sessionStorage, context.accountId); pending.current = null; setMessage(err.response.data?.message || "Command rejected"); if (err.response.status === 403) refresh(); }
      setBusy(false); return null;
    }
    if (directSubmission && !/^[a-f0-9]{24}$/i.test((result.data || result)?.orderId || "")) {
      setUncertain(marker); setBusy(false); setMessage("Checkout response has no valid order reference. Reconcile the retained operation before retrying."); return null;
    }
    // A direct submission retains its marker until its checkout is restored.
    if (!directSubmission) { clearPending(sessionStorage, context.accountId); pending.current = null; }
    setBusy(false); setMessage((result.data || result)?.queueRemoved === true ? "Order deleted successfully." : "Recorded.");
    if (!refreshData && context.role === "cashier") void refreshCashierQueue?.();
    if (refreshData) await load().catch(() => setMessage("Recorded. Refresh data to see the result."));
    return result.data || result;
  };
  const reconcile = async () => {
    setBusy(true);
    try {
      const path = uncertain.setup ? `/users/operations/${uncertain.operationId}` : `/bookstore/operations/${uncertain.operationId}`;
      const acknowledgment = (await api.get(path, { params: { storeId: uncertain.storeId } })).data.data;
      if (acknowledgment.outcome !== "applied" || acknowledgment.operationId !== uncertain.operationId) throw new Error("Operation remains unresolved");
      const result = acknowledgment.result;
      if (result?.payment || uncertain.kind === "directCheckout" || (context.role === "cashier" && !uncertain.setup && !uncertain.kind)) {
        if (result?.operationId !== uncertain.operationId || result?.payment?.orderId !== result?.orderId || result?.orderStatus !== "pending" || !restoreCheckout(result, uncertain.storeId)) {
          setMessage("Operation was acknowledged, but its checkout could not be restored. Retain this operation ID; replacement checkout is blocked."); return;
        }
      }
      clearPending(sessionStorage, context.accountId); pending.current = null; setUncertain(null); setMessage("Acknowledged operation found. No command was repeated."); await load();
    } catch { setMessage("Outcome remains unconfirmed. Retain the operation ID; do not issue a replacement command."); }
    finally { setBusy(false); }
  };
  const restoreCheckout = (result, checkoutStore, estimate = result?.payment) => {
    if (!/^[a-f0-9]{24}$/i.test(result?.orderId || "") || (result.orderStatus && result.orderStatus !== "pending") || !context.stores.some(store => store.id === checkoutStore)) return false;
    // Recovery needs the persisted item/total snapshot. Normal submission already
    // has its cart estimate and only requires the committed order identity.
    if (!estimate || !Array.isArray(estimate.items) || !Number.isSafeInteger(estimate.total)) return false;
    checkoutEstimate.current = { ...estimate, orderId: result.orderId };
    setCart({}); setQuote(null); setCheckout(checkoutEstimate.current); setPricesConfirmed(false); setMethod("cash"); setPaid(false); setPaymentReference("");
    setSearchParams({ view: "payment", checkout: result.orderId, storeId: checkoutStore });
    return true;
  };
  const submitCart = async () => {
    if (pending.current || checkout || (context.role === "customer" && customerSubmitting.current)) return;
    const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([key, quantity]) => cartLine(key, quantity));
    if (context.role === "cashier") {
      if (!items.length || items.some(item => !Number.isSafeInteger(item.quantity))) { setMessage("Add products with positive whole quantities before checkout."); return; }
      const estimate = { total: cartTotal, items: items.map(item => ({ productId: item.product, ...(item.size ? { size: item.size } : {}), unitPrice: products.find(product => product._id === item.product)?.price })) };
      const result = await command("post", "/bookstore/orders", { items, reason: undefined }, { refreshData: false });
      if (result) {
        if (!/^[a-f0-9]{24}$/i.test(result.orderId || "")) { setMessage("Checkout response has no valid order reference. Reconcile the operation before retrying."); return; }
        if (!restoreCheckout(result, storeId, estimate)) { setUncertain(pending.current); setMessage("Checkout restoration is incomplete. Reconcile the retained operation before retrying."); return; }
        clearPending(sessionStorage, context.accountId); pending.current = null;
        setMessage("");
      }
      return;
    }
    if (context.role === "customer") customerSubmitting.current = true;
    try {
      const result = await command("post", "/bookstore/orders", { items, reason: undefined });
      if (result) {
        setCart({});
        if (context.role === "customer") {
          setCustomerSubmission({ ...result, storeId });
          setMessage("");
          setSearchParams({ view: "catalog", submitted: result.orderId, storeId });
        } else if (caps["sale.process"]) await openQuote(result.orderId);
      }
    } finally { if (context.role === "customer") customerSubmitting.current = false; }
  };
  const openQuote = async (orderId, directCheckout = null) => {
    setMessage("");
    if (directCheckout) { setQuoteRefreshing(true); setPaid(false); setPricesConfirmed(false); }
    try {
      const result = (await api.get(`/bookstore/orders/${orderId}/quote`, { params: { storeId } })).data.data;
      if (directCheckout) {
        const review = directPaymentReview(result, directCheckout);
        checkoutEstimate.current = review; setQuote(review); setCheckout(review);
      } else {
        const previous = queue.find(order => order.orderId === orderId);
        setQuote({ ...result, previousTotal: previous?.total, pricesChanged: previous && (previous.total !== result.total || previous.items.some(item => result.items.find(current => current.productId === item.productId && current.size === item.size)?.unitPrice !== item.unitPrice)) });
      }
      setPaid(false); setPaymentReference("");
    }
    catch (err) { if (directCheckout) setQuote(null); setMessage(err.response?.data?.message || "Quote unavailable"); }
    finally { if (directCheckout) setQuoteRefreshing(false); }
  };
  const complete = async () => {
    if (quoteRefreshing || (quote.directCheckout && quote.pricesChanged && !pricesConfirmed)) return;
    const result = await command("post", `/bookstore/orders/${quote.orderId}/complete`, { quote: quote.quote, confirmedTotal: quote.total, paymentConfirmed: paid, paymentMethod: method, paymentReference });
    if (result) { setReceipt(result.receipt); setQuote(null); if (quote.directCheckout) { checkoutEstimate.current = null; setCheckout(null); setSearchParams({ view: "catalog" }, { replace: true }); } }
    else if (quote.directCheckout && !pending.current) await openQuote(quote.orderId, quote);
    setPaid(false);
  };
  const returnSale = async request => {
    setMessage("");
    try {
      const sale = (await api.get(`/bookstore/transactions/${request.orderId}`, { params: { storeId } })).data.data.transactions[0];
      if (!sale) throw new Error("Sale details unavailable");
      setReturnReview({ request, sale }); setReturnedUnits({}); setRefundReference(""); setRepaid(false); setReturnValidated(false);
    } catch (err) { setMessage(err.response?.data?.message || err.message); }
  };
  const returnedItems = () => returnReview.sale.items.map(item => ({ productId: item.productId, ...(item.size ? { size: item.size } : {}), quantity: Number(returnedUnits[lineKey(item.productId, item.size)] || 0) })).filter(item => item.quantity > 0);
  const validateReturn = async () => {
    setBusy(true); setMessage(""); setReturnValidated(false); setRepaid(false);
    try {
      const result = (await api.post(`/bookstore/reversals/${returnReview.request.requestId}/validate`, { storeId, returned: returnedItems() })).data.data;
      if (result.eligible !== true || result.orderId !== returnReview.sale.orderId) throw new Error("Return eligibility could not be confirmed");
      setReturnValidated(true);
    } catch (err) { setMessage(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const recordReturn = async event => {
    event.preventDefault();
    if (!returnValidated || !repaid) return;
    const result = await command("post", `/bookstore/reversals/${returnReview.request.requestId}/apply`, { repaymentConfirmed: repaid, repaymentMethod: returnReview.sale.paymentMethod, refundReference, returnsConfirmed: true, returned: returnedItems() });
    if (result) setReturnReview(null);
  };
  if (!context) return <p role="status">{error || "Checking bookstore access…"}</p>;
  const disabled = busy || Boolean(uncertain) || restored.blocked, mutationDisabled = disabled || !reason.trim();
  const catalogCategory = context.role === "customer" ? searchParams.get("category") || "All products" : category;
  const visibleProducts = filterCatalog(products, search, catalogCategory);
  const browse = nextCategory => {
    setSearch("");
    setSearchParams({ view: "catalog", ...(nextCategory !== "All products" ? { category: nextCategory } : {}) });
  };
  const setCatalogCategory = context.role === "customer" ? nextCategory => {
    const params = new URLSearchParams(searchParams);
    if (nextCategory === "All products") params.delete("category"); else params.set("category", nextCategory);
    setSearchParams(params);
  } : setCategory;
  const available = products.filter(product => product.availability).length;
  const cartItems = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const cartTotal = cartItems.reduce((sum, [id, quantity]) => sum + (products.find(product => product._id === cartLine(id).product)?.price || 0) * quantity, 0);
  const sales = history?.transactions || [];
  const money = value => value === undefined || value === null ? "—" : formatCentavos(value);
  const canOrder = view === "catalog" && !customerConfirmationView && (can("order.submit") || can("sale.process"));
  const customerConfirmedOrder = (!loading && !loadError ? own.find(order => order.orderId === customerSubmittedId) : null) ||
    (customerSubmission?.orderId === customerSubmittedId && customerSubmission?.storeId === storeId ? customerSubmission : null);
  const hasData = !loading && !loadError && (storeId || view === "settings");
  const title = paymentView ? "Review Order / Payment" : views.find(item => item.id === view)?.name || "Overview";
  const openDialog = (kind, product) => { setMessage(""); setDialog({ kind, product }); setDialogSize(""); setDialogValue(kind === "price" ? String(product.price / 100) : ""); };
  const submitDialog = async event => {
    event.preventDefault();
    try {
      let result;
      if (dialog.kind === "price") result = await command("put", `/products/${dialog.product._id}`, { price: parsePesos(dialogValue) });
      if (dialog.kind === "stock") result = await command("patch", `/products/${dialog.product._id}/stock`, { delta: Number(dialogValue), ...(supportsSizes(dialog.product) ? { size: dialogSize } : {}) });
      if (dialog.kind === "archive") result = await command("delete", `/products/${dialog.product._id}`, {});
      if (dialog.kind === "reversal") result = await command("post", `/bookstore/orders/${dialog.product.orderId}/reversals`, {});
      if (result) setDialog(null);
    } catch (err) { setMessage(err.message); }
  };
  const queueTable = context.role === "cashier" && cashierQueue && cashierQueue.orders === null ? <Notice error={Boolean(cashierQueue.error)}>{cashierQueue.error || "Checking pending orders…"}</Notice> : context.role === "cashier" ? <CashierOrderQueue orders={queue} accountId={context.accountId} canClaim={orderId => can("order.fulfill", orderId)} canComplete={canComplete} disabled={disabled} busy={busy} message={message} onClaim={orderId => command("post", `/bookstore/orders/${orderId}/claim`, {})} onReview={openQuote} onRemove={(orderId, orderStatus) => command("post", `/bookstore/orders/${orderId}/remove-from-queue`, orderStatus === "pending" ? { includeUnpaid: true } : {})} /> : <>{queue.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Order reference</th><th>Items</th><th>Total at submission</th><th>Status</th><th>Actions</th></tr></thead><tbody>{queue.map(order => <tr key={order.orderId}><td><strong>{order.reference}</strong><small>{order.assignedTo ? order.assignedTo === context.accountId ? "Assigned to you" : "Assigned to a cashier" : "Awaiting cashier"}</small></td><td>{order.items.map(item => `${item.name}${item.size ? ` (${item.size})` : ""} × ${item.quantity}`).join(", ")}</td><td>{money(order.total)}</td><td><span className="status-pill pending">Unpaid</span></td><td><div className="table-actions">{can("order.fulfill", order.orderId) && !order.assignedTo && <Button disabled={disabled} onClick={() => command("post", `/bookstore/orders/${order.orderId}/claim`, {})}>Claim order</Button>}{canComplete(order.orderId) && order.assignedTo === context.accountId && <Button disabled={disabled} onClick={() => openQuote(order.orderId)}>Review payment</Button>}{context.role === "store_manager" && can("order.oversee", order.orderId) && <button className="secondary-action" disabled title={CANCELLATION_BLOCKER}>Cancellation blocked · AR01</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="The order queue is clear" icon="queue">Submitted unpaid orders appear here. Stock is checked when payment is reviewed.</EmptyState>}</>;
  const historyTable = sales.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Completed (Manila)</th><th>Payment</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{sales.map(sale => <tr key={sale.orderId}><td><strong>{sale.reference}</strong>{caps["salesHistory.all"] && <small>Cashier: {sale.processedBy}</small>}</td><td>{sale.completedAt ? new Date(sale.completedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—"}</td><td className="uppercase">{sale.paymentMethod}</td><td>{money(sale.total)}</td><td><span className={`status-pill ${sale.reversal.length ? "reversed" : "completed"}`}>{sale.reversal.length ? "Reversed" : "Completed"}</span></td><td><div className="table-actions">{sale.invoiceId && <Button onClick={async () => { try { setReceipt((await api.get(`/bookstore/receipts/${sale.invoiceId}`, { params: { storeId } })).data.data.receipt); } catch { setMessage("Receipt access unavailable"); } }}>Receipt</Button>}{can("reversal.request", sale.orderId) && !sale.reversal.length && <Button disabled={mutationDisabled} onClick={() => openDialog("reversal", sale)}>Request reversal</Button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No completed transactions" icon="report">Only completed sales within your authorized history appear here.</EmptyState>;
  const cartPanel = <Panel id={context.role === "customer" ? "customer-cart" : undefined} title="Current order" subtitle={`${cartItems.reduce((sum, [, quantity]) => sum + quantity, 0)} items in your cart`} className="cart-panel">{cartItems.length ? cartItems.map(([id, quantity]) => { const line = cartLine(id, quantity), product = products.find(row => row._id === line.product); return <div className="cart-line-new" key={id}><div><strong>{product?.name || "Unavailable product"}{line.size ? ` (${line.size})` : ""}</strong><small>{money(product?.price)} each</small><div className="cart-quantity"><button aria-label={`Remove one ${product?.name}`} disabled={disabled} onClick={() => setCart(old => ({ ...old, [id]: Math.max(0, old[id] - 1) }))}>−</button><span>{quantity}</span><button aria-label={`Add one ${product?.name}`} disabled={disabled || !product?.availability || (line.size && !product?.sizes?.some(option => option.size === line.size && option.available))} onClick={() => setCart(old => ({ ...old, [id]: old[id] + 1 }))}>+</button></div></div><strong>{money((product?.price || 0) * quantity)}</strong></div>; }) : <EmptyState title="Your cart is empty" icon="bag">Select available products to start an order.</EmptyState>}<div className="cart-total"><span>Estimated total</span><strong>{money(cartTotal)}</strong></div><button className="primary-action" disabled={disabled || Boolean(checkout) || !cartItems.length} onClick={submitCart}>{context.role === "cashier" ? "Submit Order" : "Submit unpaid order"}<Icon name="arrow" size={16} /></button><p className="helper-text">No stock is reserved or deducted on submission. The cashier verifies current prices, availability and full payment.</p></Panel>;
  return <div className="screen-wrap">
    {!customerConfirmationView && <div className={context.role === "customer" ? view === "overview" ? "customer-home-tools" : "customer-shop-heading" : "page-heading"}>{!(context.role === "customer" && view === "overview") && <div>{context.role !== "customer" && <div className="eyebrow">{ROLE_LABELS[context.role] || "Bookstore"} workspace</div>}<h1>{title}</h1><p>{context.role === "customer" ? "Your university essentials, all in one place." : "University of Perpetual Help System DALTA · Bookstore operations"}</p></div>}<div className="heading-actions"><select className={field} aria-label="Selected bookstore" value={storeId} disabled={disabled || loading || Boolean(checkout)} onChange={event => { invalidateLoads(); if (context.role === "cashier") { const params = new URLSearchParams(searchParams); params.set("storeId", event.target.value); setSearchParams(params); } else setSelected(event.target.value); setCart({}); setQuote(null); setReceipt(null); setDialog(null); setReturnReview(null); setMovements(null); setAudit(null); setProducts([]); setQueue([]); setHistory(null); setOwn([]); setRequests([]); }}><option value="" disabled>Select bookstore</option>{context.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select><Button disabled={loading} onClick={load}><Icon name="refresh" size={16} />Refresh</Button></div></div>}
    {restored.blocked && <Notice error>Pending operation metadata is unavailable. Commands are blocked pending reconciliation.</Notice>}
    {message && !customerConfirmationView && <Notice>{message}</Notice>}
    {paymentView && !quote && <Panel title="Review Order / Payment"><p className="helper-text">{quoteRefreshing ? "Checking the checkout reference, current prices and stock…" : "The checkout cannot accept payment until its server quote is available."}</p></Panel>}
    {checkout && !quote && !paymentView && <Panel title="Checkout awaiting payment"><p className="helper-text">Resume this checkout to verify current prices, stock and full payment.</p><Button disabled={disabled || quoteRefreshing} onClick={() => setSearchParams({ view: "payment", checkout: checkout.orderId, storeId })}>Resume checkout</Button></Panel>}
    {uncertain && <Panel title="Operation reconciliation"><Notice>Outcome is unconfirmed. Do not repeat this command.</Notice><code className="block break-all mb-4">{uncertain.operationId}</code><Button onClick={reconcile}>Check acknowledged outcome</Button></Panel>}
    {context.legacyReadOnly && <Panel title="Account awaits role review"><p className="helper-text">Existing records remain available read only. No automatic role conversion is performed.</p><div className="heading-actions mt-4"><Link className="secondary-action" to="/orders">Historical orders</Link><Link className="secondary-action" to="/products">Historical products</Link></div></Panel>}
    {!storeId && !context.legacyReadOnly && <Notice>Bookstore membership has not been assigned. An Administrator must review and assign access.</Notice>}
    {loading && storeId && <Notice>Loading current bookstore records…</Notice>}
    {loadError && <Notice error>{loadError}</Notice>}
    {customerConfirmationView && <CustomerOrderConfirmation key={customerSubmittedId} order={customerConfirmedOrder} loading={loading} error={loadError} />}
    {hasData && <>
      {view === "overview" && context.role === "customer" && <CustomerHome products={products} onBrowse={browse} onProduct={setDetails} onOrders={() => go("my-orders")} />}
      {view === "overview" && !["cashier", "customer"].includes(context.role) && <>
        <div className="welcome-banner"><div><div className="eyebrow">UPHSD BOOKSTORE POS</div><h2>{context.role === "customer" ? "Ready for your next chapter." : context.role === "store_manager" ? "Keep your bookstore moving." : "Your bookstore, at a glance."}</h2><p>{context.role === "customer" ? "Browse available uniforms, books and school supplies. Submit your order and complete payment at the cashier." : "Monitor the records available to your role and move directly into your daily bookstore tasks."}</p></div><img src="/uphsd-seal.png" alt="UPHSD DALTA seal" /></div>
        <div className="stat-grid">
          {context.role === "store_manager" ? <StatCard label="Categories" value={categories.length} detail="Configured product categories" icon="book" /> : context.canManageAccounts ? <StatCard label="Total users" value={userTotal} detail="Current account directory" icon="users" /> : <StatCard label={caps["order.status.own"] ? "My orders" : "Unpaid orders"} value={caps["order.status.own"] ? own.length : queue.length} detail="Current authorized records" icon="queue" />}
          <StatCard label="Total products" value={catalogMeta?.total ?? products.length} detail="Within this bookstore catalog" icon="book" />
          <StatCard label="Available products" value={available} detail="Available at last refresh" icon="inventory" />
          {history ? <StatCard label={caps["salesHistory.all"] ? "Net sales" : "My net sales"} value={money(history.summary.net)} detail="All returned completed history" icon="report" /> : <StatCard label="Categories" value={new Set(products.map(product => product.category).filter(Boolean)).size} detail="From current catalog records" icon="book" />}
        </div>
        <div className="dashboard-columns"><Panel title={history ? "Sales overview" : "Explore the bookstore"} subtitle={history ? "All returned history · PHP · no date filter applied" : "Categories reflect products configured by the bookstore"}>{history ? <><div className="sale-bars">{[["Gross sales", history.summary.gross], ["Confirmed reversals", history.summary.refunded], ["Net sales", history.summary.net]].map(([label, value], index) => <div key={label}><div className="sale-bar-label"><span>{label}</span><strong>{money(value)}</strong></div><div className="sale-bar-track"><div className={`sale-bar-fill ${index === 1 ? "gold" : ""}`} style={{ width: `${Math.max(0, Math.min(100, history.summary.gross ? value / history.summary.gross * 100 : 0))}%` }} /></div></div>)}</div><p className="helper-text">{history.summary.sales} completed sales. Refunds are confirmed recorded reversals.</p></> : <div className="quick-links">{[...new Set(products.map(product => product.category).filter(Boolean))].map(name => <button className="quick-link" key={name} onClick={() => { setCategory(name); go(context.role === "store_manager" ? "products" : "catalog"); }}><Icon name="book" /><span>{name}<small>{products.filter(product => product.category === name).length} products</small></span><Icon name="arrow" /></button>)}{!products.length && <EmptyState title="No products configured" />}</div>}</Panel><Panel title="Workspace shortcuts" subtitle="Actions available to your current account"><div className="quick-links">{views.filter(item => item.id !== "overview").slice(0, 4).map(item => <button className="quick-link" key={item.id} onClick={() => go(item.id)}><Icon name={item.icon} /><span>{item.name}<small>Open {item.name.toLowerCase()}</small></span><Icon name="arrow" /></button>)}</div><p className="helper-text">Availability and permissions are rechecked by the server for every operation.</p></Panel></div>
        {context.role !== "store_manager" && (caps["order.fulfill"] || caps["order.oversee"]) && <Panel title="Unpaid order queue" action={<Button onClick={() => go("queue")}>View queue<Icon name="arrow" size={15} /></Button>}>{queueTable}</Panel>}
      </>}
      {["catalog", "products", "categories", "inventory", "history", "reversals", "settings"].includes(view) && (context.canManageAccounts || ["inventory.adjust", "reversal.request", "order.oversee"].some(key => caps[key])) && <label className="reason-field">Required audit reason<input className={field} placeholder="Explain the change or reversal before continuing" value={reason} onChange={event => setReason(event.target.value)} /><span>Required for administrative changes, stock adjustments and reversal actions.</span></label>}
      {((view === "catalog" && !customerConfirmationView) || (view === "products" && context.role === "store_manager")) && <>
        {view === "products" && caps["product.manage"] && <ManagerProductManagement key={storeId} products={products} categories={categories} api={api} storeId={storeId} command={(verb, path, fields) => command(verb, path, fields, { refreshData: verb !== "delete" })} disabled={disabled} mutationDisabled={mutationDisabled} reason={reason} onReasonChange={setReason} />}
        {view === "catalog" && <>
        <CatalogFilters products={products} search={search} setSearch={setSearch} category={catalogCategory} setCategory={setCatalogCategory} />
        <div className={canOrder ? "catalog-layout" : ""}><div><p className="catalog-count">{visibleProducts.length} of {products.length} products · availability at last refresh</p><div className="product-grid">{visibleProducts.map(product => <article key={product._id} className={`product-card ${product.availability ? "" : "unavailable"}`}><ProductVisual product={product} /><div className="product-card-content"><span className="product-category">{product.category || "General"}</span><h3>{product.name}</h3><p className="product-sku">{product.sku || "No SKU assigned"}</p><button className="product-details-link" onClick={() => setDetails(product)}>View details</button><div className="product-card-bottom"><p className="product-price">{product.moneyUnit === "PHP-centavos" ? money(product.price) : "Unit review required"}</p><span className={`status-pill mt-2 ${product.availability ? "available" : ""}`}>{product.isActive === false ? "Archived" : product.availability ? "Available" : "Out of stock"}{product.stock !== undefined ? ` · ${product.stock} units` : ""}</span>{canOrder && <ClothingSizeSelect product={product} value={selectedSizes[product._id]} disabled={disabled || Boolean(checkout)} onChange={size => setSelectedSizes(old => ({ ...old, [product._id]: size }))} />}{canOrder && <button className="primary-action" disabled={disabled || Boolean(checkout) || !product.availability || product.moneyUnit !== "PHP-centavos" || (supportsSizes(product) && !product.sizes?.some(option => option.size === selectedSizes[product._id] && option.available))} onClick={() => { const key = lineKey(product._id, supportsSizes(product) ? selectedSizes[product._id] : undefined); setCart(old => ({ ...old, [key]: (old[key] || 0) + 1 })); }}>{product.availability ? "Add to order" : "Unavailable"}</button>}<div className="table-actions">{context.role === "admin" && caps["product.price.write"] && <Button disabled={mutationDisabled || product.moneyUnit !== "PHP-centavos"} onClick={() => openDialog("price", product)}>Edit price</Button>}{caps["catalog.manage"] && <Button disabled={mutationDisabled || product.isActive === false} onClick={() => openDialog("archive", product)}>Archive</Button>}{view === "catalog" && can("inventory.adjust", product._id) && context.role === "store_manager" && <Button disabled={mutationDisabled} onClick={() => openDialog("stock", product)}>Adjust stock</Button>}</div></div></div></article>)}</div>{!visibleProducts.length && <Panel title="Catalog results"><EmptyState title="No matching products">Change the search text or category filter.</EmptyState></Panel>}</div>{canOrder && cartPanel}</div>
        </>}
        {(caps["catalog.manage"] || caps["catalog.create"]) && <Panel title="Create product" subtitle={isClothing(productForm.category) ? "Select clothing sizes and their stock quantities." : "Assign a category when creating a product. New products start with zero stock."}><form className="form-stack" onSubmit={async event => { event.preventDefault(); if (photoBusy) return; try { const result = await command("post", "/products", { ...productForm, ...(isClothing(productForm.category) ? { sizeStocks } : {}), ...(photo ? { imageUrl: photo } : {}), price: parsePesos(productForm.price) }); if (result) { setProductForm({ name: "", sku: "", category: "General", price: "" }); setPhoto(""); setSizeStocks({}); } } catch (err) { setMessage(err.message); } }}><div className="grid gap-4 md:grid-cols-2">{["name", "sku", "category", "price"].map(key => <label key={key}>{key === "price" ? "Price (PHP)" : key === "sku" ? "SKU" : key.charAt(0).toUpperCase() + key.slice(1)}<input className={field} required={key !== "sku"} list={context.role === "store_manager" && key === "category" ? "manager-create-categories" : undefined} inputMode={key === "price" ? "decimal" : undefined} value={productForm[key]} onChange={event => setProductForm(old => ({ ...old, [key]: event.target.value }))} /></label>)}</div>{context.role === "store_manager" && <datalist id="manager-create-categories">{categories.map(category => <option key={category.name} value={category.name} />)}</datalist>}<ClothingSizeFields category={productForm.category} value={sizeStocks} onChange={setSizeStocks} disabled={mutationDisabled} stockDisabled={context.role !== "store_manager"} /><ProductPhotoInput value={photo} onChange={setPhoto} disabled={mutationDisabled || photoBusy} onBusyChange={setPhotoBusy} /><div><button className="primary-action" disabled={mutationDisabled || photoBusy || !productForm.name || productForm.price === "" || (isClothing(productForm.category) && !Object.keys(sizeStocks).length)}>Create product</button></div></form><p className="helper-text">{isClothing(productForm.category) ? "Store Managers manage stock separately for each selected size." : "New stock starts at zero. Store Managers receive and adjust inventory separately."}</p></Panel>}
      </>}
      {["products", "categories"].includes(view) && context.role === "store_manager" && caps["category.manage"] && <ManagerCategoryManagement key={storeId} categories={categories} command={command} disabled={disabled} mutationDisabled={mutationDisabled} reason={reason} onReasonChange={setReason} />}
      {view === "queue" && <>{context.role === "store_manager" && <Notice error>{CANCELLATION_BLOCKER}</Notice>}<Panel title={context.role === "cashier" ? "Order queue" : "Unpaid order queue"} subtitle={context.role === "cashier" ? "Submission does not reserve stock. Claim unpaid orders before reviewing payment. Unpaid and cancelled orders can be deleted from active order lists." : "Submission does not reserve stock. A cashier must claim an order before reviewing payment."}>{queueTable}</Panel></>}
      {view === "my-orders" && (context.role === "customer" ? <CustomerOrders key={storeId} orders={own} api={api} storeId={storeId} /> : <Panel title="My orders" subtitle="Your authenticated student orders">{own.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Public order reference</th><th>Status</th></tr></thead><tbody>{own.map(order => <tr key={order.orderId}><td>{order.reference}</td><td><span className={`status-pill ${order.orderStatus}`}>{order.orderStatus === "pending" ? "Unpaid" : order.orderStatus}</span></td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" icon="bag">Browse the catalog and submit your first order.</EmptyState>}</Panel>)}
      {view === "history" && history && <><div className="stat-grid"><StatCard label="Gross sales" value={money(history.summary.gross)} detail="All returned completed history" icon="report" /><StatCard label="Confirmed reversals" value={money(history.summary.refunded)} detail="Recorded whole-sale repayments" icon="refresh" /><StatCard label="Net sales" value={money(history.summary.net)} detail="Gross less confirmed reversals" icon="report" /><StatCard label="Completed sales" value={history.summary.sales} detail="Current authorized scope" icon="bag" /></div><Panel title={caps["salesHistory.all"] ? "All cashier transaction history" : "My transaction history"} subtitle="All available history. Date filtering and export are unavailable.">{historyTable}</Panel></>}
      {view === "reversals" && <Panel title="Refund & void requests" subtitle="Whole-sale reversals only · completed, fully paid sales"><Notice>Repayment follows the original payment method. This system records confirmed repayment; it does not transfer money.</Notice>{requests.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{requests.map(request => <tr key={request.requestId}><td className="break-all">{request.orderId}</td><td>{request.reason}</td><td><span className="status-pill">{request.status}</span></td><td>{context.role === "store_manager" && can("reversal.apply", request.orderId) && can("reversal.approve", request.orderId) && request.status === "requested" && <Button disabled={mutationDisabled} onClick={() => returnSale(request)}>Review repayment & returns</Button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No reversal requests" icon="refresh">Eligible transactions can be submitted for review from transaction history.</EmptyState>}</Panel>}
      {view === "inventory" && <><div className="stat-grid"><StatCard label="Products" value={products.length} detail="Current authorized catalog" icon="book" /><StatCard label="Available" value={available} detail="Active products with stock" icon="inventory" /><StatCard label="Unavailable" value={products.length - available} detail="Out of stock or inactive" icon="inventory" /><StatCard label="Units on hand" value={products.every(product => Number.isSafeInteger(product.stock)) ? products.reduce((sum, product) => sum + product.stock, 0) : null} detail="Reported inventory quantities" icon="inventory" /></div><Panel title="Inventory overview" subtitle="Stock changes require a reason and server authorization.">{context.role === "store_manager" ? <ManagerInventoryOverview products={products} canAdjust={product => can("inventory.adjust", product._id)} disabled={disabled} onAdjust={product => openDialog("stock", product)} /> : <InventoryProductsTable products={products} canAdjust={() => false} />}</Panel><Panel title="Stock movement history" action={<Button onClick={async () => { try { setMovements((await api.get("/bookstore/movements", { params: { storeId } })).data.data.movements); } catch { setMessage("Movement access unavailable"); } }}>Load movement history</Button>}>{movements === null ? <EmptyState title="Load stock movements" icon="inventory">Read the authorized movement ledger for this bookstore.</EmptyState> : movements.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date (Manila)</th><th>Product</th><th>Before → after</th><th>Source</th><th>Reason</th></tr></thead><tbody>{movements.map(row => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td><td>{products.find(product => product._id === row.productId)?.name || row.productId}</td><td>{row.before} → {row.after}{row.sizeChanges?.map(change => <small key={change.size}>{change.size}: {change.before} → {change.after}</small>)}</td><td>{row.source}</td><td>{row.reason}</td></tr>)}</tbody></table></div> : <EmptyState title="No stock movements" />}</Panel></>}
      {view === "settings" && context.canManageAccounts && <><Panel title="Bookstore administration" subtitle="Existing account lifecycle and explicit membership contracts remain in force."><div className="form-stack"><label>New bookstore name<input className={field} value={storeName} onChange={event => setStoreName(event.target.value)} /></label><div><Button disabled={mutationDisabled || !storeName.trim()} onClick={async () => { const result = await command("post", "/bookstore/stores", { name: storeName }, { setup: true }); if (result) { setMembershipIds(result.storeId); setMessage(`Bookstore created: ${result.storeId}. Assign memberships explicitly.`); } }}>Create bookstore</Button></div><div><Button onClick={async () => { try { setUsers((await api.get("/users", { params: { limit: 100 } })).data.users); } catch { setMessage("Account list unavailable"); } }}>Load accounts for membership review</Button></div><label>Reviewed account<select className={field} value={targetUser} onChange={event => setTargetUser(event.target.value)}><option value="">Select reviewed account</option>{users.map(user => <option key={user._id} value={user._id}>{user.identifier} · {ROLE_LABELS[user.role] || user.role}</option>)}</select></label><label>Explicit bookstore IDs<input className={field} placeholder="Comma separated; empty removes memberships" value={membershipIds} onChange={event => setMembershipIds(event.target.value)} /></label><div><Button disabled={mutationDisabled || !targetUser} onClick={async () => { const user = users.find(row => row._id === targetUser); const result = await command("post", `/bookstore/accounts/${targetUser}/memberships`, { storeIds: membershipIds.split(",").map(value => value.trim()).filter(Boolean), expectedVersion: user.securityVersion }, { setup: true }); if (result) { refresh(); setUsers([]); } }}>Apply reviewed memberships</Button></div></div><p className="helper-text">Membership changes invalidate prior sessions. No role or historical resource is mapped automatically. The membership selector loads the first 100 accounts; full account search and lifecycle controls remain under Users & account.</p></Panel><Panel title="Operational audit" action={<Button disabled={!storeId} onClick={async () => { try { setAudit((await api.get("/bookstore/audit", { params: { storeId } })).data.data.events); } catch { setMessage("Audit access unavailable"); } }}>Read audit events</Button>}>{audit === null ? <EmptyState title="Load audit events" icon="shield" /> : audit.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead><tbody>{audit.map(row => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td><td>{row.action}</td><td className="break-all">{row.targetId}</td><td>{row.reason}</td></tr>)}</tbody></table></div> : <EmptyState title="No audit events returned" />}</Panel><Panel title="System settings"><p className="helper-text">General system settings and GCash QR configuration are unavailable in this version. Contact your system Administrator for configuration.</p><Button disabled>GCash QR configuration unavailable</Button></Panel></>}
    </>}
    {context.canManageAccounts && !storeId && <Panel title="Administration access"><Link to="/profile" className="secondary-action">Open account management</Link><p className="helper-text">Open Store settings & audit to create a bookstore. Account membership must be assigned explicitly.</p></Panel>}
    {details && <ProductDetails product={details} price={details.moneyUnit === "PHP-centavos" ? money(details.price) : "Unit review required"} onClose={() => setDetails(null)} />}
    {dialog && <Modal title={dialog.kind === "price" ? "Update product price" : dialog.kind === "stock" ? "Adjust stock" : dialog.kind === "reversal" ? "Request whole-sale reversal" : "Archive product"} busy={busy} onClose={() => setDialog(null)}>{message && <Notice error>{message}</Notice>}<form className="form-stack" onSubmit={submitDialog}><p className="helper-text">{dialog.product.name || dialog.product.reference}</p>{dialog.kind === "stock" && <ClothingSizeSelect product={dialog.product} inventory value={dialogSize} onChange={setDialogSize} disabled={busy} />}{["price", "stock"].includes(dialog.kind) && <label>{dialog.kind === "price" ? "New price (PHP)" : "Quantity change (positive or negative)"}<input className={field} autoFocus required type="number" min={dialog.kind === "price" ? "0" : undefined} step={dialog.kind === "price" ? "0.01" : "1"} value={dialogValue} onChange={event => setDialogValue(event.target.value)} /></label>}<label>Required audit reason<textarea className={field} required value={reason} onChange={event => setReason(event.target.value)} /></label>{dialog.kind === "archive" && <Notice>The product becomes unavailable for new orders. Historical transactions remain preserved.</Notice>}{dialog.kind === "reversal" && <Notice>Manager review and confirmed original-method repayment are required. Submitting this request does not refund money.</Notice>}<div className="modal-actions"><Button type="button" disabled={busy} onClick={() => setDialog(null)}>Back</Button><button className="primary-action" disabled={mutationDisabled || (dialog.kind === "stock" && ((supportsSizes(dialog.product) && !dialogSize) || !Number.isSafeInteger(Number(dialogValue)) || Number(dialogValue) === 0))}>Confirm {dialog.kind === "reversal" ? "request" : "change"}</button></div></form></Modal>}
    {quote && canComplete(quote.orderId) && <PaymentReview quote={quote} message={message} busy={busy || quoteRefreshing} disabled={disabled} method={method} setMethod={setMethod} paymentReference={paymentReference} setPaymentReference={setPaymentReference} paid={paid} setPaid={setPaid} pricesConfirmed={pricesConfirmed} setPricesConfirmed={setPricesConfirmed} onClose={() => { setQuote(null); setPaid(false); if (quote.directCheckout) setSearchParams({ view: "catalog" }); }} onRefresh={() => openQuote(quote.orderId, quote.directCheckout ? quote : null)} onComplete={complete} />}
    {returnReview && <Modal title="Confirm repayment & saleable returns" busy={busy} onClose={() => setReturnReview(null)}>{message && <Notice error>{message}</Notice>}<Notice>Validate the return before manual repayment. A reversal is recorded only after the server confirms it. If recording fails after repayment, retain the repayment reference and retry recording without repaying again. No money transfer is initiated by the POS.</Notice><p className="quote-total">{money(returnReview.sale.total)}</p><p className="helper-text">Repay through original method: {returnReview.sale.paymentMethod.toUpperCase()}</p><form className="form-stack mt-4" onSubmit={recordReturn}>{returnReview.sale.items.map(item => <label key={lineKey(item.productId, item.size)}>Saleable units physically returned: {item.name}{item.size ? ` (${item.size})` : ""} (0–{item.quantity})<input className={field} type="number" min="0" max={item.quantity} step="1" value={returnedUnits[lineKey(item.productId, item.size)] || 0} disabled={disabled} onChange={event => { setReturnValidated(false); setRepaid(false); setReturnedUnits(old => ({ ...old, [lineKey(item.productId, item.size)]: event.target.value })); }} /></label>)}{returnReview.sale.paymentMethod === "gcash" && <label>Confirmed GCash refund reference<input className={field} required value={refundReference} onChange={event => setRefundReference(event.target.value)} /></label>}<label>Required audit reason<textarea className={field} required value={reason} onChange={event => setReason(event.target.value)} /></label><button type="button" className="secondary-action" disabled={disabled} onClick={validateReturn}>Validate return eligibility</button>{returnValidated && <Notice>Return eligibility checked. No reversal has been recorded. Confirm manual repayment, then record the reversal.</Notice>}<label className="checkbox-row"><input type="checkbox" disabled={disabled || !returnValidated} checked={repaid} onChange={event => setRepaid(event.target.checked)} />I confirm full repayment through the original payment method and the assessed saleable returns.</label><div className="modal-actions"><button className="primary-action" disabled={mutationDisabled || !returnValidated || !repaid || (returnReview.sale.paymentMethod === "gcash" && !refundReference.trim())}>Record confirmed reversal</button></div></form></Modal>}
    {receipt && <Modal title="Sale receipt" onClose={() => setReceipt(null)}><div id="print-area" className="receipt-paper"><img src="/uphsd-seal.png" alt="UPHSD DALTA seal" /><h2>UPHSD Bookstore POS</h2><p>{receipt.invoiceNumber}</p>{receipt.reversed && <Notice>Reversed · Original amounts retained</Notice>}{receipt.items.map(item => <div className="receipt-line" key={lineKey(item.productId, item.size)}><span>{item.name}{item.size ? ` (${item.size})` : ""} × {item.quantity}</span><strong>{money(item.subtotal)}</strong></div>)}<div className="cart-total"><span>Total</span><strong>{money(receipt.total)}</strong></div><p>{receipt.paymentMethod?.toUpperCase()} · {receipt.paymentReference}</p></div><div className="modal-actions"><Button onClick={() => window.print()}>Print receipt</Button></div></Modal>}
  </div>;
}





