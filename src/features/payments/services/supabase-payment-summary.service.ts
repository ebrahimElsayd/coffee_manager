import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";

type PaymentSummaryRow = {
  amount: number | string | null;
  grand_total: number | string | null;
};

export async function getTodayRevenue(): Promise<number> {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase unavailable");
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const aggregated = await db.rpc("manager_get_paid_revenue", { p_start: start.toISOString(), p_end: end.toISOString() });
  if (!aggregated.error) return Number(aggregated.data ?? 0);
  if (aggregated.error.code !== "PGRST202" && aggregated.error.code !== "42883") throw aggregated.error;

  const cafeId = await getManagerCafeId();

  const result = await db.from("payments")
    .select("amount,grand_total,table_sessions!inner(cafe_tables!inner(cafe_id))")
    .eq("status", "paid")
    .eq("table_sessions.cafe_tables.cafe_id", cafeId)
    .gte("paid_at", start.toISOString())
    .lt("paid_at", end.toISOString());
  if (result.error) throw result.error;

  return ((result.data ?? []) as unknown as PaymentSummaryRow[]).reduce(
    (total, payment) => total + Number(payment.grand_total ?? payment.amount ?? 0),
    0,
  );
}
