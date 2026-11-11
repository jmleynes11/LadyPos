import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Transaction from "../models/Order.js";
import InvoiceCounter from "../models/InvoiceCounter.js";
import { respond, respondError } from "../utils/responseHelpers.js";
import { invoiceDto } from "../utils/invoiceDto.js";
import { reverseInvoiceAlias } from "../services/bookstoreAliases.js";

const receiptPopulation = [
  { path: "customer", select: "name phone address" },
  { path: "transaction", populate: [
    { path: "items.product", select: "name sku price" },
    { path: "processedBy", select: "name identifier" },
  ] },
];

const ownerIdFrom = (req) => req.user?._id || req.user?.id;
const pageFrom = (req) => Math.max(1, Number.parseInt(req.query.page ?? 1, 10));
const limitFrom = (req) =>
  Math.max(1, Number.parseInt(req.query.limit ?? 20, 10));
const statusFromPayment = (paymentStatus) => {
  if (paymentStatus === "paid") return "paid";
  if (paymentStatus === "partial") return "partial";
  return "unpaid";
};

const generateInvoiceNumber = async (owner, session) => {
  const year = new Date().getFullYear();
  const counter = await InvoiceCounter.findOneAndUpdate(
    { owner, type: "invoice", year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );

  return `INV-${year}-${String(counter.seq).padStart(4, "0")}`;
};

export async function createInvoiceForTransaction(transaction, session = null) {
  const existing = await Invoice.findOne({
    owner: transaction.owner,
    transaction: transaction._id,
  }).session(session);

  if (existing) return existing;

  const invoiceNumber = await generateInvoiceNumber(transaction.owner, session);
  const [invoice] = await Invoice.create(
    [
      {
        owner: transaction.owner,
        customer: transaction.customer,
        transaction: transaction._id,
        invoiceNumber,
        dueDate:
          transaction.balance > 0
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : null,
        status: statusFromPayment(transaction.paymentStatus),
      },
    ],
    { session },
  );

  return invoice;
}

export const createInvoiceFromOrder = async (reqOrOrderId, resOrUserId) => {
  if (typeof reqOrOrderId === "object" && reqOrOrderId.params) {
    const req = reqOrOrderId;
    const res = resOrUserId;
    return getOrCreateInvoice(req, res);
  }

  const transaction = await Transaction.findOne({
    _id: reqOrOrderId,
    owner: resOrUserId,
  });
  if (!transaction) throw new Error("Transaction not found or unauthorized");
  return createInvoiceForTransaction(transaction);
};

export const getInvoices = async (req, res) => {
  try {
    const owner = ownerIdFrom(req);
    const page = pageFrom(req);
    const limit = limitFrom(req);
    const filter = { owner, moneyUnit: { $exists: false } };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.from || req.query.to) {
      filter.issuedAt = {};
      if (req.query.from) filter.issuedAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.issuedAt.$lte = new Date(req.query.to);
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate(receiptPopulation)
        .sort({ issuedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    respond(res, 200, "Invoices loaded", invoices.map(invoiceDto), {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    respondError(res, 500, err.message);
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      owner: ownerIdFrom(req),
      moneyUnit: { $exists: false },
    })
      .populate(receiptPopulation)
      .populate("customer", "name phone email address");

    if (!invoice) return respondError(res, 404, "Invoice not found");
    respond(res, 200, "Invoice loaded", invoiceDto(invoice));
  } catch (err) {
    respondError(res, 500, err.message);
  }
};

export const getOrCreateInvoice = async (req, res) => {
  try {
    const owner = ownerIdFrom(req);
    const transactionId = req.params.orderId || req.params.transactionId;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return respondError(res, 400, "Invalid transaction ID");
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      owner,
      origin: { $exists: false },
    }).session(req.accountSession || null);
    if (!transaction) return respondError(res, 404, "Transaction not found");

    const invoice = await Invoice.findOne({ owner, transaction: transaction._id, moneyUnit: { $exists: false } });
    if (!invoice) return respondError(res, 403, "Receipt issuance requires an authorized operational role");
    await invoice.populate(receiptPopulation);
    respond(res, 200, "Invoice loaded", invoiceDto(invoice));
  } catch (err) {
    respondError(res, 500, err.message);
  }
};

export const markVoid = async (req, res) => {
  try {
    const result = await reverseInvoiceAlias(req.user, req.params.id, req.body);
    respond(res, 200, "Reversal applied", result);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
};
