import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/AuthContext.jsx";
import { useBookstore } from "../../features/bookstore/bookstoreContext.js";
import { bookstoreNavigation, bookstoreViewPath, resolveBookstoreView } from "../../features/bookstore/navigation.js";
import { bookstoreViews, ROLE_LABELS } from "../../features/bookstore/presentation.js";
import { Brand, Icon } from "./BookstoreUI.jsx";
import CustomerLayout from "../../features/bookstore/CustomerLayout.jsx";

export default function Layout() {
  const { context, cashierQueue } = useBookstore();
  const { user, logout } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const drawer = useRef(null), toggle = useRef(null), main = useRef(null);
  const views = bookstoreViews(context);
  const view = resolveBookstoreView(context, new URLSearchParams(location.search).get("view"), views);
  // Sidebar visibility only; retain the full view definitions for direct routes.
  const sidebarViews = context?.role === "admin" ? views.filter(item => !["catalog", "inventory", "history"].includes(item.id)) : views;
  const current = location.pathname === "/bookstore" ? views.find(item => item.id === view)?.name || "Bookstore" : bookstoreNavigation(context).find(item => item.path === location.pathname)?.name || "Account";
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [location.pathname, location.search]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const changed = event => { if (!event.matches) setOpen(false); };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!open) return;
    const first = drawer.current?.querySelector("a"); first?.focus();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = event => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
      if (event.key === "Tab") {
        const items = [...drawer.current.querySelectorAll("a, button")];
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); };
  }, [open]);
  const close = () => setOpen(false);
  if (context?.role === "customer") return <CustomerLayout />;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {open && <div className="nav-backdrop" onClick={close} aria-hidden="true" />}
    <aside ref={drawer} id="main-navigation" className={`app-sidebar ${open ? "is-open" : ""}`} aria-label="Bookstore navigation">
      <div className="sidebar-brand"><Brand /></div>
      <div className="sidebar-links">
      <div className="sidebar-caption">Workspace</div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {sidebarViews.map(item => <Link key={item.id} to={bookstoreViewPath(context, item.id, cashierQueue?.storeId)} onClick={close} aria-current={location.pathname === "/bookstore" && view === item.id ? "page" : undefined}><Icon name={item.icon} />{item.name}{context?.role === "cashier" && item.id === "queue" && cashierQueue?.count > 0 && <span className="cashier-queue-badge" aria-label={`${cashierQueue.count} pending orders`}>{cashierQueue.count}</span>}</Link>)}
        <Link to="/profile" onClick={close} aria-current={location.pathname === "/profile" ? "page" : undefined}><Icon name={context?.canManageAccounts ? "users" : "settings"} />{context?.canManageAccounts ? "Users & account" : "My account"}</Link>
      </nav>
      {context?.role !== "admin" && (context?.legacyReadOnly || context?.canManageAccounts) && <><div className="sidebar-caption">Historical records</div><nav className="sidebar-nav" aria-label="Historical navigation">{bookstoreNavigation(context).filter(item => item.name.startsWith("Historical")).map(item => <Link key={item.path} to={item.path} onClick={close} aria-current={location.pathname === item.path ? "page" : undefined}><Icon name="report" />{item.name.replace("Historical ", "")}</Link>)}</nav></>}
      </div>
      <div className="sidebar-footer"><Link className="sidebar-kiosk-link" to="/kiosk" onClick={close}><Icon name="bag" />Guest kiosk (signs out)</Link><button onClick={() => { close(); logout(); navigate("/login"); }}><Icon name="logout" />Sign out</button><p>UPHSD BOOKSTORE POS<br />University of Perpetual Help System DALTA</p></div>
    </aside>
    <div className="app-workspace">
      <header className="app-topbar"><div className="flex items-center gap-3"><button ref={toggle} className="icon-button mobile-menu-button" onClick={() => setOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="main-navigation"><Icon name="menu" /></button><div className="topbar-title">{current}<small>Point-of-Sale & Inventory Management</small></div></div><Link to="/profile" className="account-chip"><span className="account-avatar">{(user?.name || user?.identifier || "U").slice(0, 1).toUpperCase()}</span><div>{user?.name || user?.identifier}<small>{ROLE_LABELS[context?.role] || "Checking access"}</small></div></Link></header>
      <main ref={main} id="main-content" className="app-main" tabIndex={-1}><Outlet /></main>
    </div>
  </div>;
}
