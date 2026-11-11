import { EmptyState, Icon, ProductVisual } from "../../shared/components/BookstoreUI.jsx";
import { formatCentavos } from "./money.js";

export default function CustomerHome({ products, onBrowse, onProduct, onOrders }) {
  const catalog = products.filter(product => product.isActive !== false && product.moneyUnit === "PHP-centavos");
  const categories = [...new Set(catalog.map(product => product.category).filter(Boolean))].sort();
  const featured = [...catalog.filter(product => product.availability), ...catalog.filter(product => !product.availability)].slice(0, 4);
  const heroProduct = featured[0];
  return <div className="customer-home">
    <section className="customer-home-hero" aria-labelledby="customer-home-title">
      <div className="customer-home-copy">
        <span className="customer-home-kicker">Welcome to UPHSD Bookstore!</span>
        <h1 id="customer-home-title">Everything You Need,<br /><span>All in One Place.</span></h1>
        <p>Explore university uniforms, school supplies, merchandise, and more.</p>
        <button type="button" className="customer-home-browse" onClick={() => onBrowse("All products")}>Start Browsing<Icon name="arrow" size={18} /></button>
        <div className="customer-home-hero-note"><Icon name="shield" size={17} />Made for your university life.</div>
      </div>
      <div className="customer-home-showcase">
        <div className="customer-home-seal"><img src="/uphsd-seal.png" alt="UPHSD DALTA seal" /><span>UPHSD<br /><strong>BOOKSTORE</strong></span></div>
        {heroProduct ? <button type="button" className="customer-home-hero-product" onClick={() => onProduct(heroProduct)} aria-label={`View ${heroProduct.name}`}>
          <ProductVisual product={heroProduct} /><div><small>Discover your campus essentials</small><strong>{heroProduct.name}</strong><span>{formatCentavos(heroProduct.price)}<Icon name="arrow" size={18} /></span></div>
        </button> : <div className="customer-home-hero-emblem"><Icon name="book" size={94} /><span>Your next chapter starts here.</span></div>}
        <div className="customer-home-showcase-caption">A little preparation.<br /><strong>A world of possibilities.</strong></div>
      </div>
    </section>

    <section className="customer-home-section" aria-labelledby="customer-categories-title">
      <div className="customer-home-section-heading"><div><span className="customer-home-overline">Find your essentials</span><h2 id="customer-categories-title">Shop by Category</h2></div><button type="button" className="customer-home-text-link" onClick={() => onBrowse("All products")}>Explore the shop<Icon name="arrow" size={17} /></button></div>
      {categories.length ? <div className="customer-home-categories">{categories.map(category => {
        const matches = catalog.filter(product => product.category === category);
        const representative = matches.find(product => product.imageUrl || product.image) || matches[0];
        return <button type="button" key={category} className="customer-home-category" onClick={() => onBrowse(category)} aria-label={`Shop ${category}`}><ProductVisual product={representative} /><span><strong>{category}</strong><small>Explore collection</small></span><Icon name="arrow" size={18} /></button>;
      })}</div> : <div className="customer-home-empty"><EmptyState title="Collections are on their way">Available product categories will appear here.</EmptyState></div>}
    </section>

    <section className="customer-home-section" aria-labelledby="customer-featured-title">
      <div className="customer-home-section-heading"><div><span className="customer-home-overline">For your university day</span><h2 id="customer-featured-title">Featured Products</h2></div><button type="button" className="customer-home-text-link" onClick={() => onBrowse("All products")}>Shop all products<Icon name="arrow" size={17} /></button></div>
      {featured.length ? <div className="customer-home-products">{featured.map(product => <article className="customer-home-product" key={product._id}>
        <button type="button" className="customer-home-product-image" onClick={() => onProduct(product)} aria-label={`View details for ${product.name}`}><ProductVisual product={product} /><span className="customer-home-product-open"><Icon name="arrow" size={18} /></span></button>
        <div className="customer-home-product-info"><span>{product.category || "University essentials"}</span><h3><button type="button" onClick={() => onProduct(product)}>{product.name}</button></h3><div><strong>{formatCentavos(product.price)}</strong><small>{product.availability ? "Available" : "Out of stock"}</small></div></div>
      </article>)}</div> : <div className="customer-home-empty"><EmptyState title="New essentials are on the way">Products will appear as they become available in your bookstore.</EmptyState></div>}
    </section>

    <section className="customer-home-experience" aria-labelledby="customer-experience-title">
      <div><span className="customer-home-overline">A simpler way to shop</span><h2 id="customer-experience-title">Ready for your next chapter.</h2><p>From finding your essentials to following your order, everything starts here.</p></div>
      <div className="customer-home-steps">
        <div><span><Icon name="search" size={22} /></span><h3>Easy product browsing</h3><p>Explore the catalog and find what you need by name or category.</p></div>
        <div><span><Icon name="bag" size={22} /></span><h3>Convenient order submission</h3><p>Choose your items, review your cart, and submit your order for payment at the cashier.</p></div>
        <div><span><Icon name="book" size={22} /></span><h3>Accessible order information</h3><p>Keep your order reference and check your order status in one place.</p><button type="button" className="customer-home-text-link" onClick={onOrders}>My Orders<Icon name="arrow" size={15} /></button></div>
      </div>
    </section>
  </div>;
}
