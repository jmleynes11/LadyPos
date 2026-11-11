import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, Modal, Notice, Panel } from "../../../shared/components/BookstoreUI.jsx";
import { ProductListFilters, ProductListPagination } from "../../../shared/components/ProductListControls.jsx";
import { formatCentavos } from "../../bookstore/money.js";

const defaults = { search: "", category: "", isActive: "", sortBy: "name", sortDirection: "asc", limit: 10, page: 1 };
export default function ManagerProductsTable({ products = [], categories, api, storeId, refreshVersion, command, disabled, mutationDisabled, reason, onReasonChange, onEdit }) {
  const [query, setQuery] = useState(defaults), [result, setResult] = useState(null);
  const [loading, setLoading] = useState(Boolean(api)), [loadError, setLoadError] = useState("");
  const [notification, setNotification] = useState(null), [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState(null), [eligibility, setEligibility] = useState(null), [checking, setChecking] = useState(false), [working, setWorking] = useState(false);
  const deletionGeneration = useRef(0), mutationLock = useRef(false);
  const change = fields => { setQuery(old => ({ ...old, ...fields, page: 1 })); };
  const load = useCallback(async signal => {
    if (!api) return;
    setLoading(true); setLoadError("");
    try {
      const response = await api.get("/products", { params: { storeId, management: true, ...query }, signal });
      if (signal.aborted) return;
      if (!Array.isArray(response.data.data) || !response.data.pagination) throw new Error("Invalid product list response");
      setResult({ products: response.data.data, ...response.data.pagination });
      if (response.data.pagination.page !== query.page) setQuery(old => ({ ...old, page: response.data.pagination.page }));
    } catch (error) { if (!signal.aborted) setLoadError(error.response?.data?.message || error.message || "Products could not be loaded."); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [api, storeId, query]);
  useEffect(() => {
    const controller = new AbortController(); load(controller.signal);
    return () => controller.abort();
  }, [load, refreshVersion, refresh]);
  useEffect(() => () => { deletionGeneration.current++; }, []);

  // Standalone callers may supply an already-loaded list. The live manager
  // view always supplies api/storeId and uses backend pagination/counts.
  const filtered = api ? [] : products.filter(product => (!query.category || product.category === query.category) && (!query.isActive || product.isActive === (query.isActive === "true")) && `${product.name} ${product.sku || ""}`.toLowerCase().includes(query.search.trim().toLowerCase()))
    .sort((a, b) => (query.sortBy === "price" ? a.price - b.price : String(a[query.sortBy] || "").localeCompare(String(b[query.sortBy] || ""))) * (query.sortDirection === "asc" ? 1 : -1));
  const data = api ? result : { products: filtered.slice((query.page - 1) * query.limit, query.page * query.limit), total: filtered.length, pages: Math.ceil(filtered.length / query.limit), page: query.page };
  const total = data?.total || 0, pages = data?.pages || 0, page = data?.page || query.page;
  const busy = disabled || working;
  const closeDeletion = () => { if (mutationLock.current) return; deletionGeneration.current++; setDeleting(null); setEligibility(null); };
  const checkDeletion = async (product, preserveNotification = false) => {
    const generation = ++deletionGeneration.current;
    setDeleting(product); setEligibility(null); setChecking(true); if (!preserveNotification) setNotification(null);
    try {
      if (!api) throw new Error("Product reference checks are unavailable. Refresh the product manager.");
      const response = await api.get(`/products/${product._id}`, { params: { storeId, management: true } });
      if (generation !== deletionGeneration.current) return;
      const status = response.data.data?.deletion;
      if (typeof status?.canDelete !== "boolean") throw new Error("Product reference checks returned an invalid response.");
      setEligibility(status);
    } catch (error) { if (generation === deletionGeneration.current) setNotification({ error: true, text: error.response?.data?.message || error.message }); }
    finally { if (generation === deletionGeneration.current) setChecking(false); }
  };
  const remove = async event => {
    event.preventDefault();
    if (busy || mutationDisabled || checking || !eligibility || eligibility.canArchive === false || mutationLock.current) return;
    mutationLock.current = true; setWorking(true);
    try {
      const permanent = eligibility.canDelete;
      const response = await command("delete", `/products/${deleting._id}`, permanent ? { deletionMode: "permanent" } : {});
      if (!response) {
        setNotification({ error: true, text: "Product change was not confirmed. Review the operation message before retrying." });
        // References may have appeared since the modal's initial check.
        if (!disabled) await checkDeletion(deleting, true);
        return;
      }
      setNotification({ error: false, text: `“${deleting.name}” ${permanent ? "deleted" : "archived"} successfully.` });
      setDeleting(null); setEligibility(null); setRefresh(value => value + 1);
    } catch (error) {
      setNotification({ error: true, text: error.response?.data?.message || error.message || "Product change failed." });
    } finally { mutationLock.current = false; setWorking(false); }
  };
  return <><Panel title="Manage products">
    <ProductListFilters query={query} onChange={change} categories={categories} />
    {notification && !deleting && <Notice error={notification.error}>{notification.text}</Notice>}
    {loading && <Notice>Loading products…</Notice>}
    {loadError && <Notice error>{loadError} <button className="secondary-action" onClick={() => setRefresh(value => value + 1)}>Retry products</button></Notice>}
    {!loading && !loadError && (data?.products.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Availability</th><th>Action</th></tr></thead><tbody>{data.products.map(product => <tr key={product._id}><td><strong>{product.name}</strong><small>{product.sku}</small></td><td>{product.category}</td><td>{product.moneyUnit === "PHP-centavos" ? formatCentavos(product.price) : "Unit review required"}</td><td>{product.isActive ? "Active" : "Archived"}</td><td><div className="table-actions"><button className="secondary-action" disabled={busy || product.moneyUnit !== "PHP-centavos"} onClick={() => onEdit(product)}>Edit product</button><button className="secondary-action danger-action" disabled={busy} onClick={() => checkDeletion(product)}>Delete</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No matching products">No products match the selected search and filters.</EmptyState>)}
    <ProductListPagination total={total} pages={pages} page={page} limit={query.limit} loading={loading} loadError={loadError} onLimitChange={limit => change({ limit })} onPageChange={next => setQuery(old => ({ ...old, page: next }))} />
  </Panel>{deleting && <Modal title={eligibility?.canDelete === false ? "Archive product" : "Delete product"} busy={busy} onClose={closeDeletion}><form className="form-stack" onSubmit={remove}>
    <p>Product: <strong>{deleting.name}</strong></p>
    {checking && <Notice>Checking transaction and inventory references…</Notice>}
    {notification && <Notice error={notification.error}>{notification.text}</Notice>}
    {eligibility && <><p>{eligibility.canDelete ? "Are you sure you want to delete this product? This action cannot be undone." : eligibility.reason}</p>{!eligibility.canDelete && eligibility.canArchive !== false && <p>Archive this product instead. Its historical information will remain available.</p>}<label>Required audit reason<textarea className="input min-h-11" required value={reason} onChange={event => onReasonChange(event.target.value)} disabled={busy} /></label></>}
    <div className="modal-actions"><button type="button" className="secondary-action" disabled={busy} onClick={closeDeletion}>Cancel</button>{!checking && !eligibility && <button type="button" className="secondary-action" disabled={busy} onClick={() => checkDeletion(deleting)}>Retry reference check</button>}{eligibility && eligibility.canArchive !== false && <button className={eligibility.canDelete ? "secondary-action danger-action" : "primary-action"} disabled={busy || mutationDisabled || checking || (!eligibility.canDelete && deleting.isActive === false)}>{working ? "Saving…" : eligibility.canDelete ? "Confirm Delete" : deleting.isActive === false ? "Already archived" : "Confirm Archive"}</button>}</div>
  </form></Modal>}</>;
}
