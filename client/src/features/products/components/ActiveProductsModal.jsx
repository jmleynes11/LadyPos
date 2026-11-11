import { useEffect, useState } from "react";
import { useProductApi } from "../services/productApi";

export default function ActiveProductsModal({ onClose, onSuccess }) {
  const { getProducts, setActiveProducts } = useProductApi();

  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const res = await getProducts();

    const sorted = res.data.sort((a, b) => a.name.localeCompare(b.name));

    setProducts(sorted);

    const activeIds = sorted.filter((p) => p.active).map((p) => p._id);

    setSelected(activeIds);
  }

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSelectAll() {
    const visibleIds = filtered.map((p) => p._id);
    setSelected((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  function handleClearAll() {
    const visibleIds = filtered.map((p) => p._id);
    setSelected((prev) => prev.filter((id) => !visibleIds.includes(id)));
  }

  async function handleSubmit() {
    await setActiveProducts(selected);
    onSuccess();
  }

  // 🔍 FILTERING
  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());

    const matchCategory = category === "all" || p.category === category;

    return matchSearch && matchCategory;
  });

  // 📦 GET UNIQUE CATEGORIES
  const categories = [
    "all",
    ...new Set(products.map((p) => p.category || "General")),
  ];

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-3xl p-6 rounded-xl border"
        style={{
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2 className="text-xl font-semibold mb-4">
          Set Active Products (POS)
        </h2>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)" }}
          >
            Select All
          </button>

          <button
            onClick={handleClearAll}
            className="px-3 py-1 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)" }}
          >
            Clear All
          </button>
        </div>

        {/* TABLE */}
        <div
          className="max-h-96 overflow-y-auto rounded-lg border"
          style={{ borderColor: "var(--color-border)" }}
        >
          <table className="w-full text-sm">
            <thead
              className="sticky top-0"
              style={{ backgroundColor: "var(--color-bg)" }}
            >
              <tr>
                <th className="p-3 text-left">Active</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Price</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p._id}
                  style={{
                    borderTop: "1px solid var(--color-border)",
                  }}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(p._id)}
                      onChange={() => toggle(p._id)}
                    />
                  </td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.category || "General"}</td>
                  <td className="p-3">₱ {p.sellingPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div
              className="p-4 text-center"
              style={{ color: "var(--color-muted)" }}
            >
              No products found
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Save
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
