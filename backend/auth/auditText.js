import { redactSensitive } from "../utils/safeErrors.js";

// Free-text audit/evidence fields are not credential storage. Known secret
// values, connection URIs, Bearer material and recognizable credential formats
// must be removed before persistence and again when producing read DTOs.
export function redactAuditText(value) {
  return redactSensitive(value)
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/g, "[REDACTED HASH]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED TOKEN]")
    .replace(/\b(password|passwd|pwd|secret|(?:access[_-]?)?token|authorization|api[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[REDACTED]");
}
