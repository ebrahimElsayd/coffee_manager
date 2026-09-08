"use client";

import { useEffect, useState } from "react";
import { ManagerSidebar } from "@/shared/presentation/components/manager-sidebar";
import { getReportsSnapshot, subscribeToPaidPayments, type ReportRange, type ReportSnapshot } from "@/features/reports/services/supabase-reports.service";
import { exportReportPdf } from "@/features/reports/services/export-report-pdf.service";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

const emptyReport: ReportSnapshot = { totalSales: 0, orderCount: 0, averageOrder: 0, products: [], chart: [] };
export default function ReportsPage() {
  const { pick } = useManagerI18n();
  const [range, setRange] = useState<ReportRange>("Last 7 days");
  const [report, setReport] = useState<ReportSnapshot>(emptyReport);
  useEffect(() => {
    let active = true;
    const refresh = () => { void getReportsSnapshot(range).then((value) => { if (active) setReport(value); }).catch(() => { if (active) setReport(emptyReport); }); };
    refresh();
    const unsubscribe = subscribeToPaidPayments(refresh);
    const wake = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", wake);
    return () => { active = false; unsubscribe(); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", wake); };
  }, [range]);
  const products = report.products;
  const totalSales = report.totalSales;
  const totalOrderCount = report.orderCount;
  const topProduct = products[0];
  const maxChartAmount = Math.max(...report.chart.map((point) => point.amount), 1);
  const maxProductSold = Math.max(...products.map((product) => product.sold), 1);
  const sales = report.chart.map((point) => (point.amount / maxChartAmount) * 100);
  const days = report.chart.map((point) => point.label);
  const exportReport = () => { void exportReportPdf(report, range); };
  return <main className="manager-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
    <ManagerSidebar />
    <div className="min-h-screen p-4 sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[.08] pb-6">
        <div><p className="text-xs uppercase tracking-[.25em] text-[var(--gold)]">{pick("Business insights", "تحليلات الأعمال")}</p><h1 className="mt-1 font-serif text-4xl">{pick("Reports", "التقارير")}</h1><p className="mt-1 text-sm text-white/45">{pick("Cafe performance and sales summary", "ملخص أداء الكافيه والمبيعات")}</p></div>
        <div className="flex items-center gap-3"><select value={range} onChange={(event) => setRange(event.target.value as ReportRange)} className="rounded-xl border border-white/15 bg-[#111312] px-4 py-3 text-sm text-white outline-none focus:border-[var(--gold)]"><option value="Today">{pick("Today", "اليوم")}</option><option value="Last 7 days">{pick("Last 7 days", "آخر 7 أيام")}</option><option value="Last 30 days">{pick("Last 30 days", "آخر 30 يومًا")}</option></select><button type="button" onClick={exportReport} className="rounded-xl border border-[var(--gold)]/60 px-5 py-3 text-sm text-[#f5ca72] transition hover:bg-[var(--gold)]/10">⇩ {pick("Export", "تصدير")}</button></div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon="₤" label={pick("Total Sales", "إجمالي المبيعات")} value={totalSales.toLocaleString()} suffix="EGP" trend="Live" />
        <Metric icon="▤" label={pick("Orders", "عدد الطلبات")} value={String(totalOrderCount)} trend="Live" />
        <Metric icon="◈" label={pick("Average Order", "متوسط الطلب")} value={Math.round(report.averageOrder).toLocaleString()} suffix="EGP" trend="Live" />
        <Metric icon="♨" label={pick("Top Product", "الأكثر مبيعًا")} value={String(topProduct?.sold ?? 0)} suffix={pick("sold", "مباع")} trend={topProduct?.name ?? "—"} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <article className="rounded-2xl border border-white/15 bg-[#111312] p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-serif text-xl">{pick("Sales Overview", "نظرة عامة على المبيعات")}</h2><p className="mt-1 text-xs text-white/40">{pick("Sales in the selected period", "المبيعات خلال الفترة المحددة")}</p></div><span className="rounded-lg bg-[#5ca66b]/10 px-2.5 py-1.5 text-xs text-[#9ce5ad]">{pick("Live data", "بيانات مباشرة")}</span></div><div className="mt-7 flex h-52 items-end gap-3 border-b border-s border-white/10 px-2 sm:gap-6">{sales.map((value, index) => <div key={report.chart[index].date} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-[#a86d18] to-[#f1c15d] transition hover:brightness-125" style={{ height: `${value}%` }} /><span className="text-[10px] text-white/40">{days[index]}</span></div>)}</div><div className="mt-4 flex justify-between text-xs text-white/35"><span>0 EGP</span><span>{maxChartAmount.toLocaleString()} EGP</span></div></article>
        <article className="rounded-2xl border border-white/15 bg-[#111312] p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-serif text-xl">{pick("Popular Products", "المنتجات الأكثر مبيعًا")}</h2><p className="mt-1 text-xs text-white/40">{pick("Ranked by sold quantity", "مرتبة حسب الكمية المباعة")}</p></div><span className="text-xs text-[var(--gold)]">{pick("View all", "عرض الكل")} ›</span></div><div className="mt-5 space-y-4">{products.slice(0, 5).map((product, index) => <div key={product.name} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--gold)]/[.1] text-sm text-[#f5ca72]">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="truncate text-xs">{product.name}</b><span className="shrink-0 text-xs text-white/60">{product.sold}</span></div><p className="mt-1 text-[10px] text-white/40">{product.arabic}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.max(18, (product.sold / maxProductSold) * 100)}%` }} /></div></div></div>)}</div></article>
      </section>
      <p className="mt-5 text-center text-xs text-white/30">{pick("Reports are calculated from paid orders for the selected period.", "تُحسب التقارير من الطلبات المدفوعة خلال الفترة المحددة.")}</p>
    </div>
  </main>;
}

function Metric({ icon, label, value, suffix, trend }: { icon: string; label: string; value: string; suffix?: string; trend: string }) {
  return <article className="rounded-2xl border border-[var(--gold)]/35 bg-[#111312] p-5 transition hover:-translate-y-0.5 hover:border-[var(--gold)]/70"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[var(--gold)]/[.1] text-xl text-[#eab454]">{icon}</span><span className="text-[10px] text-[#7fe29b]">{trend.includes("%") ? trend : ""}</span></div><p className="mt-4 text-xs text-white/55">{label}</p><strong className="mt-1 block text-2xl">{value} {suffix && <small className="text-sm font-medium text-white/45">{suffix}</small>}</strong>{!trend.includes("%") && <p className="mt-1 truncate text-[10px] text-[var(--gold)]">{trend}</p>}</article>;
}
