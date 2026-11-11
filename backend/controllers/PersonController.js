import mongoose from "mongoose";
import Customer from "../models/Person.js";
import Transaction from "../models/Order.js";
import DebtPayment from "../models/DebtPayment.js";
import Invoice from "../models/Invoice.js";
import { respond, respondError } from "../utils/responseHelpers.js";

const ownerIdFrom = (req) => req.user?._id || req.user?.id;
const pageFrom = (req) => Math.max(1, Number.parseInt(req.query.page ?? 1, 10));
const limitFrom = (req) =>
  Math.max(1, Number.parseInt(req.query.limit ?? 20, 10));
const money = (value) => Math.round(Number(value) || 0);

const customerMatch = (owner, query = {}) => {
  const match = {
    owner: new mongoose.Types.ObjectId(owner),
    isDeleted: { $ne: true },
  };
  if (query.search) {
    match.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { phone: { $regex: query.search, $options: "i" } },
    ];
  }
  return match;
};

const withCustomerSummary = (owner) => [
  {
    $lookup: {
      from: "transactions",
      let: { customerId: "$_id" },
      pipeline: [
        {
          $match: {
            owner: new mongoose.Types.ObjectId(owner),
            origin: { $exists: false },
            orderStatus: "completed",
            voidedAt: { $exists: false },
            $expr: {
              $eq: ["$customer", "$$customerId"],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalDebt: { $sum: "$balance" },
            totalPaid: { $sum: "$amountPaid" },
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$totalAmount" },
            lastTransaction: { $max: "$createdAt" },
          },
        },
      ],
      as: "summaryRows",
    },
  },
  {
    $addFields: {
      summary: {
        $ifNull: [
          { $first: "$summaryRows" },
          {
            totalDebt: 0,
            totalPaid: 0,
            totalOrders: 0,
            totalSpent: 0,
            lastTransaction: null,
          },
        ],
      },
    },
  },
  {
    $addFields: {
      totalDebt: "$summary.totalDebt",
      totalPaid: "$summary.totalPaid",
      totalOrders: "$summary.totalOrders",
      totalSpent: "$summary.totalSpent",
      lastTransaction: "$summary.lastTransaction",
      balance: "$summary.totalDebt",
      contactInfo: "$phone",
    },
  },
  { $project: { summaryRows: 0 } },
];

export async function getCustomers(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const page = pageFrom(req);
    const limit = limitFrom(req);
    const sortBy = req.query.sortBy === "totalDebt" ? "totalDebt" : "name";
    const pipeline = [
      { $match: customerMatch(owner, req.query) },
      ...withCustomerSummary(owner),
    ];

    if (req.query.debtStatus === "withDebt")
      pipeline.push({ $match: { totalDebt: { $gt: 0 } } });
    if (req.query.debtStatus === "paid")
      pipeline.push({ $match: { totalDebt: { $lte: 0 } } });

    pipeline.push({
      $facet: {
        data: [
          { $sort: { [sortBy]: sortBy === "totalDebt" ? -1 : 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        meta: [{ $count: "total" }],
      },
    });

    const [result] = await Customer.aggregate(pipeline);
    const total = result.meta[0]?.total || 0;
    respond(res, 200, "Customers loaded", result.data, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const getPeople = getCustomers;

export async function getCustomerById(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const page = pageFrom(req);
    const limit = limitFrom(req);
    const [customer] = await Customer.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
          ...customerMatch(owner),
        },
      },
      ...withCustomerSummary(owner),
    ]);

    if (!customer) return respondError(res, 404, "Customer not found");

    const [transactions, totalTransactions, recentPayments] = await Promise.all(
      [
        Transaction.find({
          owner,
          origin: { $exists: false },
          customer: req.params.id,
          orderStatus: "completed",
          voidedAt: { $exists: false },
        })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("items.product", "name sku"),
        Transaction.countDocuments({
          owner,
          origin: { $exists: false },
          customer: req.params.id,
          orderStatus: "completed",
          voidedAt: { $exists: false },
        }),
        DebtPayment.find({ owner, customer: req.params.id })
          .sort({ paidAt: -1 })
          .limit(10)
          .populate(
            "transaction",
            "createdAt totalAmount balance paymentStatus",
          )
          .populate({
            path: "transaction",
            populate: { path: "items.product", select: "name" },
          }),
      ],
    );

    const invoices = await Invoice.find({
      owner,
      transaction: { $in: transactions.map((transaction) => transaction._id) },
    });
    const invoiceByTransaction = new Map(
      invoices.map((invoice) => [invoice.transaction.toString(), invoice]),
    );

    respond(res, 200, "Customer loaded", {
      customer,
      transactions: transactions.map((transaction) => ({
        ...transaction.toObject(),
        invoice: invoiceByTransaction.get(transaction._id.toString()) || null,
      })),
      payments: recentPayments,
      debtSummary: {
        totalDebt: customer.totalDebt,
        totalPaid: customer.totalPaid,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        lastTransaction: customer.lastTransaction,
      },
      pagination: {
        page,
        limit,
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / limit),
      },
    });
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const getPersonById = getCustomerById;

export async function createCustomer(req, res) {
  try {
    const [customer] = await Customer.create([{
      owner: ownerIdFrom(req),
      name: req.body.name,
      phone: req.body.phone ?? req.body.contactInfo ?? "",
      email: req.body.email ?? "",
      address: req.body.address ?? "",
    }], { session: req.accountSession });
    respond(res, 201, "Customer created", customer);
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const createPerson = createCustomer;

export async function updateCustomer(req, res) {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, owner: ownerIdFrom(req), isDeleted: { $ne: true } },
      {
        name: req.body.name,
        phone: req.body.phone ?? req.body.contactInfo,
        email: req.body.email,
        address: req.body.address,
      },
      { new: true, runValidators: true, session: req.accountSession },
    );

    if (!customer) return respondError(res, 404, "Customer not found");
    respond(res, 200, "Customer updated", customer);
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const updatePerson = updateCustomer;

export async function deleteCustomer(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const unpaid = await Transaction.exists({
      owner,
      customer: req.params.id,
      orderStatus: "completed",
      balance: { $gt: 0 },
      voidedAt: { $exists: false },
    });

    if (unpaid)
      return respondError(
        res,
        409,
        "Cannot delete a customer with unpaid balance",
      );

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, owner },
      { isDeleted: true, deletedAt: new Date() },
      { new: true, session: req.accountSession },
    );

    if (!customer) return respondError(res, 404, "Customer not found");
    respond(res, 200, "Customer deleted", customer);
  } catch (err) {
    respondError(res, 500, err.message);
  }
}

export const deletePerson = deleteCustomer;

export async function addDebt(req, res) {
  return respondError(
    res,
    410,
    "Create a transaction with paymentStatus debt instead",
  );
}

export async function addPayment(req, res) {
  try {
    const { createDebtPayment } = await import("./DebtPaymentController.js");
    return createDebtPayment(req, res);
  } catch (err) {
    return respondError(res, 500, err.message);
  }
}

export async function payAllDebts(req, res) {
  try {
    const owner = ownerIdFrom(req);
    const [summary] = await Transaction.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(owner),
          customer: new mongoose.Types.ObjectId(req.params.id),
          orderStatus: "completed",
          balance: { $gt: 0 },
          voidedAt: { $exists: false },
        },
      },
      { $group: { _id: null, balance: { $sum: "$balance" } } },
    ]);

    if (!summary?.balance)
      return respond(res, 200, "No outstanding debt", null);

    req.body = {
      customer: req.params.id,
      amountPaid: summary.balance,
      paymentMethod: req.body.paymentMethod || "cash",
      notes: "Full settlement",
    };

    const { createDebtPayment } = await import("./DebtPaymentController.js");
    return createDebtPayment(req, res);
  } catch (err) {
    return respondError(res, 500, err.message);
  }
}

export async function updateDebt(req, res) {
  return respondError(
    res,
    410,
    "Debt entries are now immutable transaction/payment records",
  );
}

export async function deleteDebt(req, res) {
  return respondError(
    res,
    410,
    "Debt entries are now immutable transaction/payment records",
  );
}
