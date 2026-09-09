"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagerSidebar } from "@/shared/presentation/components/manager-sidebar";
import { managerDataSource, managerWorkflow } from "@/shared/infrastructure/manager-services";
import { useManagerOrders } from "@/features/orders/presentation/hooks/use-manager-orders";
import { deriveOrderStatus, type DrinkStatus, type OrderStatus } from "@/features/orders/domain/manager-order";
import { OrderDetails, OrderTablesQueue, TabButton } from "@/features/orders/presentation/components/order-components";
import { ErrorState, LoadingState } from "@/shared/presentation/components/data-state";
import { useManagerNotifications } from "@/features/notifications/presentation/providers/manager-notifications-provider";
import { aggregateOpenOrderSessions } from "@/features/orders/domain/order-sessions";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";


const tabs: { label: OrderStatus | "All"; color: string }[] = [
  { label: "New", color: "text-[#69a9ff]" }, { label: "Preparing", color: "text-[#f4b43f]" },
  { label: "Ready", color: "text-[#73d68d]" }, { label: "Delivered", color: "text-[#c9a7ff]" }, { label: "Cancelled", color: "text-[#f27d72]" },
];

type PendingCancellation = { kind: "table" } | { kind: "drink"; drinkId: string };

function explainStatusSaveError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  const match = raw.match(/Invalid (?:item|order) transition:\s*([a-z_]+)\s*[-→>]\s*([a-z_]+)/i);
  if (match) {
    const labels: Record<string, string> = { received: "New", preparing: "Preparing", ready: "Ready", served: "Delivered", completed: "Completed", cancelled: "Cancelled" };
    const from = labels[match[1].toLowerCase()] ?? match[1];
    const to = labels[match[2].toLowerCase()] ?? match[2];
    return `لا يمكن تغيير الحالة من ${from} إلى ${to}. اتبع التسلسل: New ثم Preparing ثم Ready ثم Delivered.`;
  }
  if (raw.includes("was not found")) return "تعذر العثور على الطلب أو المشروب. حدّث الصفحة وحاول مرة أخرى.";
  if (raw.includes("must be ready before delivery")) return "يجب تحديد المشروب كجاهز قبل تسجيل تسليمه للعميل.";
  if (raw.includes("terminal") || raw.includes("cannot be changed")) return "هذه الحالة نهائية ولا يمكن تعديلها مرة أخرى.";
  if (raw.includes("missing or closed")) return "الجلسة مغلقة أو لم تعد متاحة لهذا الطلب.";
  return fallback;
}

function OrdersPage() {
  const router = useRouter();
  const { pick, statusLabel } = useManagerI18n();
  const searchParams = useSearchParams();
  const { orders, setOrders, isLoading, error, beginMutation, settleMutation } = useManagerOrders(managerDataSource);
  const { pushInfo, syncNewOrderCount } = useManagerNotifications();
  const requestedStatus = searchParams.get("status");
  const requestedTable = searchParams.get("table");
  const initialFilter = requestedStatus && ["New", "Preparing", "Ready", "Delivered", "Cancelled"].includes(requestedStatus) ? requestedStatus as OrderStatus : "All";
  const [selectedTable, setSelectedTable] = useState(() => requestedTable || "12");
  const [acknowledgedNewOrders, setAcknowledgedNewOrders] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<OrderStatus | "All">(initialFilter);
  const [search, setSearch] = useState("");
  const [tableStatus, setTableStatus] = useState<OrderStatus>("Preparing");
  const [pendingCancellation, setPendingCancellation] = useState<PendingCancellation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  useEffect(() => {
    if (isLoading) return;
    syncNewOrderCount(aggregateOpenOrderSessions(orders).filter((order) => order.status === "New").length);
  }, [isLoading, orders, syncNewOrderCount]);

  const activeFilter: OrderStatus | "All" = filter;
  const orderSessions = useMemo(() => aggregateOpenOrderSessions(orders), [orders]);

  const visibleOrders = useMemo(() => orderSessions.filter((order) => {
    const matchesFilter = activeFilter === "All" ? order.status !== "Cancelled" : order.status === activeFilter;
    const query = search.trim().toLowerCase();
    return matchesFilter && (!query || `${order.id} ${order.table} ${order.customer}`.toLowerCase().includes(query));
  }), [activeFilter, orderSessions, search]);

  const effectiveSelectedTable = visibleOrders.some((order) => order.table === selectedTable) ? selectedTable : visibleOrders[0]?.table ?? selectedTable;
  const selectedSession = orderSessions.find((order) => order.table === effectiveSelectedTable);
  const selectedTableOrders = orders.filter((order) => order.sessionStatus === "Open" && order.table === effectiveSelectedTable && (!selectedSession?.sessionId || order.sessionId === selectedSession.sessionId) && (activeFilter === "All" ? order.status !== "Cancelled" : order.status === activeFilter));
  const selectedOrder = selectedTableOrders.length ? {
    ...selectedTableOrders[0],
    id: selectedTableOrders.map((order) => order.id).join(" + "),
    // Use the session aggregate so a delivered order does not mask a newer order on the same table.
    status: selectedSession?.status ?? (selectedTableOrders.every((order) => order.status === "Delivered") ? "Delivered" as const : selectedTableOrders.every((order) => order.status === "Cancelled") ? "Cancelled" as const : deriveOrderStatus(selectedTableOrders.flatMap((order) => order.drinks), selectedTableOrders[0].status)),
    paymentStatus: selectedTableOrders.filter((order) => order.status !== "Cancelled").every((order) => order.paymentStatus === "Paid") ? "Paid" as const : "Unpaid" as const,
    paymentMethod: selectedTableOrders.find((order) => order.paymentMethod)?.paymentMethod,
    drinks: selectedTableOrders.flatMap((order) => order.drinks),
  } : visibleOrders[0];

  if (isLoading) {
    return <LoadingState label="Loading orders…" />;
  }
  if (error) {
    return <ErrorState label="Unable to load orders. Please try again." />;
  }

  const applyDrinkStatus = (drinkId: string, status: DrinkStatus, reason?: string) => {
    if (!selectedOrder) return;
    const sourceOrder = selectedTableOrders.find((order) => order.drinks.some((drink) => drink.id === drinkId));
    if (!sourceOrder) return;
    const previousOrders = beginMutation();
    const persist = status === "Cancelled" && reason
      ? managerWorkflow.cancelDrink(sourceOrder.id, drinkId, reason)
      : managerWorkflow.updateDrinkStatus(sourceOrder.id, drinkId, status);
    const nextDrinks = sourceOrder.drinks.map((drink) => drink.id === drinkId ? { ...drink, status, cancellationReason: status === "Cancelled" ? reason : undefined } : drink);
    const nextStatus = deriveOrderStatus(nextDrinks, sourceOrder.status);
    const nextTableStatus = deriveOrderStatus(selectedTableOrders.flatMap((order) => order.id === sourceOrder.id ? nextDrinks : order.drinks), selectedOrder.status);
    setOrders((current) => current.map((order) => order.id !== sourceOrder.id ? order : { ...order, status: nextStatus, drinks: nextDrinks }));
    setTableStatus(nextTableStatus);
    void (async () => {
      let failure: unknown;
      try {
        await persist;
      } catch (error: unknown) {
        failure = error;
        pushInfo(explainStatusSaveError(error, "تعذر حفظ حالة المشروب. حدّث الصفحة وحاول مرة أخرى."));
      } finally {
        await settleMutation(previousOrders, failure).catch(() => undefined);
      }
    })();
  };

  const updateDrinkStatus = (drinkId: string, status: DrinkStatus) => {
    if (status === "Cancelled") { setCancellationReason(""); setPendingCancellation({ kind: "drink", drinkId }); return; }
    applyDrinkStatus(drinkId, status);
  };

  const applyTableStatus = (status: DrinkStatus, reason?: string) => {
    if (!selectedOrder) return;
    const previousOrders = orders;
    void Promise.all(selectedTableOrders.map((order) => status === "Cancelled" && reason ? managerWorkflow.cancelOrder(order.id, reason) : managerWorkflow.updateOrderStatus(order.id, status)))
      .then(() => undefined)
      .catch((error: unknown) => {
        setOrders(previousOrders);
        pushInfo(explainStatusSaveError(error, "تعذر حفظ حالة الطلب. حدّث الصفحة وحاول مرة أخرى."));
      });
    setTableStatus(status);
    const selectedIds = new Set(selectedTableOrders.map((order) => order.id));
    setOrders((current) => current.map((order) => !selectedIds.has(order.id) ? order : { ...order, status, cancellationReason: status === "Cancelled" ? reason : undefined, drinks: order.drinks.map((drink) => status === "Ready" && drink.status === "Cancelled" ? drink : { ...drink, status, cancellationReason: status === "Cancelled" ? reason : undefined }) }));
  };

  const updateTableStatus = (status: DrinkStatus) => {
    if (status === "Cancelled") { setCancellationReason(""); setPendingCancellation({ kind: "table" }); return; }
    applyTableStatus(status);
  };

  const markAllReady = () => {
    if (!selectedOrder) return;
    // A table can contain historical/terminal orders alongside the active one.
    // Never attempt to move served or cancelled orders back to ready: the DB
    // state machine correctly rejects those transitions.
    const actionableOrders = selectedTableOrders.filter((order) => order.status !== "Delivered" && order.status !== "Cancelled");
    if (actionableOrders.length === 0) return;
    const previousOrders = orders;
    void Promise.all(actionableOrders.map((order) => managerWorkflow.markOrderReady(order.id)))
      .then(() => {
        const actionableIds = new Set(actionableOrders.map((order) => order.id));
        setOrders((current) => current.map((order) => !actionableIds.has(order.id) ? order : { ...order, status: "Ready", drinks: order.drinks.map((drink) => drink.status === "Cancelled" ? drink : { ...drink, status: "Ready" }) }));
        setTableStatus("Ready");
      })
      .catch((error: unknown) => {
        setOrders(previousOrders);
        pushInfo(explainStatusSaveError(error, "تعذر تحديث المشروبات إلى Ready. حدّث الصفحة وحاول مرة أخرى."));
      });
  };

  const markDelivered = () => {
    if (!selectedOrder) return;
    if (selectedOrder.status !== "Ready") { pushInfo(pick(`Table ${selectedOrder.table} must be ready before delivery`, `يجب أن تكون الطاولة ${selectedOrder.table} جاهزة قبل التسليم`)); return; }
    const selectedIds = new Set(selectedTableOrders.map((order) => order.id));
    const previousOrders = orders;
    void Promise.all(selectedTableOrders.map((order) => managerWorkflow.updateOrderStatus(order.id, "Delivered")))
      .then(() => {
        setOrders((current) => current.map((order) => selectedIds.has(order.id) ? { ...order, status: "Delivered", drinks: order.drinks.map((drink) => drink.status === "Cancelled" ? drink : { ...drink, status: "Delivered" }) } : order));
      })
      .catch((error: unknown) => {
        setOrders(previousOrders);
        pushInfo(explainStatusSaveError(error, "تعذر تسجيل تسليم الطلب. حدّث الصفحة وحاول مرة أخرى."));
      });
  };

  const closeTable = () => {
    if (!selectedOrder) return;
    const tableSession = orders.filter((order) => order.table === selectedOrder.table && order.sessionStatus === "Open");
    if (tableSession.some((order) => order.status !== "Delivered" && order.status !== "Cancelled")) {
      pushInfo(pick(`Table ${selectedOrder.table} still has active orders and cannot be closed`, `لا يمكن إغلاق الطاولة ${selectedOrder.table} لوجود طلبات نشطة`));
      return;
    }
    if (tableSession.some((order) => order.status !== "Cancelled" && order.paymentStatus !== "Paid")) {
      pushInfo(pick(`Table ${selectedOrder.table} must be paid before it can be closed`, `يجب تحصيل حساب الطاولة ${selectedOrder.table} قبل إغلاقها`));
      return;
    }
    const sessionIds = new Set(tableSession.map((order) => order.id));
    const previousOrders = orders;
    void managerWorkflow.closeTableSession(selectedOrder.table).catch(() => {
      setOrders(previousOrders);
      pushInfo(pick(`Unable to close table ${selectedOrder.table}. Please try again.`, `تعذر إغلاق الطاولة ${selectedOrder.table}. حاول مرة أخرى.`));
    });
    setOrders((current) => current.map((order) => sessionIds.has(order.id) ? { ...order, sessionStatus: "Closed" } : order));
    setFilter("All");
  };

  const confirmCancellation = () => {
    const reason = cancellationReason.trim();
    if (!pendingCancellation || !reason) return;
    if (pendingCancellation.kind === "drink") applyDrinkStatus(pendingCancellation.drinkId, "Cancelled", reason);
    else applyTableStatus("Cancelled", reason);
    setPendingCancellation(null);
    setCancellationReason("");
  };

  return (
    <main className="manager-page orders-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
      <ManagerSidebar />
      <div className="orders-shell min-h-screen p-3 sm:p-5 xl:p-7">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.08] pb-5">
          <div><p className="text-xs uppercase tracking-[.25em] text-[var(--gold)]">{pick("Cafe operations", "تشغيل الكافيه")}</p><h1 className="mt-1 text-3xl font-semibold">{pick("Orders", "الطلبات")}</h1><p className="mt-1 text-sm text-white/45">{pick("Prepare every drink exactly as requested.", "حضّر كل مشروب حسب طلب العميل بدقة.")}</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/[.08] px-4 py-3 text-[var(--gold)] shadow-[0_0_24px_rgba(224,160,32,.08)]"><span className="text-xl">♧</span><span className="text-sm">{pick("New Orders", "طلبات جديدة")}</span><strong className="text-xl">{orderSessions.filter((order) => order.status === "New").length}</strong></div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#101211] p-2 sm:grid-cols-6">
            <TabButton label={pick("All", "الكل")} active={filter === "All"} count={orderSessions.filter((order) => order.status !== "Cancelled").length} onClick={() => setFilter("All")} color="text-white/75" />
            {tabs.map((tab) => <TabButton key={tab.label} label={statusLabel(tab.label)} active={filter === tab.label} count={orderSessions.filter((order) => order.status === tab.label).length} onClick={() => setFilter(tab.label)} color={tab.color} />)}
          </div>
          <label className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-[#101211] px-3 py-3 text-sm text-white/45 sm:w-56"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={pick("Search order, table or customer", "ابحث عن طلب أو طاولة أو عميل")} className="w-full bg-transparent outline-none" /></label>
        </div>

        <section className="orders-workspace mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <OrderTablesQueue orders={visibleOrders} selectedTable={effectiveSelectedTable} acknowledgedNewOrders={acknowledgedNewOrders} onSelect={(table, order) => { setAcknowledgedNewOrders((current) => { const next = new Set(current); next.add(`${table}:${order.id}`); return next; }); setSelectedTable(table); setTableStatus(order.status); }} />
          {selectedOrder ? <OrderDetails order={selectedOrder} tableStatus={selectedOrder.status ?? tableStatus} onTableStatus={updateTableStatus} onDrinkStatus={updateDrinkStatus} onMarkAllReady={markAllReady} onDelivered={markDelivered} onPayment={() => router.push(`/dashboard?table=${encodeURIComponent(selectedOrder.table)}&payment=1`)} onCloseTable={closeTable} /> : <section className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-white/10 bg-[#101211]"><div className="text-center"><span className="text-4xl text-white/20">○</span><h2 className="mt-3 text-lg font-semibold">{pick("No orders", "لا توجد طلبات")}</h2><p className="mt-2 text-sm text-white/40">{pick("Orders will appear here when their status changes.", "ستظهر الطلبات هنا عند تغيّر حالتها.")}</p></div></section>}
        </section>
      </div>
      {pendingCancellation && <div className="fixed inset-0 z-[130] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><section className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#121413] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-red-300">Cancellation</p><h2 id="cancel-order-title" className="mt-1 text-xl font-bold">Confirm cancellation</h2><p className="mt-2 text-sm leading-6 text-white/50">This action removes the {pendingCancellation.kind === "drink" ? "drink" : "table order"} from active preparation. Add a reason for the records.</p></div><button type="button" onClick={() => setPendingCancellation(null)} className="grid size-8 place-items-center rounded-lg bg-white/5 text-white/55 hover:bg-white/10">×</button></div><label className="mt-5 block text-sm text-white/70">Cancellation reason<textarea autoFocus value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Example: Customer requested cancellation" className="mt-2 min-h-24 w-full resize-none rounded-xl border border-white/15 bg-black/25 p-3 text-white outline-none placeholder:text-white/25 focus:border-red-300/60" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPendingCancellation(null)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/65">Keep order</button><button type="button" disabled={!cancellationReason.trim()} onClick={confirmCancellation} className="rounded-xl bg-red-400 px-4 py-2.5 text-sm font-bold text-[#240807] disabled:cursor-not-allowed disabled:opacity-40">Confirm cancellation</button></div></section></div>}
    </main>
  );
}

function OrdersPageRouteContent() {
  const searchParams = useSearchParams();
  return <OrdersPage key={searchParams.toString()} />;
}

export default function OrdersPageRoute() {
  return <Suspense fallback={<main className="min-h-screen bg-[#080a09]" />}><OrdersPageRouteContent /></Suspense>;
}
