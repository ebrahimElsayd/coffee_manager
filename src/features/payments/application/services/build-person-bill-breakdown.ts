import type { ManagerDrink, ManagerOrder } from "@/shared/application/ports/manager-data-source";

export type PersonBill = {
  name: string;
  drinks: ManagerDrink[];
  subtotal: number;
  total: number;
};

/** Charges belong to the whole table bill, never to an individual guest. */
export function buildPersonBillBreakdown(orders: readonly ManagerOrder[]): PersonBill[] {
  const grouped = new Map<string, ManagerDrink[]>();
  orders.forEach((order) => order.drinks.filter((drink) => drink.status !== "Cancelled").forEach((drink) => {
    const owner = drink.recipientName || order.customer;
    grouped.set(owner, [...(grouped.get(owner) ?? []), drink]);
  }));

  return Array.from(grouped, ([name, drinks]) => {
    const subtotal = drinks.reduce((sum, drink) => sum + drink.quantity * drink.unitPrice, 0);
    return { name, drinks, subtotal, total: subtotal };
  });
}
