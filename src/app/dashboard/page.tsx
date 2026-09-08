"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ManagerSidebar } from "@/shared/presentation/components/manager-sidebar";
import { managerDataSource, managerWorkflow } from "@/shared/infrastructure/manager-services";
import type { ManagerOrder, ManagerTable, WorkflowStatus } from "@/shared/application/ports/manager-data-source";
import { Stat, StatusBadge, TableList, iconByStatus, statusColor } from "@/features/tables/presentation/components/dashboard-components";
import { ErrorState, LoadingState } from "@/shared/presentation/components/data-state";
import { printBill } from "@/features/payments/application/services/print-bill";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { PaymentDialog } from "@/features/payments/presentation/components/payment-dialog";
import { calculateBillTotals } from "@/features/payments/application/services/calculate-bill-totals";
import { aggregateOpenOrderSessions } from "@/features/orders/domain/order-sessions";
import { useManagerNotifications } from "@/features/notifications/presentation/providers/manager-notifications-provider";
import { useManagerOrders } from "@/features/orders/presentation/hooks/use-manager-orders";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { getTodayRevenue } from "@/features/payments/services/supabase-payment-summary.service";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

const statuses: WorkflowStatus[] = ["New", "Preparing", "Ready", "Cancelled"];
const productImage: Record<string, string> = { "Cardamom Cappuccino": "/images/products/cardamom-cappuccino.webp", "Ice Mocha Deluxe": "/images/products/ice-mocha-deluxe.webp", "Cold Brew Reserve": "/images/products/cold-brew-reserve.webp", "Almond Croissant": "/images/products/lotus-cheesecake.webp" };
function getDrinkImage(drink: { imageUrl?: string; name: string }) { return drink.imageUrl && /^(\/|https?:\/\/|data:image\/)/.test(drink.imageUrl) ? drink.imageUrl : productImage[drink.name]; }
function DashboardDrinkImage({ drink }: { drink: { imageUrl?: string; name: string } }) {
  const primary = getDrinkImage(drink);
  const bundledFallback = productImage[drink.name];
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const source = primary !== failedSource ? primary : bundledFallback !== failedSource ? bundledFallback : undefined;
  if (!source) return <span className="grid size-12 place-items-center rounded-lg bg-white/5 text-[#dca03a]">☕</span>;
  return <Image src={source} alt="" width={52} height={48} unoptimized className="size-12 rounded-lg object-cover" onError={() => setFailedSource(source)} />;
}
let cachedTables: ManagerTable[] = [];
let tablesCacheReady = false;

export default function DashboardPage() {
  const router = useRouter();
  const { settings } = useManagerSettings();
  const { pick } = useManagerI18n();
  const { syncNewOrderCount } = useManagerNotifications();
  const currency = settings.currency.split(" ")[0] || "EGP";
  const { orders: cachedOrders, setOrders, isLoading: ordersLoading, error: ordersError, refresh: refreshOrders } = useManagerOrders(managerDataSource);
  const orders = useMemo(() => cachedOrders.filter((order) => order.sessionStatus === "Open"), [cachedOrders]);
  const [tables, setTables] = useState<ManagerTable[]>(cachedTables);
  const [selectedTable, setSelectedTable] = useState("12");
  const [queueTab, setQueueTab] = useState<WorkflowStatus>("Preparing");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(!tablesCacheReady);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const handledPaymentLink = useRef(false);

  const refresh = useCallback(async (force = false) => {
    try {
      const [nextOrders, nextTables, nextRevenue] = await Promise.all([refreshOrders(force), managerDataSource.listTables(), getTodayRevenue()]);
      // Dashboard is an operational view: closed sessions belong in Reports,
      // never in the active table queue or bill calculation.
      const activeOrders = nextOrders.filter((order) => order.sessionStatus === "Open");
      cachedTables = [...nextTables];
      tablesCacheReady = true;
      setTables(cachedTables);
      setTodayRevenue(nextRevenue);
      syncNewOrderCount(aggregateOpenOrderSessions(activeOrders).filter((order) => order.status === "New").length);
      setLoadError(null);
    } catch (reason: unknown) {
      setLoadError(reason instanceof Error ? reason : new Error("Unable to load dashboard"));
    } finally {
      setIsLoading(false);
    }
  }, [refreshOrders, syncNewOrderCount]);

  const refreshTables = useCallback(async () => {
    const nextTables = await managerDataSource.listTables();
    cachedTables = [...nextTables];
    tablesCacheReady = true;
    setTables(cachedTables);
  }, []);

  const refreshRevenue = useCallback(async () => {
    setTodayRevenue(await getTodayRevenue());
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh(false));
  }, [refresh]);

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    let disposed = false;
    let channel: ReturnType<typeof db.channel> | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let hiddenAt: number | null = null;
    const connect = async () => {
      const cafeId = await getManagerCafeId();
      if (disposed) return;
      const previousChannel = channel;
      channel = null;
      if (previousChannel) await db.removeChannel(previousChannel);
      if (disposed) return;
      channel = db.channel(`manager-dashboard-tables:${cafeId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, () => {
          // Keep the already-open dashboard authoritative when a table session and
          // its first order are created back-to-back. The shared orders channel
          // still performs targeted updates; this event is a bounded safety
          // reconciliation for the dashboard/table summary only.
          void refreshTables().catch(() => undefined);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cafe_tables", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
          const row = payload.new as { table_number?: number; status?: string };
          if (typeof row.table_number === "number") {
            setTables((current) => current.map((table) => table.number !== String(row.table_number) ? table : {
              ...table,
              status: row.status === "available" ? "Available" : "New",
              sessionStatus: row.status === "available" ? "Closed" : "Open",
            }));
          }
          void refreshTables().catch(() => undefined);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => { void refreshTables().catch(() => undefined); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "payments" }, () => { void refreshRevenue().catch(() => undefined); })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            reconnectAttempt = 0;
            void Promise.all([refreshTables(), refreshRevenue()]).catch(() => undefined);
            return;
          }
          if (disposed || !["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) || reconnectTimer) return;
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            reconnectAttempt += 1;
            void connect();
          }, Math.min(1_000 * (2 ** reconnectAttempt), 30_000));
        });
    };
    const reconcile = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (navigator.onLine && hiddenAt && Date.now() - hiddenAt >= 60_000) {
        void refresh(true);
        void connect();
      }
      hiddenAt = null;
    };
    const reconcileOnline = () => { if (document.visibilityState === "visible") { void refresh(true); void connect(); } };
    void connect().catch(() => undefined);
    window.addEventListener("online", reconcileOnline);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", reconcileOnline);
      document.removeEventListener("visibilitychange", reconcile);
      if (channel) void db.removeChannel(channel);
    };
  }, [refresh, refreshOrders, refreshRevenue, refreshTables]);

  useEffect(() => {
    if (isLoading || handledPaymentLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const targetTable = params.get("table");
    void (async () => {
      if (targetTable) setSelectedTable(targetTable);
      if (targetTable && params.get("payment") === "1") {
        const targetOrders = (await managerDataSource.listOrders({ table: targetTable }))
          .filter((order) => order.sessionStatus === "Open" && order.status !== "Cancelled");
        setOrders((current) => [...targetOrders, ...current.filter((order) => order.table !== targetTable)]);
        const payable = targetOrders.length > 0 && targetOrders.every((order) => order.status === "Delivered") && targetOrders.some((order) => order.paymentStatus !== "Paid");
        if (payable) {
          handledPaymentLink.current = true;
          setPaymentOpen(true);
          return;
        }
        handledPaymentLink.current = true;
        params.delete("payment");
        const query = params.toString();
        router.replace(query ? `/dashboard?${query}` : "/dashboard", { scroll: false });
      }
    })().catch(() => {
      handledPaymentLink.current = true;
      params.delete("payment");
      const query = params.toString();
      router.replace(query ? `/dashboard?${query}` : "/dashboard", { scroll: false });
    });
  }, [isLoading, router, setOrders]);

  const tableOrders = useMemo(() => orders.filter((order) => order.table === selectedTable && order.sessionStatus === "Open"), [orders, selectedTable]);
  const hasClosedSession = useMemo(() => cachedOrders.some((order) => order.table === selectedTable && order.sessionStatus === "Closed"), [cachedOrders, selectedTable]);
  const selectedOrder = tableOrders[0];
  const customerGroups = useMemo(() => {
    const grouped = new Map<string, { customer: string; order: ManagerOrder; drinks: ManagerOrder["drinks"] }>();
    tableOrders.forEach((order) => order.drinks.forEach((drink) => {
      const customer = drink.recipientName || order.customer;
      const current = grouped.get(customer) ?? { customer, order: { ...order, id: `${order.id}-${customer}`, customer }, drinks: [] };
      current.drinks.push(drink);
      grouped.set(customer, current);
    }));
    return Array.from(grouped.values());
  }, [tableOrders]);
  const totalItems = tableOrders.reduce((sum, order) => sum + order.drinks.reduce((items, drink) => items + drink.quantity, 0), 0);
  const tableStatus = tableOrders.some((order) => order.status === "Preparing") ? "Preparing" : tableOrders.some((order) => order.status === "New") ? "New" : tableOrders.length && tableOrders.every((order) => ["Delivered", "Cancelled"].includes(order.status)) ? "Delivered" : tableOrders.length && tableOrders.every((order) => ["Ready", "Cancelled"].includes(order.status)) ? "Ready" : hasClosedSession ? "Done" : tables.find((table) => table.number === selectedTable)?.status ?? "New";
  const canPay = tableOrders.length > 0 && tableOrders.every((order) => ["Delivered", "Cancelled"].includes(order.status)) && tableOrders.some((order) => order.status !== "Cancelled" && order.paymentStatus !== "Paid");
  const billableOrders = tableOrders.filter((order) => order.status !== "Cancelled");
  const isPaid = billableOrders.length > 0 && billableOrders.every((order) => order.paymentStatus === "Paid");
  const billTotals = calculateBillTotals(tableOrders, settings.receipt);
  const orderSessions = useMemo(() => aggregateOpenOrderSessions(orders), [orders]);
  const counts = useMemo(() => Object.fromEntries(statuses.map((status) => [status, orderSessions.filter((order) => order.status === status).length])) as Record<WorkflowStatus, number>, [orderSessions]);
  const queue = orderSessions.filter((order) => order.status === queueTab);
  const activeTables = tables.filter((table) => table.status !== "Available").length;

  const notify = (message: string) => {
    if (message.startsWith("Alert sent")) {
      void managerWorkflow.notifyTableReady(selectedTable).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : `Unable to alert Table ${selectedTable}`);
      });
    }
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };
  const closePayment = () => {
    setPaymentOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("payment");
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard", { scroll: false });
  };
  const confirmPayment = async (receivedAmount: number, shouldPrintReceipt: boolean) => {
    const changeAmount = receivedAmount - billTotals.total;
    const receiptWindow = shouldPrintReceipt ? window.open("", "_blank", "width=500,height=760") : null;
    if (receiptWindow) receiptWindow.document.write("<p style='font:16px Arial;padding:30px'>Preparing paid receipt…</p>");
    try {
      await managerWorkflow.markTablePaid(selectedTable, "Cash", receivedAmount, changeAmount, selectedOrder?.sessionId);
      if (shouldPrintReceipt) printBill(selectedTable, tableOrders, { ...settings, footer: settings.receipt.footer, receipt: settings.receipt }, { received: receivedAmount, change: changeAmount }, receiptWindow, true);
      closePayment();
      if (selectedOrder?.orderType === "Takeaway") await managerWorkflow.closeTableSession(selectedTable);
      await refresh(true);
      notify(selectedOrder?.orderType === "Takeaway" ? `Takeaway paid${shouldPrintReceipt ? ", receipt ready," : ""} and completed` : `Cash payment confirmed for Table ${selectedTable}${shouldPrintReceipt ? " · receipt ready" : ""}`);
    } catch (error: unknown) {
      receiptWindow?.close();
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "تعذر تأكيد الدفع. حاول مرة أخرى.";
      console.error("[Payments] Cash settlement failed:", message);
      notify(message);
    }
  };

  const closePaidTable = async () => {
    if (!isPaid || tableStatus !== "Delivered" || selectedOrder?.orderType !== "DineIn") return;
    await managerWorkflow.closeTableSession(selectedTable);
    const closedSessionId = selectedOrder.sessionId;
    setTables((current) => current.map((table) => table.number !== selectedTable ? table : { ...table, status: "Available", sessionStatus: "Closed", guests: "" }));
    setOrders((current) => current.map((order) => closedSessionId && order.sessionId !== closedSessionId ? order : order.table === selectedTable ? { ...order, sessionStatus: "Closed", closedAt: new Date().toISOString() } : order));
    await refresh(true);
    notify(`Table ${selectedTable} closed and is now available`);
  };

  if (isLoading || ordersLoading) return <LoadingState label="Loading dashboard…" />;
  if (loadError || ordersError) return <ErrorState label="Unable to load dashboard. Please try again." />;

  return <main className="manager-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
    <ManagerSidebar />
    <div className="dashboard-shell min-h-screen p-3 sm:p-5 xl:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] pb-5" dir="ltr"><div className="flex items-center gap-4"><span className="text-2xl text-[var(--gold)]">☰</span><span className="text-xl font-bold">{settings.cafeName}</span><span className="h-8 w-px bg-white/15"/><h1 className="text-2xl font-semibold">{pick("Manager Dashboard", "لوحة التحكم")}</h1></div><span className="flex items-center gap-2 text-sm text-white/65"><i className="size-2 rounded-full bg-[var(--success)]"/>{pick("LIVE", "مباشر")}　 {settings.branchName}</span></header>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" dir="ltr"><Stat icon="♟" label={pick("Active Tables", "الطاولات النشطة")} sub="" value={activeTables}/><Stat icon="▤" label={pick("New Orders", "الطلبات الجديدة")} sub="" value={counts.New}/><Stat icon="♨" label={pick("Preparing", "قيد التحضير")} sub="" value={counts.Preparing}/><Stat icon="▱" label={pick("Today’s Revenue", "إيرادات اليوم")} sub="" value={todayRevenue} suffix={currency}/></section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_280px]" dir="ltr">
        <TableList tables={tables} orders={orders} selectedTable={selectedTable} onSelect={setSelectedTable}/>
        <section className="min-w-0 rounded-xl border border-white/10 bg-[#101211] p-4"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4"><div><h2 className="text-xl font-bold">Table {selectedTable}</h2><p className="mt-2 text-xs text-white/55">◷ Opened {selectedOrder?.openedAt ?? selectedOrder?.time ?? "—"}　•　♙ Cashier: {selectedOrder?.cashierName ?? "—"}</p></div><div className="session-actions"><StatusBadge status={tableStatus}/>{isPaid ? <button type="button" title="Reprint the paid receipt" onClick={() => printBill(selectedTable, tableOrders, { ...settings, footer: settings.receipt.footer, receipt: settings.receipt }, selectedOrder?.cashReceived !== undefined ? { received: selectedOrder.cashReceived, change: selectedOrder.cashChange ?? 0 } : undefined, undefined, true)} className="action-button bill-action">▣ <span>إعادة طباعة الإيصال</span></button> : null}<button type="button" onClick={() => notify(`Alert sent to Table ${selectedTable}`)} className="action-button alert-action">♧ <span>Alert Table</span></button></div></header>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_40px_75px_75px_96px] gap-2 border-b border-white/[.08] px-2 pb-2 text-xs text-white/55"><span>Order items ({totalItems})</span><span>Qty</span><span>Unit price</span><span>Total</span><span>Status</span></div>
          <div className="dashboard-drinks mt-2 space-y-2">{customerGroups.length ? customerGroups.map(({ order, drinks }) => <div key={order.id} className="flex items-stretch gap-2"><div className="flex w-[58px] shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-white/15 pr-2 text-center"><span className="grid size-8 place-items-center rounded-full border border-white/20 bg-white/[.04] text-[10px] text-white/75">{order.customer.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><span className="text-[9px] text-white/55">{order.customer}</span></div><div className="min-w-0 flex-1 space-y-2">{drinks.map((drink) => <article key={drink.id} className="grid grid-cols-[minmax(0,1fr)_40px_75px_75px_96px] items-center gap-2 rounded-lg border border-white/[.1] bg-white/[.025] p-2"><div className="flex min-w-0 items-center gap-3"><DashboardDrinkImage drink={drink} /><span className="min-w-0"><b className="block truncate text-sm">{drink.name}</b><small className="block truncate text-xs text-white/55">{[drink.size, drink.milk, drink.sugar, drink.extras].filter((value) => value !== "None").join(" · ") || "Standard"}</small></span></div><span className="text-sm">{drink.quantity}</span><span className="text-xs text-white/70">{drink.unitPrice} {currency}</span><span className="text-xs text-white/70">{drink.quantity * drink.unitPrice} {currency}</span><span className={`inline-flex min-w-[82px] items-center justify-center rounded-full border border-current/25 bg-white/[.035] px-2 py-1.5 text-[10px] font-medium ${statusColor[drink.status]}`}>{iconByStatus[drink.status]} {drink.status}</span></article>)}</div></div>) : <p className="py-10 text-center text-sm text-white/45">No active order for this table.</p>}</div>
          <footer className="mt-4 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2"><div className="flex items-center gap-4"><span className="grid size-16 place-items-center rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/10 text-[var(--gold)]"><svg viewBox="0 0 48 48" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="10" y="5" width="28" height="38" rx="3"/><path d="M16 13h16M16 21h16M16 29h5M27 29h5M16 36h5M27 36h5"/></svg></span><div><p className="text-sm text-white/70">Combined Table Total</p><strong className="text-4xl">{billTotals.total.toLocaleString()} <small className="text-lg font-medium text-white/55">{currency}</small></strong><p className="text-xs text-white/45">إجمالي طلب الطاولة · {totalItems} items</p></div></div><div><label className="mb-2 block text-sm">Payment</label><div className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${isPaid ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/20 text-white/55"}`}><span>{isPaid ? `Paid · ${selectedOrder?.paymentMethod ?? ""}` : tableStatus === "Delivered" ? "Ready for payment" : "Available after delivery"}</span><span>{isPaid ? "✓" : "▣"}</span></div>{isPaid && selectedOrder?.orderType === "DineIn" ? <button type="button" onClick={() => void closePaidTable()} className="mt-2 w-full rounded-lg bg-[#e5aa3a] py-2.5 text-sm font-bold text-[#17120a]">○ Customer left · Close table</button> : <button type="button" disabled={!canPay} onClick={() => setPaymentOpen(true)} className="mt-2 w-full rounded-lg bg-[#e5aa3a] py-2.5 text-sm font-bold text-[#17120a] disabled:cursor-not-allowed disabled:opacity-40">▣　{isPaid ? "Payment completed" : "Collect Cash"}</button>}</div></footer>
        </section>
        <aside className="rounded-xl border border-white/10 bg-[#101211] p-4"><header className="border-b border-white/10 pb-3"><h2 className="text-xl font-bold">Order Queue</h2><div className="mt-4 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">{statuses.map((status) => <button key={status} type="button" onClick={() => setQueueTab(status)} className={`queue-tab ${queueTab === status ? "is-active" : ""}`}><span>{iconByStatus[status]}</span>{status}<b>{counts[status]}</b></button>)}</div></header><div className="space-y-3 py-4">{queue.map((order) => <button type="button" key={order.id} onClick={() => setSelectedTable(order.table)} className="w-full rounded-lg border border-white/10 bg-white/[.025] p-3 text-left transition hover:border-[var(--gold)]/50"><div className="flex items-center justify-between"><b>Table {order.table}</b><span className="text-xs text-white/50">{order.drinks.reduce((sum, drink) => sum + drink.quantity, 0)} Items　•　{order.time}</span></div><div className="mt-3 flex justify-between text-xs"><span className={statusColor[order.status]}>{iconByStatus[order.status]} {order.status}</span><span className="text-white/55">♙ {order.customer}</span></div></button>)}{!queue.length && <p className="py-8 text-center text-sm text-white/45">No {queueTab.toLowerCase()} orders.</p>}</div>{queueTab === "Ready" && <button type="button" onClick={() => router.push("/orders?status=Ready")} className="w-full rounded-lg border border-[var(--gold)]/50 py-3 text-sm text-[var(--gold)]">View All Ready Orders ({counts.Ready})　›</button>}</aside>
      </section>
      {notice && <div className="fixed right-6 top-6 z-50 rounded-xl border border-[var(--success)]/60 bg-[#12251b] px-4 py-3 text-sm text-[#d9ffe8]">✓ {notice}</div>}
      {paymentOpen && <PaymentDialog key={`${selectedTable}-cash`} open reference={`Table ${selectedTable}`} orderType={selectedOrder?.orderType ?? "DineIn"} orders={tableOrders} currency={currency} {...billTotals} onCancel={closePayment} onPrintBill={() => printBill(selectedTable, tableOrders, { ...settings, footer: settings.receipt.footer, receipt: settings.receipt })} onConfirm={confirmPayment} />}
    </div>
  </main>;
}
