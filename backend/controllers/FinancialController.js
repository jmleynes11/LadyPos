import mongoose from "mongoose";
import Transaction from "../models/Order.js";
import Customer from "../models/Person.js";
import { respond, respondError } from "../utils/responseHelpers.js";

const ownerIdFrom = (req) => req.user?._id || req.user?.id;

const groupFormat = (range) => {
  if (range === "weekly") return "%G-W%V";
  if (range === "monthly") return "%Y-%m";
  return "%Y-%m-%d";
};

export const getSummary = async (req, res) => {
  try {
    const owner = new mongoose.Types.ObjectId(ownerIdFrom(req));
    const [transactionTotals] = await Transaction.aggregate([
      { $match: { owner, origin: { $exists: false }, orderStatus: "completed", voidedAt: { $exists: false } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amountPaid" },
          totalOutstandingDebt: {
            $sum: {
              $cond: [{ $ne: ["$paymentStatus", "paid"] }, "$balance", 0],
            },
          },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const [totalCustomers, recentTransactions] = await Promise.all([
      Customer.countDocuments({ owner, isDeleted: { $ne: true } }),
      Transaction.find({ owner, origin: { $exists: false }, orderStatus: "completed", voidedAt: { $exists: false } })
        .populate("customer", "name phone")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    respond(res, 200, "Dashboard summary loaded", {
      totalRevenue: transactionTotals?.totalRevenue || 0,
      totalOutstandingDebt: transactionTotals?.totalOutstandingDebt || 0,
      totalOrders: transactionTotals?.totalOrders || 0,
      totalCustomers,
      recentTransactions,
    });
  } catch (err) {
    respondError(res, 500, err.message);
  }
};

export const getRevenueByRange = async (req, res) => {
  try {
    const owner = new mongoose.Types.ObjectId(ownerIdFrom(req));
    const range = req.query.range || "daily";
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const breakdown = await Transaction.aggregate([
      {
        $match: {
          owner,
          origin: { $exists: false },
          orderStatus: "completed",
          voidedAt: { $exists: false },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat(range), date: "$createdAt" } },
          revenue: { $sum: "$amountPaid" },
          orders: { $sum: 1 },
          outstandingDebt: { $sum: "$balance" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          label: "$_id",
          revenue: 1,
          orders: 1,
          outstandingDebt: 1,
        },
      },
    ]);

    respond(res, 200, "Revenue breakdown loaded", breakdown);
  } catch (err) {
    respondError(res, 500, err.message);
  }
};

export const getFinanceSummary = async (req, res) => getSummary(req, res);
