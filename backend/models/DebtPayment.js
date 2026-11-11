import mongoose from "mongoose";
import { addStoreAttribution } from "./resourceAttribution.js";

const { Schema, model } = mongoose;

const debtPaymentSchema = new Schema(
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
      index: true,
    },
    amountPaid: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["cash", "gcash", "bank", "credit"],
      default: "cash",
    },
    paymentReference: { type: String, default: "", trim: true },
    paidAt: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

debtPaymentSchema.virtual("userId").get(function getUserId() {
  return this.owner;
});

debtPaymentSchema.virtual("personId").get(function getPersonId() {
  return this.customer;
});

// Payment effects belong to DebtPaymentController's transaction, not a second save hook.

debtPaymentSchema.index({ owner: 1, customer: 1, paidAt: -1 });
debtPaymentSchema.index({ owner: 1, transaction: 1, paidAt: -1 });

addStoreAttribution(debtPaymentSchema);
export default model("DebtPayment", debtPaymentSchema);
