import bcrypt from "bcryptjs";

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must contain at least 6 characters and at most 72 UTF-8 bytes");
    error.statusCode = 400;
    throw error;
  }
}

export async function hashPassword(password) {
  validatePassword(password);
  return bcrypt.hash(password, 10);
}
