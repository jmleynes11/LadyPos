import test from "node:test";
import assert from "node:assert/strict";
import Invoice from "../models/Invoice.js";
import { getInvoiceById, getOrCreateInvoice, getInvoices } from "../controllers/InvoiceController.js";
import Transaction from "../models/Order.js";
import { id, query, invoke } from "./helpers.js";

test("detail, list and ensure expose compatible receipt fields using recorded sale prices", async (t) => {
  const owner = id(), saleId = id();
  const invoice = { _id: id(), owner, invoiceNumber: "INV-SYNTHETIC-0001", issuedAt: new Date("2026-11-02T01:00:00Z"), status: "paid",
    transaction: { _id: saleId, totalAmount: 16000, amountPaid: 16000, balance: 0, paymentMethod: "cash", processedBy: { identifier: "cashier" },
      items: [{ product: { _id: id(), name: "Synthetic book", price: 999999 }, quantity: 1, unitPrice: 12500, subtotal: 12500 },
        { product: { _id: id(), name: "Synthetic supplies", price: 999999 }, quantity: 1, unitPrice: 3500, subtotal: 3500 }] },
    async populate() { return this; },
  };
  t.mock.method(Invoice, "findOne", () => query(invoice));
  t.mock.method(Invoice, "find", () => query([invoice]));
  t.mock.method(Invoice, "countDocuments", async () => 1);
  t.mock.method(Transaction, "findOne", () => query({ _id: saleId, owner }));
  const responses = [
    await invoke(getInvoiceById, { user: { id: owner }, params: { id: invoice._id } }),
    await invoke(getOrCreateInvoice, { user: { id: owner }, params: { orderId: saleId.toString() } }),
    await invoke(getInvoices, { user: { id: owner }, query: {} }),
  ];
  for (const response of responses) {
    assert.equal(response.statusCode, 200);
    const dto = Array.isArray(response.body.data) ? response.body.data[0] : response.body.data;
    assert.equal(dto.orderId, saleId.toString());
    assert.equal(dto.total, 16000);
    assert.equal(dto.items.length, 2);
    assert.equal(dto.items[0].productName, "Synthetic book");
    assert.equal(dto.items[0].unitPrice, 12500);
    assert.equal(dto.items[0].total, 12500);
    assert.equal(dto.items.reduce((sum, item) => sum + item.total, 0), dto.total);
  }
});
