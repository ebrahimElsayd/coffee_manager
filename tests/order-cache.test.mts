import test from "node:test";
import assert from "node:assert/strict";
import { reconcileOrdersCache } from "../src/features/orders/domain/order-cache.ts";
import type { Order } from "../src/features/orders/domain/manager-order.ts";

function order(id: string, status: Order["status"] = "New", openedAt = "2026-09-08T10:00:00.000Z"): Order {
  return {
    id, table: "7", customer: "Guest", time: "10:00", openedAt, guests: "1 Guest",
    status, orderType: "DineIn", paymentStatus: "Unpaid", sessionStatus: "Open", drinks: [],
  };
}

test("inserts a newly fetched active order", () => {
  assert.deepEqual(reconcileOrdersCache([], ["new"], [order("new")]).map(({ id }) => id), ["new"]);
});

test("updates an existing order without creating a duplicate", () => {
  const result = reconcileOrdersCache([order("1")], ["1"], [order("1", "Preparing")]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "Preparing");
});

test("removes an order that no longer belongs to the active query", () => {
  assert.deepEqual(reconcileOrdersCache([order("1"), order("2")], ["1"], []).map(({ id }) => id), ["2"]);
});

test("ignores a fetched order outside the requested cafe/query scope", () => {
  assert.deepEqual(reconcileOrdersCache([order("local")], ["foreign"], [order("other")]).map(({ id }) => id), ["local"]);
});

test("is idempotent when the same realtime event arrives more than once", () => {
  const once = reconcileOrdersCache([], ["1"], [order("1")]);
  const twice = reconcileOrdersCache(once, ["1"], [order("1")]);
  assert.equal(twice.length, 1);
  assert.deepEqual(twice, once);
});

test("keeps deterministic newest-first ordering", () => {
  const result = reconcileOrdersCache(
    [order("newer", "New", "2026-09-08T11:00:00.000Z")],
    ["older"],
    [order("older", "Preparing", "2026-09-08T09:00:00.000Z")],
  );
  assert.deepEqual(result.map(({ id }) => id), ["newer", "older"]);
});
