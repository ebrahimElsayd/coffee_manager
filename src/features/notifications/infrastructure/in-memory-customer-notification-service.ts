import type { CustomerNotificationService } from "../application/ports/customer-notification-service";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { generateSafeUUID } from "@/shared/utils/uuid";

class SupabaseCustomerNotificationService implements CustomerNotificationService {
  async notifyTableReady(table: string) {
    const db = getSupabaseBrowserClient();
    if (!db) throw new Error("Supabase is not configured");
    const cafeId = await getManagerCafeId();
    const session = await db.from("table_sessions")
      .select("id,table_id,cafe_tables!inner(cafe_id,table_number)")
      .eq("cafe_tables.cafe_id", cafeId)
      .eq("cafe_tables.table_number", Number(table))
      .in("status", ["open", "ordering", "payment_pending"])
      .maybeSingle();
    if (session.error) throw session.error;
    if (!session.data) throw new Error(`No active session for table ${table}`);
    const inserted = await db.from("notifications").insert({
      session_id: session.data.id,
      cafe_id: cafeId,
      table_id: session.data.table_id,
      type: "customer_alert",
      title: "تنبيه من الكاشير",
      body: `يرجى الانتباه إلى طلب Table ${table}`,
      event_key: `cashier-alert:${generateSafeUUID()}`,
    }).select("id,session_id,title,created_at").single();
    if (inserted.error) throw inserted.error;
    return { id: inserted.data.id, table, type: "table-ready" as const, createdAt: inserted.data.created_at };
  }

  async list() {
    const db = getSupabaseBrowserClient();
    if (!db) return [];
    const cafeId = await getManagerCafeId();
    const result = await db.from("notifications")
      .select("id,cafe_id,table_id,title,created_at,table_sessions!inner(cafe_tables!inner(cafe_id,table_number))")
      .eq("table_sessions.cafe_tables.cafe_id", cafeId)
      .order("created_at", { ascending: false }).limit(100);
    if (result.error) throw result.error;
    return (result.data ?? []).flatMap((raw) => {
      const row = raw as unknown as { id: string; created_at: string; table_sessions: { cafe_tables: { table_number: number } | { table_number: number }[] } | { cafe_tables: { table_number: number } | { table_number: number }[] }[] | null };
      const session = Array.isArray(row.table_sessions) ? row.table_sessions[0] : row.table_sessions;
      const relation = session?.cafe_tables;
      const table = Array.isArray(relation) ? relation[0]?.table_number : relation?.table_number;
      return typeof table === "number" ? [{ id: row.id, table: String(table), type: "table-ready" as const, createdAt: row.created_at }] : [];
    });
  }
}

export const customerNotificationService: CustomerNotificationService = new SupabaseCustomerNotificationService();
