export default function ProductCard({ product, onEdit, onDelete }) {
  return (
    <div
      className="rounded-2xl p-4 w-[48%] md:w-[30%] flex flex-col justify-between border"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      <div>
        <h2 className="font-semibold text-lg">{product.name}</h2>

        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {product.category}
        </p>
      </div>

      <div className="mt-3">
        <p className="text-xl font-bold">₱{product.sellingPrice}</p>

        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Stock: {product.quantity}
        </p>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onEdit}
          className="flex-1 p-2 rounded-lg border"
          style={{ borderColor: "var(--color-border)" }}
        >
          Edit
        </button>

        <button
          onClick={onDelete}
          className="flex-1 p-2 rounded-lg text-white"
          style={{ backgroundColor: "var(--color-danger)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
