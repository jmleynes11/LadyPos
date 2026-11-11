export function ProductListFilters({ query, onChange, categories, availabilityField = "isActive", availabilityOptions = [["true", "Active"], ["false", "Inactive / Archived"]], sortFields = [["name", "Product name"], ["price", "Price"], ["category", "Category"]] }) {
  return <div className="grid gap-3 md:grid-cols-4 mb-4">
    <label>Search products<input className="input min-h-11" placeholder="Product name or SKU" value={query.search} maxLength={150} onChange={event => onChange({ search: event.target.value })} /></label>
    <label>Category<select className="input min-h-11" value={query.category} onChange={event => onChange({ category: event.target.value })}><option value="">All categories</option>{categories.map(category => <option key={category.name} value={category.name}>{category.name}</option>)}</select></label>
    <label>Availability<select className="input min-h-11" value={query[availabilityField]} onChange={event => onChange({ [availabilityField]: event.target.value })}><option value="">All products</option>{availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Sort by<select className="input min-h-11" value={`${query.sortBy}:${query.sortDirection}`} onChange={event => { const [sortBy, sortDirection] = event.target.value.split(":"); onChange({ sortBy, sortDirection }); }}>{sortFields.flatMap(([field, label]) => [<option key={`${field}:asc`} value={`${field}:asc`}>{label} · ascending</option>, <option key={`${field}:desc`} value={`${field}:desc`}>{label} · descending</option>])}</select></label>
  </div>;
}

export function ProductListPagination({ total, pages, page, limit, onLimitChange, onPageChange, loading = false, loadError = "", pageSizes = [10, 20, 50, 100] }) {
  const numbers = [...new Set([1, page - 1, page, page + 1, pages].filter(value => value >= 1 && value <= pages))].sort((a, b) => a - b);
  const disabled = loading || Boolean(loadError);
  return <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
    <p className="helper-text" role="status">{disabled ? "" : `Showing ${total ? (page - 1) * limit + 1 : 0}–${total ? Math.min(page * limit, total) : 0} of ${total} products`}</p>
    <label>Products per page <select className="input" value={limit} onChange={event => onLimitChange(Number(event.target.value))}>{pageSizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    <nav className="table-actions" aria-label="Product pages"><button className="secondary-action" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>{numbers.map((number, index) => <span key={number}>{index > 0 && number - numbers[index - 1] > 1 && <span aria-hidden="true"> … </span>}<button className={`filter-chip ${page === number ? "selected" : ""}`} aria-label={`Page ${number}`} aria-current={page === number ? "page" : undefined} disabled={disabled} onClick={() => onPageChange(number)}>{number}</button></span>)}<button className="secondary-action" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>Next</button></nav>
  </div>;
}
