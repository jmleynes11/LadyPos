import Store from "../models/Store.js";
import Customer from "../models/Person.js";
import { BookstoreAudit } from "../models/BookstoreControl.js";
import { accountCommand, accountId, fail } from "./accountManagement.js";
import { exactFields } from "./bookstoreOrders.js";

export async function createBookstore(actor, body) {
  exactFields(body, ["operationId", "reason", "name"]);
  if (typeof body.name !== "string" || !body.name.trim()) fail(400, "Bookstore name required");
  return accountCommand(actor, accountId(actor.id), "account.bookstore_created", body, async ({ session, audit, operationId }) => {
    const [store] = await Store.create([{ name: body.name.trim(), createdBy: actor.id }], { session });
    // Compatibility contact carries no guest/student PII and grants no account.
    const [contact] = await Customer.create([{ owner: actor.id, storeId: store._id, name: "Bookstore orders" }], { session });
    store.orderCustomer = contact._id; await store.save({ session });
    await audit("account.bookstore_created", actor.id, { absent: true }, { storeIds: [String(store._id)] });
    await BookstoreAudit.create([{ actorKey: `account:${actor.id}`, actorId: actor.id, actorKind: "account", operationId, sequence: 0, storeId: store._id, action: "store.created", targetKind: "Store", targetId: store._id, occurredAt: new Date(), reason: body.reason, before: { absent: true }, after: { storeId: String(store._id) } }], { session });
    // Creation does not silently assign any account to the new bookstore.
    return { storeId: String(store._id), name: store.name };
  });
}
