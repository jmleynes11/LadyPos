import mongoose from "mongoose";

// HTTP IDs are exactly 24 hexadecimal characters. Avoid coercing numbers,
// buffers or request objects into identities; also support trusted BSON IDs.
export function canonicalAccountId(value) {
  try {
    const hex = value instanceof mongoose.Types.ObjectId ? value.toHexString() : value;
    if (typeof hex === "string" && /^[a-fA-F0-9]{24}$/.test(hex)) {
      return new mongoose.Types.ObjectId(hex).toHexString();
    }
  } catch {
    // Invalid/forged ObjectId instances are not valid account identities.
  }
  return null;
}
