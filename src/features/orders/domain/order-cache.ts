import type { Order } from "./manager-order";

function openedAt(order: Order) {
  const value = Date.parse(order.openedAt ?? "");
  return Number.isFinite(value) ? value : 0;
}

/** Reconciles only the IDs fetched after a realtime invalidation. Missing IDs leave the active list. */
export function reconcileOrdersCache(
  current: readonly Order[],
  requestedIds: readonly string[],
  fetched: readonly Order[],
): Order[] {
  const requested = new Set(requestedIds.filter(Boolean));
  const byId = new Map(current.filter((order) => !requested.has(order.id)).map((order) => [order.id, order]));

  for (const order of fetched) {
    if (requested.has(order.id)) byId.set(order.id, order);
  }

  return [...byId.values()].sort((a, b) => openedAt(b) - openedAt(a));
}
