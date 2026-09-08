import type { ManagerOrder, WorkflowStatus } from "@/shared/application/ports/manager-data-source";

function deriveSessionStatus(orders: readonly ManagerOrder[]): WorkflowStatus {
  const actionable = orders.filter((order) => order.status !== "Delivered" && order.status !== "Cancelled");
  if (!actionable.length) return orders.some((order) => order.status === "Delivered") ? "Delivered" : "Cancelled";
  if (actionable.some((order) => order.status === "Preparing")) return "Preparing";
  if (actionable.some((order) => order.status === "New")) return "New";
  return "Ready";
}

/** One visual/operational order per open table session, regardless of internal guest orders. */
export function aggregateOpenOrderSessions(orders: readonly ManagerOrder[]): ManagerOrder[] {
  const grouped = new Map<string, ManagerOrder[]>();
  orders.filter((order) => order.sessionStatus === "Open").forEach((order) => {
    const groupKey = order.sessionId ?? `table:${order.table}`;
    const group = grouped.get(groupKey) ?? [];
    group.push(order);
    grouped.set(groupKey, group);
  });
  return Array.from(grouped.values()).map((sessionOrders) => {
    const first = sessionOrders[0];
    const billable = sessionOrders.filter((order) => order.status !== "Cancelled");
    return {
      ...first,
      id: sessionOrders.map((order) => order.id).join(" + "),
      status: deriveSessionStatus(sessionOrders),
      paymentStatus: billable.length > 0 && billable.every((order) => order.paymentStatus === "Paid") ? "Paid" : "Unpaid",
      paymentMethod: billable.find((order) => order.paymentMethod)?.paymentMethod,
      drinks: sessionOrders.flatMap((order) => order.drinks),
    };
  });
}
