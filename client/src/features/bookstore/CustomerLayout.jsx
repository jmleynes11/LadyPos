import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/AuthContext.jsx";
import { Brand, Icon } from "../../shared/components/BookstoreUI.jsx";
import "./customer-storefront.css";

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") || "overview";
  const shopping = location.pathname === "/bookstore";
  const cart = shopping && view === "catalog" && location.hash === "#customer-cart";
  useEffect(() => {
    if (location.hash !== "#customer-cart") window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search, location.hash]);
  const links = [
    { name: "Home", to: "/bookstore", active: shopping && view === "overview" },
    { name: "Shop", to: "/bookstore?view=catalog", active: shopping && view === "catalog" && !cart },
    { name: "My Orders", to: "/bookstore?view=my-orders", active: shopping && view === "my-orders" },
    { name: "My Account", to: "/profile", active: location.pathname === "/profile" },
    { name: "Cart", to: "/bookstore?view=catalog#customer-cart", active: cart },
  ];
  return <div className="customer-store">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="customer-store-ribbon">Your campus. Your essentials. Your bookstore.</div>
    <header className="customer-store-header">
      <Link to="/bookstore" className="customer-store-brand" aria-label="UPHSD Bookstore home"><Brand compact /></Link>
      <nav className="customer-store-nav" aria-label="Shopping navigation">
        {links.map(link => <Link key={link.name} to={link.to} aria-current={link.active ? "page" : undefined}>{link.name === "Cart" && <Icon name="bag" size={17} />}{link.name}</Link>)}
      </nav>
      <div className="customer-store-account"><span>{user?.name || user?.identifier}</span><button type="button" onClick={() => { logout(); navigate("/login"); }} aria-label="Sign out"><Icon name="logout" size={17} /></button></div>
    </header>
    <main id="main-content" className="customer-store-main" tabIndex={-1}><Outlet /></main>
    <footer className="customer-store-footer"><Brand compact /><p>University of Perpetual Help System DALTA<br />Your university essentials, all in one place.</p><Link to="/bookstore?view=my-orders">View my orders<Icon name="arrow" size={16} /></Link></footer>
  </div>;
}
