import type { ManagerOrder } from "@/shared/application/ports/manager-data-source";

export type ChargeSettings = {
  serviceEnabled: boolean;
  serviceType: "percent" | "fixed";
  serviceValue: number;
  taxEnabled: boolean;
  taxType: "percent" | "fixed";
  taxValue: number;
};

export function calculateBillTotals(orders: readonly ManagerOrder[], settings: ChargeSettings) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round(orders.flatMap((order) => order.drinks).filter((drink) => drink.status !== "Cancelled").reduce((sum, drink) => sum + drink.quantity * drink.unitPrice, 0));
  const service = round(settings.serviceEnabled ? settings.serviceType === "percent" ? subtotal * settings.serviceValue / 100 : settings.serviceValue : 0);
  const taxableAmount = subtotal + service;
  const tax = round(settings.taxEnabled ? settings.taxType === "percent" ? taxableAmount * settings.taxValue / 100 : settings.taxValue : 0);
  return { subtotal, service, tax, total: round(subtotal + service + tax) };
}
