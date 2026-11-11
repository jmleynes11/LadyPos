import mongoose from "mongoose";
import { addStoreAttribution } from "./resourceAttribution.js";

const { Schema, model } = mongoose;

const customerSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

customerSchema.virtual("userId").get(function getUserId() {
  return this.owner;
});

customerSchema.virtual("contactInfo").get(function getContactInfo() {
  return this.phone;
});

customerSchema.virtual("contactInfo").set(function setContactInfo(value) {
  this.phone = value;
});

customerSchema.virtual("totalDebt").get(function getTotalDebt() {
  return this.summary?.totalDebt ?? 0;
});

customerSchema.virtual("totalPaid").get(function getTotalPaid() {
  return this.summary?.totalPaid ?? 0;
});

customerSchema.virtual("totalOrders").get(function getTotalOrders() {
  return this.summary?.totalOrders ?? 0;
});

customerSchema.index({ owner: 1, name: 1 });
customerSchema.index({ owner: 1, phone: 1 });

addStoreAttribution(customerSchema);
export default model("Customer", customerSchema);
