import Expense from "../models/Expense.js";
import mongoose from "mongoose";

export const createExpense = async (req, res) => {
  try {
    const { itemName, amount, category, note, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const expense = new Expense({
      userId: req.user.id, // ✅ REQUIRED
      itemName,
      amount,
      category,
      note,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user.id,
    });

    await expense.save({ session: req.accountSession });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id).session(req.accountSession || null);

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    if (
      req.user.role !== "admin" &&
      expense.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await expense.deleteOne({ session: req.accountSession });

    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid expense ID" });
    }

    const expense = await Expense.findById(id).session(req.accountSession || null);

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    // 🔒 Optional: only creator or admin can update
    if (
      req.user.role !== "admin" &&
      expense.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // ✅ Update fields safely
    const { amount, category, note, date, itemName } = req.body;
    if (itemName) expense.itemName = itemName;
    if (amount !== undefined) expense.amount = amount;
    if (category) expense.category = category;
    if (note !== undefined) expense.note = note;
    if (date) expense.date = new Date(date);

    await expense.save({ session: req.accountSession });

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const { from, to } = req.query;

    let filter = {};

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const expenses = await Expense.find({
      userId: req.user.id,
      ...filter,
    }).sort({ date: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
