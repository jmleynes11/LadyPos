import { ClothingSizeSelect } from "../products/components/ClothingSizes.jsx";
import { supportsSizes, lineKey } from "../products/clothingSizes.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createGuestSession, attachGuestSessionEvents } from "./guestSession.js";
import { guestRequest } from "./guestApi.js";
import { createGuestCheckout } from "./guestCheckout.js";
import { formatCentavos } from "../bookstore/money.js";
import { useAuth } from "../../shared/hooks/AuthContext.jsx";
import { Brand, CatalogFilters, EmptyState, Icon, Notice, Panel, ProductDetails, ProductVisual } from "../../shared/components/BookstoreUI.jsx";
import { filterCatalog } from "../bookstore/presentation.js";
import OrderConfirmation from "./OrderConfirmation.jsx";
import "./guest-confirmation.css";
import GuestHome from "./GuestHome.jsx";
import "./guest-storefront.css";

export default function KioskPage() {
  const { logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "shop" ? "shop" : "home";
  const category = params.get("category") || "All products";
  const setCategory = value => setParams({ view: "shop", ...(value !== "All products" ? { category: value } : {}) });
  const session = useRef(null), activeRequest = useRef(null), checkout = useRef(null), catalogRequest = useRef(null);
  const [state, setState] = useState({ cart: [], proof: null, generation: 0 });
  const [catalog, setCatalog] = useState([]), [message, setMessage] = useState(""), [status, setStatus] = useState(null), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [details, setDetails] = useState(null);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [search, setSearch] = useState(""), [loading, setLoading] = useState(true), [catalogError, setCatalogError] = useState("");
  const loadCatalog = useCallback(async () => {
    catalogRequest.current?.abort();
    const controller = new AbortController(); catalogRequest.current = controller;
    setLoading(true); setCatalogError("");
    try {
      const result = await guestRequest("/catalog", { signal: controller.signal });
      if (!Array.isArray(result.products)) throw new Error("Guest catalog returned an invalid response. Retry shortly.");
      if (!controller.signal.aborted) setCatalog(result.products);
    } catch (error) { if (!controller.signal.aborted) setCatalogError(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    logout(); // entering explicit guest mode clears any prior local account
    let lastGeneration = 0;
    const current = createGuestSession({ onChange: value => {
      setState(value);
      if (value.generation !== lastGeneration) {
        activeRequest.current?.abort(); checkout.current?.reset();
        setStatus(null); setDetails(null); setSelectedSizes({}); setMessage(""); setBusy(false); setUncertain(false);
      }
      lastGeneration = value.generation;
    } });
    session.current = current;
    checkout.current = createGuestCheckout(current, guestRequest);
    const detach = attachGuestSessionEvents(document, current);
    loadCatalog();
    return () => { catalogRequest.current?.abort(); activeRequest.current?.abort(); checkout.current?.reset(); detach(); session.current = null; };
  }, [logout, loadCatalog]);
  const submit = async () => {
    if (!session.current || busy) return;
    const current = session.current, generation = current.beginSubmission(), controller = new AbortController();
    activeRequest.current = controller; setBusy(true); setMessage("");
    try {
      const result = await checkout.current.submit({ signal: controller.signal });
      if (!result || current.read().generation !== generation) return;
      setUncertain(false);
      setStatus({ reference: result.reference, orderStatus: result.orderStatus });
      setMessage("Unpaid order submitted. Pay at the cashier. Stock is not reserved.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setUncertain(Boolean(error.uncertain));
      setMessage(error.uncertain ? "Submission outcome is unconfirmed. Check order status or retry this same submission safely." : error.status === 403 ? "Guest access expired or is invalid. Submit again to initialize new guest access." : error.message);
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const track = async event => {
    event?.preventDefault(); if (!session.current || busy) return;
    const current = session.current, before = current.read(), controller = new AbortController();
    if (!before.proof?.intentId || !before.proof?.credential) return;
    activeRequest.current = controller; setBusy(true);
    try {
      const result = await guestRequest(`/orders/${encodeURIComponent(before.proof.intentId)}`, { credential: before.proof.credential, signal: controller.signal });
      if (typeof result.reference !== "string" || !result.reference || typeof result.orderStatus !== "string") throw new Error("Guest ordering returned an invalid status. Retry shortly.");
      if (current.acceptProof(before.generation, { ...before.proof, reference: result.reference })) { checkout.current?.reset(); setStatus(result); setUncertain(false); setMessage("Order status loaded."); }
    } catch (error) { if (!controller.signal.aborted) setMessage(error.status === 403 ? "Private credential is invalid or expired" : error.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const add = (product, size = supportsSizes(product) ? selectedSizes[product.productId] : undefined) => {
    if (supportsSizes(product) && !product.sizes?.some(option => option.size === size && option.available)) return;
    const current = session.current; if (!current) return;
    const cart = current.read().cart, found = cart.find(item => item.product === product.productId && item.size === size);
    if (found) found.quantity++; else cart.push({ product: product.productId, quantity: 1, ...(size ? { size } : {}) });
    current.setCart(cart);
  };
  const filtered = filterCatalog(catalog, search, category);
  const total = state.cart.reduce((sum, item) => sum + (catalog.find(product => product.productId === item.product)?.price || 0) * item.quantity, 0);
  const browse = value => { if (status) session.current?.reset(); setSearch(""); setCategory(value); };
  const navigate = () => { if (status) session.current?.reset(); setDetails(null); };
  const signOut = () => { session.current?.reset(); logout(); };
  return <div className="kiosk-shell guest-store">
    <div className="guest-store-ribbon">Your campus. Your essentials. Your bookstore.</div>
    <header className="guest-store-header"><div className="guest-store-brand"><Brand compact /></div><nav className="guest-store-nav" aria-label="Guest shopping navigation"><Link to="/kiosk" onClick={navigate} aria-current={view === "home" && !status ? "page" : undefined}>Home</Link><Link to="/kiosk?view=shop" onClick={navigate} aria-current={view === "shop" || status ? "page" : undefined}>Shop</Link></nav><Link className="guest-store-signout" to="/login" onClick={signOut}>Sign out</Link></header>
    <main className="kiosk-main guest-store-main">
      {(view === "shop" || status || uncertain) && <div className={status ? "guest-confirmation-actions" : "page-heading"}>{!status && <div><h1>Shop</h1><p>Browse. Place your order. Pay at the cashier.</p></div>}<button className="secondary-action" onClick={() => session.current?.reset()}><Icon name="refresh" size={16} />Finish / New Order</button></div>}
      {message && (!status || uncertain) && <Notice error={uncertain}>{message}</Notice>}
      {loading && <Notice>Loading the bookstore catalog…</Notice>}
      {catalogError && <Notice error>{catalogError} <button className="secondary-action" disabled={loading} onClick={loadCatalog}>Retry catalog</button></Notice>}
      {uncertain && <div className="heading-actions"><button className="secondary-action" disabled={busy} onClick={submit}>{busy ? "Retrying…" : "Retry same submission"}</button>{state.proof?.intentId && <button className="secondary-action" disabled={busy} onClick={track}>Check order status</button>}</div>}
      {!status && !uncertain && !loading && !catalogError && view === "home" && <GuestHome products={catalog} onBrowse={browse} onProduct={setDetails} />}
      {!status && !uncertain && !loading && !catalogError && view === "shop" && <>
        <CatalogFilters products={catalog} search={search} setSearch={setSearch} category={category} setCategory={setCategory} />
        <div className="catalog-layout"><section aria-label="Bookstore products"><p className="catalog-count">{filtered.length} of {catalog.length} products · availability at last refresh</p><div className="product-grid">{filtered.map(product => <article key={product.productId} className={`product-card ${product.availability ? "" : "unavailable"}`}><ProductVisual product={product} /><div className="product-card-content"><span className="product-category">{product.category || "General"}</span><h3>{product.name}</h3><p className="product-sku">{product.sku || "No SKU assigned"}</p><button className="product-details-link" onClick={() => setDetails(product)}>View details</button><div className="product-card-bottom"><p className="product-price">{formatCentavos(product.price)}</p><span className={`status-pill mt-2 ${product.availability ? "available" : ""}`}>{product.availability ? "Available" : "Out of stock"}</span><ClothingSizeSelect product={product} value={selectedSizes[product.productId]} disabled={busy} onChange={size => setSelectedSizes(old => ({ ...old, [product.productId]: size }))} /><button className="primary-action" disabled={busy || !product.availability || (supportsSizes(product) && !product.sizes?.some(option => option.size === selectedSizes[product.productId] && option.available))} onClick={() => add(product)}>{product.availability ? "Add to order" : "Unavailable"}</button></div></div></article>)}</div>{!filtered.length && <Panel title="Catalog results"><EmptyState title="No matching products">Change the search text or category filter.</EmptyState></Panel>}</section>
        <Panel title="Your order" subtitle={`${state.cart.reduce((sum, item) => sum + item.quantity, 0)} items in your cart`} className="cart-panel">{state.cart.length ? state.cart.map(item => { const product = catalog.find(row => row.productId === item.product); return <div className="cart-line-new" key={lineKey(item.product, item.size)}><div><strong>{product?.name}{item.size ? ` (${item.size})` : ""}</strong><small>{formatCentavos(product?.price || 0)} each</small><div className="cart-quantity"><button aria-label={`Remove one ${product?.name}`} disabled={busy} onClick={() => session.current?.setCart(session.current.read().cart.map(row => row.product === item.product && row.size === item.size ? { ...row, quantity: row.quantity - 1 } : row).filter(row => row.quantity > 0))}>−</button><span>{item.quantity}</span><button aria-label={`Add one ${product?.name}`} disabled={busy || !product?.availability} onClick={() => add(product, item.size)}>+</button></div></div><strong>{formatCentavos((product?.price || 0) * item.quantity)}</strong></div>; }) : <EmptyState title="Your cart is empty" icon="bag">Add available products to start your bookstore order.</EmptyState>}<div className="cart-total"><span>Estimated total</span><strong>{formatCentavos(total)}</strong></div><button className="primary-action" disabled={busy || !state.cart.length} onClick={submit}>{busy ? "Submitting…" : "Submit unpaid order"}<Icon name="arrow" size={16} /></button><p className="helper-text">Stock is not reserved. Current prices, stock and full cash or GCash payment are verified at the cashier.</p></Panel></div>
      </>}
      {details && <ProductDetails product={details} price={formatCentavos(details.price)} onClose={() => setDetails(null)} />}
      {status && <OrderConfirmation key={status.reference} status={status} />}
      <p className="helper-text">For your privacy, this kiosk clears after five minutes of inactivity, on Finish / New Order, and on reload.</p>
    </main><footer className="guest-store-footer"><Brand compact /><p>University of Perpetual Help System DALTA<br />Your university essentials, all in one place.</p></footer>
  </div>;
}


