import path from "node:path";
import { fileURLToPath } from "node:url";
import User from "../models/User.js";
import { validatePassword } from "./passwords.js";

export async function seedAdmin(password) {
  validatePassword(password);
  const existingAdmin = await User.findOne({ identifier: "admin" });
  if (existingAdmin) return false;
  throw new Error("Offline Administrator bootstrap requires a separately authorized recovery procedure");
}

async function main() {
  console.error("Offline Administrator bootstrap is disabled pending separately authorized recovery");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
