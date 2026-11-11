import mongoose from "mongoose";
import { addStoreAttribution } from "./resourceAttribution.js";
import Invoice from "./Invoice.js";
import { CLOTHING_SIZES } from "../utils/clothingSizes.js";

const { Schema, model } = mongoose;

const transactionItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    name: String, sku: String, category: String,
    size: { type: String, enum: CLOTHING_SIZES, default: undefined },
    subtotal: { type: Number, required: true, min: 0 },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

transactionItemSchema.virtual("productId").get(function getProductId() {
  return this.product;
});

transactionItemSchema.virtual("price").get(function getPrice() {
  return this.unitPrice;
});

const transactionSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    items: [transactionItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "debt", "unpaid"],
      default: "debt",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "gcash", "bank", "credit"],
      default: "cash",
    },
    paymentReference: { type: String, default: "", trim: true },
    customerType: {
      type: String,
      enum: ["walkin", "customer", "grab", "foodpanda"],
      default: "customer",
    },
    reference: { type: String, default: "", trim: true },
    orderStatus: {
      type: String,
      enum: ["pending", "completed", "void", "cancelled"],
      default: "completed",
      index: true,
    },
    ledgerRecorded: { type: Boolean, default: false, index: true },
    completedAt: Date,
    processedBy: { type: Schema.Types.ObjectId, ref: "User" },
    origin: { type: String, enum: ["guest", "student", "pos"] },
    directPayment: { type: Boolean, default: undefined },
    studentUser: { type: Schema.Types.ObjectId, ref: "User", select: false },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    bookstoreReference: { type: String },
    cancelledAt: Date, cancelledBy: Schema.Types.ObjectId, cancellationReason: String,
    reversalId: Schema.Types.ObjectId, reversedAt: Date,
    notes: { type: String, default: "" },
    voidedAt: Date,
    voidReason: String,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

transactionSchema.virtual("userId").get(function getUserId() {
  return this.owner;
});

transactionSchema.virtual("personId").get(function getPersonId() {
  return this.customer;
});

transactionSchema.virtual("products").get(function getProducts() {
  return this.items;
});

transactionSchema.virtual("total").get(function getTotal() {
  return this.totalAmount;
});

transactionSchema.virtual("date").get(function getDate() {
  return this.createdAt;
});

transactionSchema.pre("validate", function deriveTotals(next) {
  this.items = (this.items || []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.price) || 0;
    item.quantity = quantity;
    item.unitPrice = unitPrice;
    item.subtotal = Number(item.subtotal ?? quantity * unitPrice);
    return item;
  });

  this.totalAmount = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.amountPaid = Math.max(
    0,
    Math.min(Number(this.amountPaid) || 0, this.totalAmount),
  );
  this.balance = Math.max(0, this.totalAmount - this.amountPaid);

  if (this.orderStatus === "completed") {
    if (this.balance <= 0) this.paymentStatus = "paid";
    else if (this.amountPaid > 0) this.paymentStatus = "partial";
    else this.paymentStatus = "debt";
  }

  return;
});

transactionSchema.post("save", async function syncInvoiceStatus(doc) {
  if (doc.orderStatus !== "completed" && !doc.voidedAt) return;

  const statusMap = { paid: "paid", partial: "partial", debt: "unpaid" };
  const status =
    doc.voidedAt || doc.orderStatus === "void"
      ? "void"
      : statusMap[doc.paymentStatus];

  const sess = doc.$session();
  await Invoice.updateOne(
    { owner: doc.owner, transaction: doc._id },
    { $set: { status } },
    ...(sess ? [{ session: sess }] : []),
  );
});

transactionSchema.index({
  owner: 1,
  customer: 1,
  createdAt: -1,
  paymentStatus: 1,
});
transactionSchema.index({ owner: 1, createdAt: -1 });

addStoreAttribution(transactionSchema);
transactionSchema.index({ bookstoreReference: 1 }, { unique: true, sparse: true });
export default model("Transaction", transactionSchema);
