import mongoose from "mongoose";
import { addStoreAttribution } from "./resourceAttribution.js";
import { validSizeStocks, sizeStockTotal } from "../utils/clothingSizes.js";

const { Schema, model } = mongoose;

const productSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    sizeStocks: { type: Schema.Types.Mixed, default: undefined },
    category: { type: String, default: "General", trim: true },
    isActive: { type: Boolean, default: true, index: true },
    imageUrl: { type: String, default: undefined },
    costPrice: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productSchema.pre("validate", function validateClothingStock() {
  if (this.sizeStocks === undefined) return; // Historical products require explicit size allocation.
  if (!validSizeStocks(this.sizeStocks) || sizeStockTotal(this.sizeStocks) !== this.stock) {
    this.invalidate("sizeStocks", "Clothing size quantities must be nonnegative integers totaling product stock");
  }
});

productSchema.virtual("userId").get(function getUserId() {
  return this.owner;
});

productSchema.virtual("sellingPrice").get(function getSellingPrice() {
  return this.price;
});

productSchema.virtual("sellingPrice").set(function setSellingPrice(value) {
  this.price = value;
});

productSchema.virtual("quantity").get(function getQuantity() {
  return this.stock;
});

productSchema.virtual("quantity").set(function setQuantity(value) {
  this.stock = value;
});

productSchema.virtual("active").get(function getActive() {
  return this.isActive;
});

productSchema.virtual("active").set(function setActive(value) {
  this.isActive = value;
});

productSchema.index({ owner: 1, name: 1 });
productSchema.index({ owner: 1, sku: 1 });
productSchema.index({ owner: 1, category: 1, isActive: 1 });

addStoreAttribution(productSchema);
export default model("Product", productSchema);
