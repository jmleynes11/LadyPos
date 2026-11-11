import { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import { hashPassword } from "../utils/passwords.js";
import { accountTokenVersion, isTokenVersion } from "../utils/tokenVersion.js";
import { STORED_ROLES } from "../auth/accountRoles.js";
import { isStoredMemberships } from "./resourceAttribution.js";

const UserSchema = new Schema(
  {
    identifier: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: STORED_ROLES,
      // Preserve new-account compatibility, never infer authority while reading
      // a persisted record whose required role is missing.
      default: function defaultNewAccountRole() { return this.isNew ? "user" : undefined; },
    },
    name: { type: String },
    phone: { type: String, unique: true, sparse: true },
    address: { type: String },
    storeIds: { type: Schema.Types.Mixed, validate: isStoredMemberships },
    confirmed: {
      type: Schema.Types.Mixed, validate: value => typeof value === "boolean",
      default: function newConfirmationState() { return this.isNew ? false : undefined; },
    },
    accountState: {
      // Missing is the only legacy fallback; casting malformed persisted state
      // to undefined must never activate an account.
      type: Schema.Types.Mixed, validate: value => ["active", "suspended"].includes(value),
      default: function newAccountState() { return this.isNew ? "active" : undefined; },
    },
    authorityVersion: {
      type: Schema.Types.Mixed,
      validate: { validator: isTokenVersion, message: "Invalid account authority version" },
    },
    tokenVersion: {
      // Preserve invalid persisted types so authentication can reject them, rather
      // than silently casting a stored string/null into a usable version.
      type: Schema.Types.Mixed,
      validate: { validator: isTokenVersion, message: "Invalid account security version" },
    },
  },
  { timestamps: true },
);

UserSchema.pre("validate", function initializeNewAccountVersion() {
  // A schema default would be scheduled for persistence when a legacy document
  // is hydrated, letting an unrelated stale profile save overwrite a newer epoch.
  if (this.isNew && this.tokenVersion === undefined) this.tokenVersion = 0;
  if (this.isNew && this.authorityVersion === undefined) this.authorityVersion = 0;
});

UserSchema.pre("save", async function saveAccountSecurityState() {
  let change = this.$locals.securityVersionChange;
  if (!this.isNew && this.isModified("authorityVersion") && !this.$locals.authorityAdvanced) throw new Error("Account authority version is server controlled");
  if (!this.isNew && this.isModified("tokenVersion") && !change) {
    throw new Error("Account security version is server controlled");
  }
  if (!this.isNew && (this.$locals.forceSecurityChange || ["password", "role", "confirmed", "accountState", "storeIds"].some((field) => this.isModified(field)))) {
    if (!change) {
      const expected = accountTokenVersion(this.tokenVersion);
      if (expected === Number.MAX_SAFE_INTEGER) throw new Error("Account security version exhausted");
      change = { expected, next: expected + 1, originalWhere: this.$where };
      this.$locals.securityVersionChange = change;
    }
    this.tokenVersion = change.next;
    // Mongoose document.$where adds conditions to the same updateOne as the
    // password/role/confirmation changes. It is not MongoDB's JavaScript $where.
    const versionFilter = change.expected === 0
      ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
      : { tokenVersion: change.expected };
    this.$where = { $and: [change.originalWhere || {}, versionFilter] };
  }
  if (!this.isNew && ["role", "confirmed", "accountState", "storeIds"].some(field => this.isModified(field)) && !this.$locals.authorityAdvanced) {
    const version = accountTokenVersion(this.authorityVersion);
    if (version === Number.MAX_SAFE_INTEGER) throw new Error("Account authority version exhausted");
    this.authorityVersion = version + 1;
    this.$locals.authorityAdvanced = true;
  }
  if (this.isModified("password") && this.password !== this.$locals.passwordHash) {
    this.password = await hashPassword(this.password);
    this.$locals.passwordHash = this.password; // Preserve a hash if a failed save is retried.
  }
});

UserSchema.post("save", function clearSavedSecurityState() {
  const change = this.$locals.securityVersionChange;
  if (change) {
    this.$where = change.originalWhere;
    delete this.$locals.securityVersionChange;
  }
  delete this.$locals.authorityAdvanced;
  delete this.$locals.forceSecurityChange;
});

UserSchema.methods.matchPassword = async function matchPassword(password) {
  // Never accept or auto-convert legacy plaintext. Existing bcrypt hashes remain usable.
  if (typeof password !== "string" || !/^\$2[aby]\$\d{2}\$/.test(this.password)) return false;
  return bcrypt.compare(password, this.password);
};

export default model("User", UserSchema);
