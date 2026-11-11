import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/UserRoute.js";
import productRoutes from "./routes/ProductRoute.js";
import personRoutes from "./routes/PersonRoute.js";
import customerRoutes from "./routes/CustomerRoute.js";
import orderRoutes from "./routes/OrderRoute.js";
import transactionRoutes from "./routes/TransactionRoute.js";
import financialRoutes from "./routes/FinancialRoute.js";
import invoiceRoutes from "./routes/InvoiceRoute.js";
import expenseRoutes from "./routes/ExpenseRoute.js";
import debtPaymentRoutes from "./routes/DebtPaymentRoute.js";
import dashboardRoutes from "./routes/DashboardRoute.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
import { logger } from "./middleware/logger.js";
import { protectErrorResponses } from "./utils/safeErrors.js";
import { createBookstoreRoutes } from "./routes/BookstoreRoute.js";

// No listener, environment-file loading or database connection on import.
export function createApp({ bookstoreConfig } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(logger);
  app.use(protectErrorResponses);
  const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "https://serveflow.netlify.app"];
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const error = new Error("Origin not allowed");
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
  }));
  // Public diagnostics contain no logs, configuration or exception details.
  app.get("/", (req, res) => res.json({ service: "UPHSD Bookstore POS", status: "running" }));
  app.get("/api/health", async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.status(503).json({ status: "connecting" });
      await mongoose.connection.db.admin().ping();
      return res.json({ status: "ok" });
    } catch {
      return res.status(503).json({ status: "db not ready" });
    }
  });
  // Larger JSON bodies are limited to product creation with an optional photo.
  app.use((req, res, next) => req.method === "POST" && /^\/api\/products\/?$/.test(req.path) ? express.json({ limit: "750kb" })(req, res, next) : next());
  app.use(express.json());
  app.use("/api/bookstore", createBookstoreRoutes(bookstoreConfig || { publicStoreId: process.env.BOOKSTORE_PUBLIC_STORE_ID, guestRateLimit: Number(process.env.BOOKSTORE_GUEST_RATE_LIMIT), guestWindowMs: Number(process.env.BOOKSTORE_GUEST_WINDOW_MS) }));
  app.use("/api/users", userRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/people", personRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/financials", financialRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/debt-payments", debtPaymentRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use(errorHandler);
  return app;
}
