import mongoose from "mongoose";
import DebtPayment from "../models/DebtPayment.js";
import Transaction from "../models/Order.js";
import Customer from "../models/Person.js";
import { respond, respondError } from "../utils/responseHelpers.js";

const ownerIdFrom = (req) => req.user?._id || req.user?.id;
const pageFrom = (req) => Math.max(1, Number.parseInt(req.query.page ?? 1, 10));
const limitFrom = (req) =>
  Math.max(1, Number.parseInt(req.query.limit ?? 20, 10));
const money = (value) => Math.round(Number(value) || 0);
const method = (value) => String(value || "cash").toLowerCase();
const allowedMethods = ["cash", "gcash", "bank", "credit"];

export async function createDebtPayment(req, res) {
  const session = req.accountSession || await mongoose.startSession();
  if (!req.accountSession) session.startTransaction();
  try {
    const owner = ownerIdFrom(req);
    const customerId = req.params.id || req.body.customer || req.body.personId;
    const amountPaid = money(req.body.amountPaid ?? req.body.amount);
    if (!mongoose.Types.ObjectId.isValid(customerId))
      throw new Error("Customer is required");
    if (amountPaid <= 0)
      throw new Error("Payment amount must be greater than zero");
    const paymentMethod = method(req.body.paymentMethod);
    if (!allowedMethods.includes(paymentMethod)) {
      throw new Error("Payment method must be cash, gcash, bank, or credit");
    }
    const paymentReference = String(
      req.body.paymentReference || req.body.referenceNumber || "",
    ).trim();
    if (["gcash", "bank"].includes(paymentMethod) && !paymentReference) {
      throw new Error(
        "Reference number is required for GCash and bank payments",
      );
    }
    const customer = await Customer.findOne({
      _id: customerId,
      owner,
      isDeleted: { $ne: true },
    }).session(session);
    if (!customer) throw new Error("Customer not found");
    const transactionId = req.body.transaction || req.body.orderId || null;

    if (transactionId) {
      const transaction = await Transaction.findOne({
        _id: transactionId,
        owner,
        customer: customer._id,
        orderStatus: "completed",
        balance: { $gt: 0 },
        voidedAt: { $exists: false },
      }).session(session);

      if (!transaction) throw new Error("Transaction has no remaining balance");
      if (amountPaid > transaction.balance)
        throw new Error("Payment exceeds remaining balance");

      // update the transaction so balance reflects the payment
      transaction.amountPaid += amountPaid;
      await transaction.save({ session }); // pre-validate recomputes balance + paymentStatus

      const [payment] = await DebtPayment.create(
        [
          {
            owner,
            customer: customer._id,
            transaction: transaction._id,
            amountPaid,
            paymentMethod,
            paymentReference,
            paidAt: req.body.paidAt || new Date(),
            notes: req.body.notes || "",
          },
        ],
        { session },
      );

      if (!req.accountSession) await session.commitTransaction();
      return respond(res, 201, "Payment recorded", payment);
    }

    const unpaidTransactions = await Transaction.find({
      owner,
      customer: customer._id,
      orderStatus: "completed",
      balance: { $gt: 0 },
      voidedAt: { $exists: false },
    })
      .sort({ createdAt: 1 })
      .session(session);
    const totalBalance = unpaidTransactions.reduce(
      (sum, transaction) => sum + transaction.balance,
      0,
    );
    if (amountPaid > totalBalance)
      throw new Error("Payment exceeds remaining balance");

    let remaining = amountPaid;
    for (const transaction of unpaidTransactions) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, transaction.balance);
      transaction.amountPaid += applied;
      transaction.balance = Math.max(
        0,
        transaction.totalAmount - transaction.amountPaid,
      );
      await transaction.save({ session });
      remaining -= applied;
    }

    const [payment] = await DebtPayment.create(
      [
        {
          owner,
          customer: customer._id,
          amountPaid,
          paymentMethod,
          paymentReference,
          paidAt: req.body.paidAt || new Date(),
          notes: req.body.notes || "",
        },
      ],
      { session },
    );
    if (!req.accountSession) await session.commitTransaction();
    respond(res, 201, "Payment recorded", payment);
  } catch (err) {
    if (!req.accountSession) await session.abortTransaction();
    respondError(res, 400, err.message);
  } finally {
    if (!req.accountSession) session.endSession();
  }
}

export async function getDebtPayments(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const page = pageFrom(req);
    const limit = limitFrom(req);
    const filter = { owner };

    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.transaction) filter.transaction = req.query.transaction;

    const [payments, total] = await Promise.all([
      DebtPayment.find(filter)
        .populate("customer", "name phone")
        .populate(
          "transaction",
          "totalAmount amountPaid balance paymentStatus createdAt",
        )
        .sort({ paidAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DebtPayment.countDocuments(filter),
    ]);

    respond(res, 200, "Payments loaded", payments, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    respondError(res, 500, err.message);
  }
}
