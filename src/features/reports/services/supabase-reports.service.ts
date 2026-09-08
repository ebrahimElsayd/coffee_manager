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

export function subscribeToPaidPayments(onChange: () => void): () => void {
  const db = getSupabaseBrowserClient();
  if (!db) return () => undefined;
  const channel = db.channel(`reports-paid-payments-${generateSafeUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: "status=eq.paid" }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments", filter: "status=eq.paid" }, onChange)
    .subscribe();
  return () => { void db.removeChannel(channel); };
}
