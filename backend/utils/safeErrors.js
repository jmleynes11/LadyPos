export function redactSensitive(value) {
  let text = String(value ?? "");
  for (const [key, secret] of Object.entries(process.env)) {
    if (/(?:PASSWORD|PASS|SECRET|TOKEN|PRIVATE_KEY|MONGO_URI|DATABASE_URL|DB_URI)/i.test(key) && secret) {
      text = text.split(secret).join("[REDACTED]");
    }
  }
  return text
    .replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi, "[REDACTED CONNECTION]")
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]");
}

export function safeErrorMessage(status, message) {
  return status >= 500 ? "Internal server error" : redactSensitive(message);
}

function sanitize(value, status, key = "") {
  if (/(?:password|secret|token|authorization|connectionString|mongo_uri)/i.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return ["message", "error", "stack"].includes(key) ? safeErrorMessage(status, value) : redactSensitive(value);
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, status));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, sanitize(item, status, name)]));
  }
  return value;
}

// Also covers older controllers that return their own {error} JSON envelopes.
export function protectErrorResponses(req, res, next) {
  const json = res.json;
  res.json = function safeJson(body) {
    return json.call(this, this.statusCode >= 400 ? sanitize(body, this.statusCode) : body);
  };
  next();
}
