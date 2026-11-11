import { useEffect, useMemo, useState } from "react";
import { useProductApi } from "../services/productApi";

const formatMoney = (centavos = 0) =>
  `PHP ${(Number(centavos) / 100).toFixed(2)}`;
const toCentavos = (value) => Math.round((Number(value) || 0) * 100);

const emptyForm = {
  name: "",
  sku: "",
  category: "General",
  price: "",
  stock: 0,
  isActive: true,
};

export default function ProductPage({ readOnly = false }) {
  const { getProducts, createProduct, updateProduct, deleteProduct } =
    useProductApi();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const res = await getProducts({ limit: 200, search, sortBy: "name" });
    setProducts(res.data);
  };

  useEffect(() => {
    load();
  }, [search]);

  const editingProduct = useMemo(
    () => products.find((product) => product._id === editingId),
    [products, editingId],
  );

  const startEdit = (product) => {
    setEditingId(product?._id || null);
    setForm(
      product
        ? {
            name: product.name,
            sku: product.sku || "",
            category: product.category || "General",
            price: ((product.price ?? product.sellingPrice ?? 0) / 100).toFixed(
              2,
            ),
            stock: product.stock ?? product.quantity ?? 0,
            isActive: product.isActive ?? product.active ?? true,
          }
        : emptyForm,
    );
  };

  const save = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      price: toCentavos(form.price),
      stock: Number.parseInt(form.stock, 10) || 0,
    };
    if (editingProduct) await updateProduct(editingProduct._id, payload);
    else await createProduct(payload);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  return (
    <div className="screen-wrap">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Products</h1>
        {!readOnly && <button className="secondary-action" onClick={() => startEdit(null)}>
          Add
        </button>}
      </div>

      <input
        className="input mb-4 min-h-11"
        placeholder="Search name or SKU"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {!readOnly && <form className="inline-form" onSubmit={save}>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="floating-field">
            <input
              id="name"
              className="input floating-input min-h-11 peer"
              placeholder=" "
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <label htmlFor="name" className="floating-label">
              Name
            </label>
          </div>

          <div className="floating-field">
            <input
              id="sku"
              className="input floating-input min-h-11 peer"
              placeholder=" "
              value={form.sku}
              onChange={(event) =>
                setForm({ ...form, sku: event.target.value })
              }
            />
            <label htmlFor="sku" className="floating-label">
              SKU (Product Code)
            </label>
          </div>

          <div className="floating-field">
            <input
              id="category"
              className="input floating-input min-h-11 peer"
              placeholder=" "
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            />
            <label htmlFor="category" className="floating-label">
              Category
            </label>
          </div>

          <div className="floating-field">
            <input
              id="price"
              className="input floating-input min-h-11 peer"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder=" "
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
            />
            <label htmlFor="price" className="floating-label">
              Price
            </label>
          </div>

          <div className="floating-field">
            <input
              id="stock"
              className="input floating-input min-h-11 peer"
              type="number"
              inputMode="numeric"
              placeholder=" "
              value={form.stock}
              onChange={(event) =>
                setForm({ ...form, stock: event.target.value })
              }
            />
            <label htmlFor="stock" className="floating-label">
              Stock
            </label>
          </div>

          <label
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
            />
            Active in POS
          </label>
        </div>

        <button
          className="primary-action mt-3"
          disabled={!form.name || !form.price}
        >
          {editingProduct ? "Save changes" : "Create product"}
        </button>
      </form>}

      <div
        className="mt-4 divide-y rounded-lg border"
        style={{ borderColor: "var(--color-border)" }}
      >
        {products.map((product) => {
          const stock = product.stock ?? product.quantity ?? 0;
          return (
            <div key={product._id} className="product-row">
              <div className="min-w-0">
                <strong className="block truncate">{product.name}</strong>
                <small className="text-[var(--color-muted)]">
                  {product.sku || product.category || "General"}
                </small>
              </div>
              <span>{formatMoney(product.price ?? product.sellingPrice)}</span>
              <span
                className={`stock-pill ${stock === 0 ? "stock-out" : stock < 10 ? "stock-low" : "stock-ok"}`}
              >
                {stock}
              </span>
              {!readOnly && <div className="flex gap-2">
                <button
                  className="mini-action"
                  onClick={() => startEdit(product)}
                >
                  Edit
                </button>
                <button
                  className="mini-action danger"
                  onClick={async () => {
                    await deleteProduct(product._id);
                    load();
                  }}
                >
                  Off
                </button>
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
