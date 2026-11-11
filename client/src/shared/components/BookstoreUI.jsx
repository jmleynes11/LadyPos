import { useEffect, useRef, useState } from "react";

export function Icon({ name = "book", size = 20, ...props }) {
  const paths = {
    book: "M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4V4Zm8 1v15",
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    bag: "M5 7h14l1 14H4L5 7Zm3 0V6a4 4 0 0 1 8 0v1",
    inventory: "m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l10 4",
    queue: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    report: "M5 3h10l4 4v14H5V3Zm10 0v5h4M9 17v-4M12 17v-7M15 17v-5",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    close: "m6 6 12 12M6 18 18 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    logout: "M9 4H4v16h5M9 12h12m-4-4 4 4-4 4",
    check: "m5 12 4 4L19 6",
    clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3",
    shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6",
    shirt: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z",
    pen: "m16 3 5 5L8 21H3v-5L16 3Zm-3 3 5 5M3 16l5 5",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.book} /></svg>;
}

export function Brand({ compact = false }) {
  return <div className={`university-brand ${compact ? "compact" : ""}`}><img src="/uphsd-seal.png" alt="University of Perpetual Help System DALTA official seal" width="208" height="300" /><div><strong>UPHSD <span>BOOKSTORE POS</span></strong><small>University of Perpetual Help<br />System DALTA</small></div></div>;
}

export function Panel({ title, subtitle, action, children, className = "", id }) {
  return <section id={id} className={`ui-panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

export function EmptyState({ title = "No records yet", children, icon = "book" }) {
  return <div className="empty-state"><span><Icon name={icon} size={26} /></span><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function Notice({ children, error = false }) {
  return <div className={`notice ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}><Icon name={error ? "shield" : "clock"} /><div>{children}</div></div>;
}

export function StatCard({ label, value, detail, icon }) {
  return <div className="stat-card"><div><small>{label}</small><strong>{value ?? "—"}</strong><p>{detail}</p></div><span className="stat-icon"><Icon name={icon} size={23} /></span></div>;
}

export function CatalogFilters({ products, search, setSearch, category, setCategory }) {
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort();
  return <div className="catalog-filters"><label className="search-field"><Icon name="search" /><input aria-label="Search products" placeholder="Search by product name or SKU…" value={search} onChange={event => setSearch(event.target.value)} /></label><div className="category-filters" aria-label="Product categories">{["All products", ...categories].map(name => <button key={name} aria-pressed={category === name} className={`filter-chip ${category === name ? "selected" : ""}`} onClick={() => setCategory(name)}>{name}</button>)}</div></div>;
}

export function ProductVisual({ product }) {
  const [failed, setFailed] = useState(false);
  const source = product.imageUrl || product.image;
  const icon = /uniform|shirt|pants|pe\b/i.test(`${product.category} ${product.name}`) ? "shirt" : /pen|pencil/i.test(`${product.category} ${product.name}`) ? "pen" : "book";
  return <div className={`product-visual visual-${icon}`}>{source && !failed ? <img src={source} alt={product.name} onError={() => setFailed(true)} loading="lazy" /> : <><Icon name={icon} size={54} /><small>No product photo</small></>}</div>;
}

export function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = ref.current;
    const focusables = () => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]')];
    focusables()[0]?.focus();
    const keydown = event => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab") {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    element.addEventListener("keydown", keydown);
    return () => { element.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [busy, onClose]);
  return <div className="modal-backdrop"><section ref={ref} className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-busy={busy}><div className="panel-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>{busy && <Notice>Waiting for server confirmation…</Notice>}{children}</section></div>;
}

export function ProductDetails({ product, price, onClose }) {
  return <Modal title="Product details" onClose={onClose}><ProductVisual product={product} /><div className="mt-5"><span className="product-category">{product.category || "General"}</span><h3 className="text-xl font-semibold mt-2">{product.name}</h3><p className="product-sku">SKU: {product.sku || "Not assigned"}</p><p className="product-price">{price}</p><span className={`status-pill mt-3 ${product.availability ? "available" : ""}`}>{product.availability ? "Available" : "Unavailable"}</span><p className="helper-text">Current prices and availability are verified at checkout.</p></div></Modal>;
}

