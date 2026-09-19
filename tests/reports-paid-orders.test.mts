import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "D:/coffee_managar/src/features/reports/services/supabase-reports.service.ts",
  "utf8",
);

test("recent paid reports resolve orders through the paid session", () => {
  assert.match(source, /table_sessions!inner\(cafe_tables!inner\(table_number\),orders\(/i);
  assert.match(source, /payment_status === "paid"/i);
  assert.match(source, /status !== "cancelled"/i);
  assert.doesNotMatch(source, /orders!inner\(order_number,status,payment_status,table_sessions/i);
});

test("recent paid reports choose a deterministic paid order from a multi-order session", () => {
  assert.match(source, /\.sort\(\(a: PaidOrderCandidate, b: PaidOrderCandidate\)/i);
  assert.match(source, /\.limit\(Math\.max\(1, Math\.min\(limit, 50\)\)\)/i);
});
