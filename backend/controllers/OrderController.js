import mongoose from "mongoose";
import { reverseOrderAlias } from "../services/bookstoreAliases.js";
import Transaction from "../models/Order.js";
import Customer from "../models/Person.js";
import Product from "../models/Product.js";
import Invoice from "../models/Invoice.js";
import DebtPayment from "../models/DebtPayment.js";
import { createInvoiceForTransaction } from "./InvoiceController.js";
import { respond, respondError } from "../utils/responseHelpers.js";
import { redactSensitive } from "../utils/safeErrors.js";

const ownerIdFrom = (req) => req.user?._id || req.user?.id;
const pageFrom = (req) => Math.max(1, Number.parseInt(req.query.page ?? 1, 10));
const limitFrom = (req) =>
  Math.max(1, Number.parseInt(req.query.limit ?? 50, 10));
const money = (value) => Math.round(Number(value) || 0);
const normalizeMethod = (value) => String(value || "cash").toLowerCase();
const allowedMethods = ["cash", "gcash", "bank", "credit"];

const normalizeCart = (body) => body.items || body.products || [];

function logOrder(event, payload) {
  console.log(redactSensitive(`[orders:${event}] ${JSON.stringify(payload)}`));
}

async function getOrCreateWalkInCustomer(owner, session) {
  const existing = await Customer.findOne({
    owner,
    name: "Walk-in",
    phone: "",
    isDeleted: { $ne: true },
  }).session(session);

  if (existing) return existing;

  const [customer] = await Customer.create(
    [{ owner, name: "Walk-in", phone: "" }],
    { session },
  );
  return customer;
}

async function resolveCustomer({
  owner,
  customerId,
  customerType,
  paymentStatus,
  session,
}) {
  if (mongoose.Types.ObjectId.isValid(customerId)) {
    const customer = await Customer.findOne({
      _id: customerId,
      owner,
      isDeleted: { $ne: true },
    }).session(session);
    if (!customer) throw new Error("Customer not found for this account");
    return customer;
  }

  if (paymentStatus === "debt" || paymentStatus === "partial") {
    throw new Error("Debt or partial sales require a selected customer");
  }

  if (customerType && customerType !== "walkin") {
    throw new Error("Non-walk-in orders require a selected customer");
  }

  return getOrCreateWalkInCustomer(owner, session);
}

async function buildItems(cart, owner, session) {
  if (!Array.isArray(cart) || cart.length === 0)
    throw new Error("Cart is required");

  const quantities = new Map();
  for (const line of cart) {
    const productId = line.product || line.productId;
    const quantity = Number.parseInt(line.quantity ?? 0, 10);
    if (!mongoose.Types.ObjectId.isValid(productId) || quantity <= 0) {
      throw new Error("Every cart item needs a valid product and quantity");
    }
    quantities.set(
      productId.toString(),
      (quantities.get(productId.toString()) || 0) + quantity,
    );
  }

  const products = await Product.find({
    _id: { $in: [...quantities.keys()] },
    owner,
    isActive: true,
  }).session(session);

  if (products.length !== quantities.size)
    throw new Error("One or more products are unavailable");

  return products.map((product) => {
    const quantity = quantities.get(product._id.toString());
    return {
      product: product._id,
      quantity,
      unitPrice: product.price,
      subtotal: product.price * quantity,
    };
  });
}

function completionPayload(body, totalAmount) {
  const paymentMethod = normalizeMethod(body.paymentMethod);
  if (!allowedMethods.includes(paymentMethod)) {
    throw new Error("Payment method must be cash, gcash, bank, or credit");
  }

  const requestedStatus =
    body.paymentStatus || (paymentMethod === "credit" ? "debt" : "paid");
  let amountPaid = money(body.amountPaid);

  if (requestedStatus === "paid") amountPaid = totalAmount;
  if (requestedStatus === "debt") amountPaid = 0;
  if (
    requestedStatus === "partial" &&
    (amountPaid <= 0 || amountPaid >= totalAmount)
  ) {
    throw new Error(
      "Partial payments must be greater than zero and less than the total",
    );
  }

  if (
    ["gcash", "bank"].includes(paymentMethod) &&
    amountPaid > 0 &&
    !String(body.paymentReference || "").trim()
  ) {
    throw new Error("Reference number is required for GCash and bank payments");
  }

  return {
    amountPaid,
    paymentMethod,
    paymentReference: String(
      body.paymentReference || body.referenceNumber || "",
    ).trim(),
  };
}

async function decrementStock(items, owner, session) {
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.product, owner, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { session },
    );

    if (result.modifiedCount !== 1) {
      const product = await Product.findOne({
        _id: item.product,
        owner,
      }).session(session);
      throw new Error(`${product?.name || "Product"} has insufficient stock`);
    }
  }
}

async function completeTransaction(transaction, body, processedBy, session) {
  if (transaction.orderStatus === "completed" && transaction.ledgerRecorded) {
    logOrder("duplicate-complete", {
      orderId: transaction._id,
      owner: transaction.owner,
      paymentStatus: transaction.paymentStatus,
    });
    const invoice = await createInvoiceForTransaction(transaction, session);
    return { transaction, invoice, duplicate: true };
  }

  const payment = completionPayload(body, transaction.totalAmount);

  await decrementStock(transaction.items, transaction.owner, session);
  logOrder("stock-decremented", {
    orderId: transaction._id,
    items: transaction.items.length,
  });

  transaction.amountPaid = payment.amountPaid;
  transaction.paymentMethod = payment.paymentMethod;
  transaction.paymentReference = payment.paymentReference;
  transaction.orderStatus = "completed";
  transaction.completedAt = new Date();
  transaction.processedBy = processedBy;
  transaction.ledgerRecorded = true;
  transaction.notes = body.notes ?? transaction.notes;

  await transaction.save({ session });
  logOrder("order-completed", {
    orderId: transaction._id,
    owner: transaction.owner,
    paymentStatus: transaction.paymentStatus,
    amountPaid: transaction.amountPaid,
    balance: transaction.balance,
  });

  const invoice = await createInvoiceForTransaction(transaction, session);
  logOrder("invoice-ready", {
    orderId: transaction._id,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
  });

  return { transaction, invoice, duplicate: false };
}

export async function createTransaction(req, res) {
  const session = req.accountSession || await mongoose.startSession();
  if (!req.accountSession) session.startTransaction();

  try {
    const owner = ownerIdFrom(req);
    const body = req.body;

    // Normalize order status — only allow two valid states at creation
    const orderStatus =
      body.orderStatus === "pending" ? "pending" : "completed";

    // Derive customerType defensively
    const customerType =
      body.customerType ||
      (body.customer || body.personId ? "customer" : "walkin");

    // Resolve or create customer document
    const customer = await resolveCustomer({
      owner,
      customerId: body.customer || body.personId,
      customerType,
      session,
    });

    // Build validated line items
    const items = await buildItems(normalizeCart(body), owner, session);

    // Totals derived here are re-derived by pre-validate; kept for invoice downstream
    const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);

    // Clamp amountPaid: must be numeric, non-negative, cannot exceed total
    const amountPaid = Math.max(
      0,
      Math.min(Number(body.amountPaid) || 0, totalAmount),
    );

    const [transaction] = await Transaction.create(
      [
        {
          owner,
          customer: customer._id,
          items,
          totalAmount, // pre-validate will recompute — consistent either way
          amountPaid, // pre-validate will clamp again — safe
          paymentMethod: normalizeMethod(body.paymentMethod),
          paymentReference: body.paymentReference?.trim() || "",
          customerType,
          reference: body.reference?.trim() || "",
          orderStatus,
          processedBy: owner,
          notes: body.notes?.trim() || "",
          ledgerRecorded: false,
        },
      ],
      { session },
    );

    let invoice = null;

    if (orderStatus === "completed") {
      ({ invoice } = await completeTransaction(
        transaction,
        body,
        owner,
        session,
      ));
    } else {
      logOrder("order-created-pending", {
        orderId: transaction._id,
        owner,
        totalAmount,
      });
    }

    if (!req.accountSession) await session.commitTransaction();

    // Populate after commit — session is no longer needed
    await transaction.populate("items.product", "name sku price stock");
    await transaction.populate("customer", "name phone");

    return respond(
      res,
      201,
      orderStatus === "completed" ? "Sale submitted" : "Pending order created",
      {
        transaction,
        invoice,
        invoiceNumber: invoice?.invoiceNumber ?? null,
      },
    );
  } catch (err) {
    if (!req.accountSession) await session.abortTransaction();
    logOrder("create-failed", {
      message: err.message,
      stack: err.stack,
      owner: ownerIdFrom(req),
    });
    return respondError(res, 400, err.message);
  } finally {
    if (!req.accountSession) session.endSession();
  }
}

export const createOrder = createTransaction;

export async function getTransactions(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const page = pageFrom(req);
    const limit = limitFrom(req);
    const filter = { owner, origin: { $exists: false }, voidedAt: { $exists: false } };

    if (req.query.orderStatus) filter.orderStatus = req.query.orderStatus;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.paymentMethod)
      filter.paymentMethod = normalizeMethod(req.query.paymentMethod);
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const sortDirection = req.query.sort === "asc" ? 1 : -1;
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("customer", "name phone")
        .populate("processedBy", "name email identifier")
        .populate("items.product", "name sku")
        .sort({ createdAt: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    const invoices = await Invoice.find({
      owner,
      transaction: { $in: transactions.map((transaction) => transaction._id) },
    });
    const invoiceByTransaction = new Map(
      invoices.map((invoice) => [invoice.transaction.toString(), invoice]),
    );

    respond(
      res,
      200,
      "Orders loaded",
      transactions.map((transaction) => ({
        ...transaction.toObject(),
        personId: transaction.customer,
        invoice: invoiceByTransaction.get(transaction._id.toString()) || null,
      })),
      { page, limit, total, pages: Math.ceil(total / limit) },
    );
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const getOrders = getTransactions;

export async function getTransactionById(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const transaction = await Transaction.findOne({ _id: req.params.id, owner, origin: { $exists: false } })
      .populate("customer", "name phone email address")
      .populate("processedBy", "name email identifier")
      .populate("items.product", "name sku price");

    if (!transaction) return respondError(res, 404, "Order not found");

    const [invoice, payments] = await Promise.all([
      Invoice.findOne({ owner, transaction: transaction._id }),
      DebtPayment.find({ owner, transaction: transaction._id }).sort({
        paidAt: -1,
      }),
    ]);

    respond(res, 200, "Order loaded", { transaction, invoice, payments });
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const getOrderById = getTransactionById;

export async function updateOrder(req, res) {
  const session = req.accountSession || await mongoose.startSession();
  if (!req.accountSession) session.startTransaction();

  try {
    const owner = ownerIdFrom(req);
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner,
      voidedAt: { $exists: false },
    }).session(session);

    if (!transaction) throw new Error("Order not found");

    if (req.body.orderStatus === "completed") {
      const customer = await resolveCustomer({
        owner,
        customerId:
          req.body.customer || req.body.personId || transaction.customer,
        customerType: req.body.customerType || transaction.customerType,
        paymentStatus: req.body.paymentStatus,
        session,
      });
      transaction.customer = customer._id;
      transaction.customerType =
        req.body.customerType || transaction.customerType;
      transaction.reference = req.body.reference ?? transaction.reference;

      const completed = await completeTransaction(
        transaction,
        req.body,
        owner,
        session,
      );
      if (!req.accountSession) await session.commitTransaction();
      await completed.transaction.populate("customer", "name phone");
      return respond(
        res,
        200,
        completed.duplicate ? "Order was already completed" : "Order completed",
        {
          transaction: completed.transaction,
          invoice: completed.invoice,
          invoiceNumber: completed.invoice?.invoiceNumber || null,
          duplicate: completed.duplicate,
        },
      );
    }

    if (transaction.orderStatus === "completed") {
      throw new Error(
        "Completed orders cannot be edited. Void and recreate if needed.",
      );
    }

    if (normalizeCart(req.body).length) {
      transaction.items = await buildItems(
        normalizeCart(req.body),
        owner,
        session,
      );
    }
    if (req.body.personId !== undefined || req.body.customer !== undefined) {
      const customer = await resolveCustomer({
        owner,
        customerId: req.body.customer || req.body.personId,
        customerType: req.body.customerType || transaction.customerType,
        paymentStatus: "paid",
        session,
      });
      transaction.customer = customer._id;
    }

    transaction.customerType =
      req.body.customerType || transaction.customerType;
    transaction.reference = req.body.reference ?? transaction.reference;
    transaction.notes = req.body.notes ?? transaction.notes;
    await transaction.save({ session });

    if (!req.accountSession) await session.commitTransaction();
    await transaction.populate("customer", "name phone");
    respond(res, 200, "Order saved", { transaction });
  } catch (err) {
    if (!req.accountSession) await session.abortTransaction();
    logOrder("update-failed", {
      orderId: req.params.id,
      owner: ownerIdFrom(req),
      message: err.message,
    });
    respondError(res, 400, err.message);
  } finally {
    if (!req.accountSession) session.endSession();
  }
}

export async function markAsCompleted(req, res) {
  req.body = {
    ...req.body,
    orderStatus: "completed",
    paymentStatus: req.body.paymentStatus || "paid",
  };
  return updateOrder(req, res);
}

export async function markAsPaid(req, res) {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      owner: ownerIdFrom(req),
      voidedAt: { $exists: false },
    });
    if (!transaction) return respondError(res, 404, "Order not found");
    if (transaction.balance <= 0)
      return respond(res, 200, "Order is already paid", transaction);

    const payment = {
      customer: transaction.customer,
      transaction: transaction._id,
      amountPaid: transaction.balance,
      paymentMethod: req.body.paymentMethod || transaction.paymentMethod,
      paymentReference: req.body.paymentReference || "",
      notes: "Debt settled from order",
    };
    const { createDebtPayment } = await import("./DebtPaymentController.js");
    // The order route ID is not a customer ID. Do not mutate the caller's request.
    return createDebtPayment({ user: req.user, params: {}, body: payment, accountSession: req.accountSession }, res);
  } catch (err) {
    logOrder("pay-failed", { orderId: req.params.id, message: err.message });
    return respondError(res, 500, err.message);
  }
}

export async function voidTransaction(req, res) {
  try {
    const result = await reverseOrderAlias(req.user, req.params.id, req.body);
    respond(res, 200, "Reversal applied", result);
  } catch (err) {
    if (!err.statusCode || err.statusCode >= 500) throw err;
    respondError(res, err.statusCode, err.message);
  }
}

export async function deleteOrder(req, res) {
  return voidTransaction(req, res);
}
