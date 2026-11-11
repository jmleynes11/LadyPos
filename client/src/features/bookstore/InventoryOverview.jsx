import { useState } from "react";
import { EmptyState } from "../../shared/components/BookstoreUI.jsx";
import { ProductListFilters, ProductListPagination } from "../../shared/components/ProductListControls.jsx";
import { supportsSizes } from "../products/clothingSizes.js";
import { filterCatalog } from "./presentation.js";

export function InventoryProductsTable({ products, canAdjust, disabled, onAdjust, filtered = false }) {
  if (!products.length) return <EmptyState title={filtered ? "No matching products" : "No inventory records"}>{filtered ? "No products match the selected search and filters." : null}</EmptyState>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Availability</th><th>Action</th></tr></thead><tbody>{products.map(product => <tr key={product._id}>
    <td><strong>{product.name}</strong><small>{product.sku}</small></td>
    <td>{product.category}</td>
    <td>{product.stock ?? "Not disclosed"}{supportsSizes(product) && <div>{Object.entries(product.sizeStocks || {}).map(([size, stock]) => <small key={size}>{size}: {stock}</small>)}{!Object.keys(product.sizeStocks || {}).length && <small>Configure sizes in Edit product</small>}</div>}</td>
    <td><span className={`status-pill ${product.availability ? "available" : ""}`}>{product.availability ? "Available" : "Unavailable"}</span></td>
    <td>{canAdjust(product) && <button className="secondary-action" disabled={disabled} onClick={() => onAdjust(product)}>Adjust stock</button>}</td>
  </tr>)}</tbody></table></div>;
}

export default function ManagerInventoryOverview({ products, ...tableProps }) {
  const [query, setQuery] = useState({ search: "", category: "", availability: "", sortBy: "name", sortDirection: "asc", limit: 10, page: 1 });
  const change = fields => setQuery(old => ({ ...old, ...fields, page: 1 }));
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort().map(name => ({ name }));
  const filtered = filterCatalog(products, query.search, query.category || "All products")
    .filter(product => !query.availability || product.availability === (query.availability === "true"))
    .sort((a, b) => (query.sortBy === "stock" ? (a.stock ?? 0) - (b.stock ?? 0) : String(a[query.sortBy] || "").localeCompare(String(b[query.sortBy] || ""))) * (query.sortDirection === "asc" ? 1 : -1));
  const total = filtered.length, pages = Math.ceil(total / query.limit), page = Math.min(query.page, Math.max(1, pages));
  const visible = filtered.slice((page - 1) * query.limit, page * query.limit);
  return <>
    <ProductListFilters query={query} onChange={change} categories={categories} availabilityField="availability" availabilityOptions={[["true", "Available"], ["false", "Unavailable"]]} sortFields={[["name", "Product name"], ["stock", "Stock"], ["category", "Category"]]} />
    <InventoryProductsTable {...tableProps} products={visible} filtered />
    <ProductListPagination total={total} pages={pages} page={page} limit={query.limit} pageSizes={[10, 25, 50, 100]} onLimitChange={limit => change({ limit })} onPageChange={next => setQuery(old => ({ ...old, page: next }))} />
  </>;
}
