import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationRoot = "D:/tester/supabase/migrations";
const readMigration = (name: string) => readFileSync(`${migrationRoot}/${name}`, "utf8");

test("customer submit contract is atomic and records the full order lifecycle", () => {
  const sql = readMigration("202609050013_atomic_submit_table_order.sql");
  assert.match(sql, /create or replace function public\.submit_table_order/i);
  assert.match(sql, /insert into public\.orders/i);
  assert.match(sql, /insert into public\.order_items/i);
  assert.match(sql, /insert into public\.order_status_history/i);
  assert.match(sql, /update public\.carts[\s\S]*submitted/i);
});

test("manager close contract requires terminal orders and paid bills", () => {
  const sql = readMigration("202609050016_atomic_close_table_session.sql");
  assert.match(sql, /manager_close_table_session/i);
  assert.match(sql, /delivered or cancelled/i);
  assert.match(sql, /invoice must be paid/i);
  assert.match(sql, /update public\.cafe_tables set status = 'available'/i);
});

test("cross-app notification contract is persistent and realtime-enabled", () => {
  const sql = readMigration("202609050010_persistent_notifications.sql");
  assert.match(sql, /alter publication supabase_realtime add table public\.notifications/i);
  assert.match(sql, /orders_notify_created/i);
  assert.match(sql, /orders_notify_status/i);
  assert.match(sql, /order_items_notify_status/i);
  assert.match(sql, /on conflict \(event_key\) do nothing/i);
});

test("customer menu contract is cafe-scoped", () => {
  const sql = readMigration("202609050018_scope_customer_catalog.sql");
  assert.match(sql, /members can read cafe products/i);
  assert.match(sql, /menu_products\.cafe_id/i);
  assert.match(sql, /members can read cafe categories/i);
});

test("customer table entry uses one atomic session operation", () => {
  const sql = readMigration("202609050019_atomic_customer_table_entry.sql");
  assert.match(sql, /customer_open_table_session/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /on conflict \(session_id, auth_user_id\) do nothing/i);
});

test("customer session RPC has no SQL output-column collision", () => {
  const sql = readMigration("202609050020_fix_customer_session_rpc.sql");
  assert.match(sql, /create or replace function public\.customer_open_table_session/i);
  assert.match(sql, /on conflict on constraint table_guests_session_id_auth_user_id_key do nothing/i);
  assert.match(sql, /security invoker/i);
});

test("manager cancellation is atomic and records item history", () => {
  const sql = readMigration("202609050022_atomic_cancel_order.sql");
  assert.match(sql, /create or replace function public\.manager_cancel_order/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /update public\.orders[\s\S]*status = 'cancelled'/i);
  assert.match(sql, /update public\.order_items[\s\S]*status = 'cancelled'/i);
  assert.match(sql, /insert into public\.item_status_history/i);
  assert.match(sql, /insert into public\.order_status_history/i);
});

test("manager item cancellation uses the shared atomic status operation", () => {
  const source = readFileSync("D:/coffee_managar/src/shared/infrastructure/supabase/supabase-manager-data-source.ts", "utf8");
  assert.match(source, /cancelDrink[\s\S]*manager_set_order_item_status/i);
  assert.doesNotMatch(source, /cancelDrink[\s\S]*from\("order_items"\)\.update/i);
});

test("customer bootstrap is cafe-scoped and does not expose table directories", () => {
  const sql = readMigration("202609050023_harden_customer_bootstrap_rls.sql");
  assert.match(sql, /drop policy if exists "authenticated users can read tables"/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /p_cafe_id is null/i);
  assert.match(sql, /members can read sessions/i);
  assert.match(sql, /members can update own guest/i);
});

test("full customer-to-manager order lifecycle contract is present", () => {
  const submit = readMigration("202609050013_atomic_submit_table_order.sql");
  const manager = readMigration("202609050005_atomic_manager_operations.sql");
  const close = readMigration("202609050016_atomic_close_table_session.sql");
  const notifications = readMigration("202609050010_persistent_notifications.sql");
  assert.match(submit, /submit_table_order/i);
  assert.match(submit, /status[\s\S]*'received'/i);
  assert.match(manager, /manager_set_order_status/i);
  assert.match(manager, /ready|served|cancelled/i);
  assert.match(manager, /manager_record_cash_payment/i);
  assert.match(close, /manager_close_table_session/i);
  assert.match(close, /invoice must be paid/i);
  assert.match(notifications, /orders_notify_created/i);
  assert.match(notifications, /orders_notify_status/i);
});

test("an already-open dashboard reconciles the first order without polling", () => {
  const source = readFileSync("D:/coffee_managar/src/app/dashboard/page.tsx", "utf8");
  assert.match(source, /event:\s*"INSERT"[\s\S]*table:\s*"orders"[\s\S]*filter:\s*`cafe_id=eq\.\$\{cafeId\}`/i);
  assert.match(source, /refreshTables\(\)/i);
  assert.doesNotMatch(source, /refreshOrders\(true\)/i);
  assert.doesNotMatch(source, /setInterval\s*\(/i);
});
