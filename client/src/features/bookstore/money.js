export function formatCentavos(value) {
  if (!Number.isSafeInteger(value)) return "Amount unavailable";
  const amount = BigInt(value), absolute = amount < 0n ? -amount : amount;
  return `PHP ${amount < 0n ? "-" : ""}${(absolute / 100n).toLocaleString("en-PH")}.${String(absolute % 100n).padStart(2, "0")}`;
}
export function parsePesos(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter pesos with up to two decimal places");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large");
  return Number(amount);
}
