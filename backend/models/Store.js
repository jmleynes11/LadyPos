import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryNames: { type: [String], default: undefined },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  orderCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
}, { strict: "throw", timestamps: true });

// No seeded bookstore or inferred account/resource membership.
export default mongoose.model("Store", schema);
