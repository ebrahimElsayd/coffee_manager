import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard settles only unpaid orders and keeps paid visit awaiting departure", async () => {
  const source = await readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(source, /unpaidBillOrders = activeBillOrders\.filter\(\(order\) => order\.paymentStatus !== "Paid"\)/);
  assert.match(source, /calculateBillTotals\(isPaid \? activeBillOrders : unpaidBillOrders/);
  assert.match(source, /orders=\{unpaidBillOrders\}/);
  assert.match(source, /Paid · waiting for customer to leave/);
  assert.match(source, /Customer left · Close table/);
});
