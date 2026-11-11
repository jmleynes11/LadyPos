import mongoose from "mongoose";
import { addStoreAttribution } from "./resourceAttribution.js";

const { Schema, model } = mongoose;

const invoiceSchema = new Schema(
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
    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now, index: true },
    dueDate: Date,
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "void"],
      default: "unpaid",
      index: true,
    },
    notes: { type: String, default: "" },
    snapshot: Schema.Types.Mixed,
    reversalId: Schema.Types.ObjectId,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

invoiceSchema.virtual("userId").get(function getUserId() {
  return this.owner;
});

invoiceSchema.virtual("orderId").get(function getOrderId() {
  return this.transaction;
});

invoiceSchema.index({ owner: 1, invoiceNumber: 1 });
invoiceSchema.index({ owner: 1, transaction: 1 });

addStoreAttribution(invoiceSchema);
export default model("Invoice", invoiceSchema);
