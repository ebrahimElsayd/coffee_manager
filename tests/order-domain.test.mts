import test from "node:test";
import assert from "node:assert/strict";
import { getDrinkDetails } from "../src/features/orders/domain/manager-order.ts";
import { calculateBillTotals } from "../src/features/payments/application/services/calculate-bill-totals.ts";
import { buildPersonBillBreakdown } from "../src/features/payments/application/services/build-person-bill-breakdown.ts";
import type { ManagerOrder } from "../src/shared/application/ports/manager-data-source.ts";

const orders: ManagerOrder[] = [{
  id: "1", table: "3", customer: "Ahmed", time: "10:00", guests: "2 Guests",
  status: "Preparing", orderType: "DineIn", paymentStatus: "Unpaid", sessionStatus: "Open",
  drinks: [
    { id: "a", name: "Cola", recipientName: "Ahmed", quantity: 2, unitPrice: 30, note: "", status: "Ready", selectedOptions: [] },
    { id: "b", name: "Latte", recipientName: "Mona", quantity: 1, unitPrice: 50, note: "", status: "Preparing", selectedOptions: [{ groupLabel: "Milk", optionLabel: "Oat", priceDelta: 10 }] },
    { id: "c", name: "Cancelled", recipientName: "Mona", quantity: 1, unitPrice: 99, note: "", status: "Cancelled" },
  ],
}];

test("dynamic drink details support arbitrary options and empty products", () => {
  assert.deepEqual(getDrinkDetails(orders[0].drinks[0]), []);
  assert.deepEqual(getDrinkDetails(orders[0].drinks[1]), [{ label: "Milk", value: "Oat" }]);
});

test("bill totals exclude cancelled items and apply service before tax", () => {
  assert.deepEqual(calculateBillTotals(orders, {
    serviceEnabled: true, serviceType: "percent", serviceValue: 10,
    taxEnabled: true, taxType: "percent", taxValue: 14,
  }), { subtotal: 110, service: 11, tax: 16.94, total: 137.94 });
});

test("empty or fully cancelled tables never retain fixed charges", () => {
  const fixedCharges = {
    serviceEnabled: true, serviceType: "fixed" as const, serviceValue: 20,
    taxEnabled: true, taxType: "fixed" as const, taxValue: 14,
  };
  assert.deepEqual(calculateBillTotals([], fixedCharges), { subtotal: 0, service: 0, tax: 0, total: 0 });
  assert.deepEqual(calculateBillTotals([{ ...orders[0], drinks: [orders[0].drinks[2]] }], fixedCharges), {
    subtotal: 0, service: 0, tax: 0, total: 0,
  });
});

test("person breakdown groups each customer with their own active drinks", () => {
  const people = buildPersonBillBreakdown(orders);
  assert.deepEqual(people.map(({ name, total }) => ({ name, total })), [
    { name: "Ahmed", total: 60 },
    { name: "Mona", total: 50 },
  ]);
});
