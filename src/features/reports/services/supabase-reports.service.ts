import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { generateSafeUUID } from "@/shared/utils/uuid";

export type ReportRange = "Today" | "Last 7 days" | "Last 30 days";
export type ReportProduct = { name: string; arabic: string; sold: number; revenue: number };
export type ReportSnapshot = {
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  products: ReportProduct[];
  chart: { label: string; date: string; amount: number }[];
};
export type ReportOrder = {
  orderNumber: number;
  tableNumber: number | null;
  total: number;
  paidAt: string;
  method: string;
};


function startOfLocalDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function getReportPeriod(range: ReportRange, now = new Date()) {
  const end = startOfLocalDay(now);
  end.setDate(end.getDate() + 1);
  const start = startOfLocalDay(now);
  if (range === "Last 7 days") start.setDate(start.getDate() - 6);
  if (range === "Last 30 days") start.setDate(start.getDate() - 29);
  return { start, end };
}

function buildCalendar(start: Date, end: Date): ReportSnapshot["chart"] {
  const points: ReportSnapshot["chart"] = [];
  for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
    points.push({ date: dateKey(cursor), label: cursor.toLocaleDateString("en-US", { weekday: "short" }), amount: 0 });
  }
  return points;
}

export async function getReportsSnapshot(range: ReportRange): Promise<ReportSnapshot> {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase unavailable");
  const { start, end } = getReportPeriod(range);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const aggregated = await db.rpc("manager_get_report_snapshot", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_timezone: timezone,
  });
  if (!aggregated.error && aggregated.data && typeof aggregated.data === "object") {
    const row = aggregated.data as unknown as {
      totalSales?: unknown;
      orderCount?: unknown;
      products?: Array<{ name?: unknown; arabic?: unknown; sold?: unknown; revenue?: unknown }>;
      chart?: Array<{ date?: unknown; amount?: unknown }>;
    };
    const totalSales = Number(row.totalSales ?? 0);
    const orderCount = Number(row.orderCount ?? 0);
    const chart = buildCalendar(start, end);
    const amounts = new Map((row.chart ?? []).map((point) => [String(point.date ?? ""), Number(point.amount ?? 0)]));
    for (const point of chart) point.amount = amounts.get(point.date) ?? 0;
    const products = (row.products ?? []).map((product) => ({
      name: String(product.name ?? ""),
      arabic: String(product.arabic ?? ""),
      sold: Number(product.sold ?? 0),
      revenue: Number(product.revenue ?? 0),
    }));
    return { totalSales, orderCount, averageOrder: orderCount ? totalSales / orderCount : 0, products, chart };
  }
  throw aggregated.error ?? new Error("Report aggregation RPC is unavailable");
}

export async function getRecentPaidOrders(range: ReportRange, limit = 10): Promise<ReportOrder[]> {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase unavailable");
  const { start, end } = getReportPeriod(range);
  const { data, error } = await db.from("payments")
    .select("grand_total,amount,method,paid_at,orders!inner(order_number,status,payment_status,table_sessions!inner(cafe_tables!inner(table_number)))")
    .eq("status", "paid")
    .gte("paid_at", start.toISOString())
    .lt("paid_at", end.toISOString())
    .order("paid_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw error;
  return ((data ?? []) as unknown[]).flatMap((entry) => {
    const row = entry as { grand_total?: unknown; amount?: unknown; method?: unknown; paid_at?: unknown; orders?: unknown };
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders as { order_number?: unknown; status?: unknown; payment_status?: unknown; table_sessions?: unknown } | undefined;
    if (!order || order.status === "cancelled" || order.payment_status !== "paid") return [];
    const session = Array.isArray(order.table_sessions) ? order.table_sessions[0] : order.table_sessions as { cafe_tables?: unknown } | undefined;
    const table = session && (Array.isArray(session.cafe_tables) ? session.cafe_tables[0] : session.cafe_tables as { table_number?: unknown } | undefined);
    return [{
      orderNumber: Number(order.order_number ?? 0),
      tableNumber: table?.table_number == null ? null : Number(table.table_number),
      total: Number(row.grand_total ?? row.amount ?? 0),
      paidAt: String(row.paid_at ?? ""),
      method: String(row.method ?? "—"),
    }];
  });
}

export function subscribeToPaidPayments(onChange: () => void): () => void {
  const db = getSupabaseBrowserClient();
  if (!db) return () => undefined;
  const channel = db.channel(`reports-paid-payments-${generateSafeUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: "status=eq.paid" }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments", filter: "status=eq.paid" }, onChange)
    .subscribe();
  return () => { void db.removeChannel(channel); };
}
