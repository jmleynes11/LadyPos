import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { invoiceDto } from "../../backend/utils/invoiceDto.js";

// Compile the real JSX component with the installed Vite transformer, without a server or env file.
const source = await fs.readFile(new URL("../src/features/invoices/components/Invoice.jsx", import.meta.url), "utf8");
const compiled = await transformWithOxc(source, "Invoice.jsx", { jsx: { runtime: "automatic", development: false } });
const code = compiled.code.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const { default: Invoice } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("real receipt renders invoice API DTO with centavos, recorded prices and payment details", () => {
  const invoice = invoiceDto({ invoiceNumber: "INV-SYNTHETIC", issuedAt: "2026-11-02T01:00:00Z", status: "partial", transaction: {
    _id: "synthetic-sale", totalAmount: 16000, amountPaid: 10000, balance: 6000, paymentMethod: "cash", processedBy: { identifier: "cashier" },
    items: [{ product: { _id: "synthetic-product", name: "Synthetic book", price: 999999 }, quantity: 2, unitPrice: 8000, subtotal: 16000 }],
  } });
  const html = renderToStaticMarkup(createElement(Invoice, { invoice }));
  for (const text of ["UPHSD Bookstore", "INV-SYNTHETIC", "Synthetic book", "x2", "PHP 160.00", "PHP 80.00", "PHP 100.00", "PHP 60.00", "CASH", "cashier"]) {
    assert(html.includes(text), `missing receipt text: ${text}`);
  }
  assert(!html.includes("999999"));
  assert(!html.includes("undefined"));
  assert(!html.includes("NaN"));
});

test("missing transaction/product history does not crash or fabricate price totals", () => {
  assert.equal(renderToStaticMarkup(createElement(Invoice, { invoice: null })), "");
  const missing = invoiceDto({ invoiceNumber: "LEGACY", transaction: "missing-id" });
  assert.match(renderToStaticMarkup(createElement(Invoice, { invoice: missing })), /Receipt details unavailable/);
  const legacy = invoiceDto({ invoiceNumber: "LEGACY", transaction: { _id: "legacy", items: [{ product: null, quantity: 1 }], totalAmount: 100 } });
  const html = renderToStaticMarkup(createElement(Invoice, { invoice: legacy }));
  assert(html.includes("historical name not stored"));
  assert(html.includes("Unavailable"));
});
