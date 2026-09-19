import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatReceiptDateTime } from "../src/features/payments/application/services/receipt-format.ts";

const migration = readFileSync(
  "D:/tester/supabase/migrations/202609190002_session_receipt_numbers.sql",
  "utf8",
);

test("receipt numbering is atomic, cafe-scoped, and unique per table session", () => {
  assert.match(migration, /unique \(session_id\)/i);
  assert.match(migration, /unique \(cafe_id, receipt_number\)/i);
  assert.match(migration, /on conflict\(cafe_id\) do update set last_number=public\.cafe_receipt_counters\.last_number\+1/i);
  assert.match(migration, /for update of s/i);
});

test("cash settlement reuses the canonical receipt on retry", () => {
  assert.match(migration, /select \* into v_existing from public\.session_receipts where session_id = p_session_id/i);
  assert.match(migration, /'reused',true/i);
  assert.match(migration, /'receipt_number',v_existing\.receipt_number/i);
  assert.match(migration, /'receipt_issued_at',v_existing\.issued_at/i);
});

test("receipt timestamp formatting is valid for both supported locales", () => {
  const issuedAt = "2026-09-19T12:34:00.000Z";
  for (const locale of ["en", "ar"] as const) {
    const formatted = formatReceiptDateTime(issuedAt, locale);
    assert.notEqual(formatted.date, "—");
    assert.notEqual(formatted.time, "—");
  }
});

test("invalid receipt timestamps never print as Invalid Date", () => {
  assert.deepEqual(formatReceiptDateTime("not-a-date", "en"), { date: "—", time: "—" });
});
