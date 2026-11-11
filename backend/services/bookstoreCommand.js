import { createHmac } from "node:crypto";
import User from "../models/User.js";
import Store from "../models/Store.js";
import { accountTransaction } from "../utils/accountTransaction.js";
import { lockAccountRealm, fenceAccountActor, accountId, text, fail } from "./accountManagement.js";
import { BookstoreAudit, BookstoreReceipt } from "../models/BookstoreControl.js";
import { mappedStoreFilter } from "../auth/resourceScope.js";
import { isStoredMemberships } from "../models/resourceAttribution.js";
import { redactAuditText } from "../auth/auditText.js";
import { mayHoldCapability, requireResourceCapability } from "./bookstoreGrants.js";
import { ReversalRequest } from "../models/BookstoreControl.js";
import { operationalProjection } from "../auth/operationalProjection.js";

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)])) : value;

// Required effects, immutable events and reconciliation identity share B02's
// observed transaction/realm boundary. Never perform external payment here.
export async function bookstoreCommand(actor, storeId, action, body, work) {
  if (!mayHoldCapability(actor?.role, action)) fail(403, "Operational capability denied");
  const operationId = body?.operationId;
  if (typeof operationId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) fail(400, "Stable operation ID required");
  const actorId = accountId(actor.id), bookstore = accountId(storeId);
  const reason = redactAuditText(text(body.reason, "reason"));
  if (!process.env.JWT_SECRET) fail(503, "Bookstore operation unavailable");
  const fingerprint = createHmac("sha256", process.env.JWT_SECRET).update(JSON.stringify(stable({ bookstore, action, body }))).digest("hex");
  return accountTransaction(async session => {
    await lockAccountRealm(session);
    await fenceAccountActor(actor, session, false);
    const current = await User.findById(actorId, null, { session });
    if (!isStoredMemberships(current.storeIds)) fail(403, "Explicit bookstore membership required");
    const scope = mappedStoreFilter(bookstore, current.storeIds);
    if (!await Store.findById(bookstore, null, { session })) fail(409, "Bookstore mapping requires reconciliation");
    let resourceId = body.productId || body.orderId;
    if (action === "reversal.apply") {
      const request = await ReversalRequest.findOne({ _id: body.targetId, ...scope }).session(session);
      resourceId = request?.transactionId;
    }
    await requireResourceCapability(actor, action, resourceId, session);
    const actorKey = `account:${actorId}`;
    const prior = await BookstoreReceipt.findOne({ actorKey, operationId }).select("+fingerprint").session(session);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail(409, "Operation ID conflict");
      return prior.result;
    }
    let sequence = 0;
    const audit = async (eventAction, targetKind, targetId, before, after) => {
      await BookstoreAudit.create([{
        actorKey, operationId, sequence: sequence++, storeId: scope.storeId, actorId, actorKind: "account",
        action: eventAction, targetKind, targetId: accountId(targetId), occurredAt: new Date(), reason, before, after,
      }], { session });
    };
    const result = await work({ session, scope, actorId, operationId, reason, audit, requireCapability: capability => requireResourceCapability(actor, capability, resourceId, session) });
    // Caller must supply an explicit nonsecret DTO. Never persist a raw request,
    // credential, guest verifier, model document or external transfer response.
    const response = { ...operationalProjection(result), operationId };
    await BookstoreReceipt.create([{ actorKey, operationId, capability: action, storeId: scope.storeId, fingerprint, result: response }], { session });
    return response;
  });
}
