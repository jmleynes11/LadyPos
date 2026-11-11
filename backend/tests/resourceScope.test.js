import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { mappedStoreFilter, unmappedOwnerFilter, intersectResourceFilter } from "../auth/resourceScope.js";

const storeA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const storeB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const owner = "cccccccccccccccccccccccc";

test("D1 explicit membership scopes records independently of their creator", () => {
  const scope = mappedStoreFilter(storeA.toUpperCase(), [storeA]);
  assert(scope.storeId instanceof mongoose.Types.ObjectId);
  assert.equal(scope.storeId.toHexString(), storeA);
  assert.equal(Object.hasOwn(scope, "owner"), false);
  assert.throws(() => mappedStoreFilter(storeB, [storeA]), { statusCode: 403 });
  assert.equal(mappedStoreFilter(storeB, [storeA, storeB]).storeId.toHexString(), storeB);
});

test("D1 missing, sparse, duplicate and operator-injected memberships cannot widen scope", () => {
  for (const memberships of [undefined, null, [], new Array(1), [storeA, null], [storeA, { $ne: null }], [storeA, storeA.toUpperCase()], { includes: () => true }]) {
    assert.throws(() => mappedStoreFilter(storeA, memberships), { statusCode: 403 });
  }
  for (const value of [undefined, null, "", 1, [storeA], { $in: [storeA] }]) {
    assert.throws(() => mappedStoreFilter(value, [storeA]), { statusCode: 403 });
  }
});

test("D1 unmapped compatibility retains owner and excludes every attributed record", () => {
  const filter = unmappedOwnerFilter(owner);
  assert.equal(filter.owner.toHexString(), owner);
  assert.deepEqual(filter.storeId, { $exists: false });
  for (const value of [undefined, null, { $ne: null }, [owner]]) {
    assert.throws(() => unmappedOwnerFilter(value), { statusCode: 403 });
  }
});

test("D1 search operators remain intersected with mandatory scope without mutating inputs", () => {
  const scope = mappedStoreFilter(storeA, [storeA]);
  const search = { $or: [{ storeId: storeB }, { owner }] };
  const snapshot = structuredClone(search);
  const filter = intersectResourceFilter(scope, search);
  assert.deepEqual(filter, { $and: [scope, search] });
  assert.equal(filter.$and[0].storeId.toHexString(), storeA);
  assert.deepEqual(search, snapshot);
});
