"use client";

import { useState } from "react";
import Image from "next/image";
import { getDrinkDetails, type Drink, type DrinkStatus, type Order, type OrderStatus } from "../../domain/manager-order";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

const drinkImage: Record<string, string> = {
  "Cardamom Cappuccino": "/images/products/cardamom-cappuccino.webp",
  "Ice Mocha Deluxe": "/images/products/ice-mocha-deluxe.webp",
  "Cold Brew Reserve": "/images/products/cold-brew-reserve.webp",
  "Almond Croissant": "/images/products/lotus-cheesecake.webp",
};

export function TabButton({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color: string; onClick: () => void }) {
  const { pick, statusLabel } = useManagerI18n();
  return <button type="button" onClick={onClick} className={`min-w-0 whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-sm transition ${active ? "bg-white/[.09] shadow-inner" : "hover:bg-white/[.04]"} ${color}`}><span>{label === "All" ? pick("All", "الكل") : statusLabel(label)}</span><b className="ms-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-xs">{count}</b></button>;
}

export function OrderTablesQueue({ orders, selectedTable, acknowledgedNewOrders, onSelect }: { orders: Order[]; selectedTable: string; acknowledgedNewOrders: ReadonlySet<string>; onSelect: (table: string, order: Order) => void }) {
  const { pick, statusLabel } = useManagerI18n();
  const [query, setQuery] = useState("");
  const allTables = Array.from(new Map(orders.map((order) => [order.table, order])).values());
  const normalizedQuery = query.trim().toLowerCase().replace(/^table\s*/, "");
  const tables = normalizedQuery ? allTables.filter((order) => order.table.toLowerCase().includes(normalizedQuery)) : allTables;
  return <aside className="orders-table-queue min-h-[680px] rounded-2xl border border-white/10 bg-[#101211] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{pick("Tables", "الطاولات")}</h2><span className="text-xs text-white/40">{allTables.length} {pick("tables", "طاولات")}</span></div><label className="mb-3 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/45">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder={pick("Search Table", "ابحث عن طاولة")} aria-label={pick("Search tables", "البحث في الطاولات")}/></label><div className="orders-table-list">{tables.length ? tables.map((order) => { const selected = order.table === selectedTable; const statusClass = order.status === "New" ? "new" : order.status === "Preparing" ? "preparing" : order.status === "Ready" ? "ready" : order.status === "Delivered" ? "delivered" : "cancelled"; return <button type="button" key={order.table} onClick={() => onSelect(order.table, order)} className={`orders-table-card ${selected ? "is-selected" : ""} ${order.status === "New" && !acknowledgedNewOrders.has(`${order.table}:${order.id}`) ? "new-order-alert" : ""}`}><span className="orders-table-icon" aria-hidden="true"/><span className="orders-table-info"><b>{pick("Table", "طاولة")} {order.table}</b></span><span className={`orders-table-status ${statusClass}`}>● {statusLabel(order.status)}</span>{selected && <span className="orders-table-arrow">›</span>}</button>; }) : <p className="py-8 text-center text-xs text-white/40">{pick("No matching tables", "لا توجد طاولات مطابقة")}</p>}</div><div className="orders-table-summary"><span>{allTables.length} {pick("Tables", "طاولات")}</span><span className="ready">● {allTables.filter((order) => order.status === "Ready").length}</span><span className="preparing">● {allTables.filter((order) => order.status === "Preparing").length}</span><span className="new">● {allTables.filter((order) => order.status === "New").length}</span></div></aside>;
}

export function OrderDetails({ order, tableStatus, onTableStatus, onDrinkStatus, onMarkAllReady, onDelivered, onPayment, onCloseTable }: { order: Order; tableStatus: OrderStatus; onTableStatus: (status: DrinkStatus) => void; onDrinkStatus: (drinkId: string, status: DrinkStatus) => void; onMarkAllReady: () => void; onDelivered: () => void; onPayment: () => void; onCloseTable: () => void }) {
  const { pick, statusLabel } = useManagerI18n();
  const groups = order.drinks.reduce<Record<string, Drink[]>>((current, drink) => {
    const owner = drink.recipientName || order.customer;
    (current[owner] ??= []).push(drink);
    return current;
  }, {});
  const locked = tableStatus === "Delivered" || tableStatus === "Cancelled";
  const paid = order.paymentStatus === "Paid";
  return <article className="order-details premium-order-panel min-w-0 rounded-2xl border border-white/10 bg-[#101211] p-4 xl:p-5"><header className="premium-order-header flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4"><div className="premium-table-heading"><span className="premium-coffee-mark">☕</span><div><p>{order.orderType === "Takeaway" ? pick("TAKEAWAY", "سفري") : `${pick("TABLE", "طاولة")} ${order.table}`}</p><small>{order.guests} · {order.time}</small></div></div><div className="premium-owner-heading"><span className="grid size-8 place-items-center rounded-full bg-[var(--gold)]/15 text-xs font-bold text-[var(--gold)]">{order.customer.slice(0, 1)}</span><b>{order.customer}</b></div><div className="flex items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${paid ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300" : "border-amber-400/35 bg-amber-400/10 text-amber-200"}`}>{paid ? `${statusLabel("paid")} · ${order.paymentMethod ?? ""}` : statusLabel("unpaid")}</span>{locked ? <span className={`rounded-xl border border-current/40 bg-white/[.04] px-4 py-2 text-sm font-semibold ${tableStatus === "Delivered" ? "text-[#c9a7ff]" : "text-red-300"}`}>{tableStatus === "Delivered" ? `◇ ${statusLabel("delivered")}` : `× ${statusLabel(tableStatus)}`}</span> : <label className="premium-table-status flex min-w-40 flex-col gap-1 text-[10px] uppercase tracking-[.12em] text-[var(--gold)]">{pick("Order Status", "حالة الطلب")}<select value={tableStatus} onChange={(event) => onTableStatus(event.target.value as DrinkStatus)} className="rounded-lg border border-[var(--gold)]/70 bg-[#241b0d] px-3 py-2 text-sm font-semibold tracking-normal text-[#ffd477] outline-none"><option value="New">{statusLabel("New")}</option><option value="Preparing">{statusLabel("Preparing")}</option><option value="Ready">{statusLabel("Ready")}</option><option value="Cancelled">{statusLabel("Cancelled")}</option></select></label>}</div></header><div className="premium-order-toolbar"><span>{tableStatus === "Delivered" ? paid ? pick("Order paid", "تم تحصيل الطلب") : pick("Delivered · awaiting payment", "تم التسليم · في انتظار الدفع") : pick("Order details", "تفاصيل الطلب")}</span><p>{order.cancellationReason ? `${pick("Cancellation reason", "سبب الإلغاء")}: ${order.cancellationReason}` : tableStatus === "Delivered" ? order.orderType === "Takeaway" ? pick("Takeaway completes automatically after payment.", "يكتمل الطلب السفري تلقائيًا بعد الدفع.") : pick("Pay the bill, then close the table after the customers leave.", "حصّل الفاتورة ثم أغلق الطاولة بعد مغادرة العملاء.") : pick("The order status summarizes all drinks.", "حالة الطلب تلخص حالة جميع المشروبات.")}</p>{tableStatus === "Ready" ? <button type="button" onClick={onDelivered}>✓ {pick("Delivered to customer", "تم تسليم الطلب للعميل")}</button> : tableStatus === "Delivered" ? <div className="flex flex-wrap gap-2">{!paid && <button type="button" onClick={onPayment}>▣ {pick("Collect payment", "الانتقال للتحصيل")}</button>}{order.orderType === "DineIn" && <button type="button" disabled={!paid} title={!paid ? pick("Complete payment first", "أكمل الدفع أولًا") : undefined} onClick={onCloseTable} className="disabled:cursor-not-allowed disabled:opacity-35">○ {pick("Customer left · Close table", "غادر العميل · إغلاق الطاولة")}</button>}</div> : !locked ? <button type="button" onClick={onMarkAllReady}>✓ {pick("Mark all ready", "تحديد الكل كجاهز")}</button> : null}</div><div className="order-drinks-grid premium-order-rows mt-2">{Object.entries(groups).map(([owner, drinks]) => <section key={owner} className="drink-owner-group"><header><span className="grid size-7 place-items-center rounded-full bg-[var(--gold)]/15 text-xs font-bold text-[var(--gold)]">{owner.slice(0, 1)}</span><div><b>{owner}</b><small>{drinks.reduce((sum, drink) => sum + drink.quantity, 0)} {pick("drinks", "مشروبات")}</small></div></header><div className="drink-owner-items">{drinks.map((drink) => <DrinkCard key={drink.id} drink={drink} readOnly={locked} onStatusChange={(status) => onDrinkStatus(drink.id, status)} />)}</div></section>)}</div></article>;
}

function DrinkCard({ drink, readOnly: initialReadOnly, onStatusChange }: { drink: Drink; readOnly: boolean; onStatusChange: (status: DrinkStatus) => void }) {
  const { pick, statusLabel, locale } = useManagerI18n();
  const readOnly = initialReadOnly || drink.status === "Delivered" || drink.status === "Cancelled";
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackIcon = drink.name.includes("Cola") ? "🥤" : drink.name.includes("Water") ? "🫧" : drink.name.includes("Croissant") ? "🥐" : "☕";
  const details = getDrinkDetails(drink, locale);
  const image = getDrinkImage(drink.imageUrl, drink.name);
  return <article className="premium-drink-row"><header className="premium-drink-row-head"><div className="premium-qty">{drink.quantity}×</div><div className="premium-drink-name">{image && !imageFailed ? <Image src={image} alt="" width={44} height={44} unoptimized onError={() => setImageFailed(true)} /> : <span>{fallbackIcon}</span>}<strong>{drink.name}</strong></div>{readOnly ? <span className="rounded-full border border-[var(--success)]/35 bg-[var(--success)]/10 px-3 py-1.5 text-xs text-[#8ee5b2]">✓ {statusLabel(drink.status)}</span> : <StatusSelect value={drink.status} onChange={onStatusChange} />}</header><div className="premium-dynamic-details">{details.map(({ label, value }, index) => <div className="premium-data-cell" key={`${label}-${value}-${index}`}><small>{label}</small><b>{value}</b></div>)}{drink.note && <div className="premium-note-cell">{pick("Note", "ملاحظة")}: {drink.note}</div>}{drink.cancellationReason && <div className="premium-note-cell text-red-200">{pick("Cancelled", "ملغي")}: {drink.cancellationReason}</div>}</div></article>;
}

function getDrinkImage(imageUrl: string | undefined, name: string) {
  if (imageUrl && /^(\/|https?:\/\/|data:image\/)/.test(imageUrl)) return imageUrl;
  return drinkImage[name];
}

function StatusSelect({ value, onChange }: { value: DrinkStatus; onChange: (status: DrinkStatus) => void }) {
  const { statusLabel } = useManagerI18n();
  const [open, setOpen] = useState(false);
  const options: DrinkStatus[] = value === "Delivered" || value === "Cancelled"
    ? [value]
    : value === "Ready"
      ? ["New", "Preparing", "Ready", "Delivered", "Cancelled"]
      : ["New", "Preparing", "Ready", "Cancelled"];
  const tone = value === "New" ? "new" : value === "Preparing" ? "preparing" : value === "Ready" ? "ready" : value === "Delivered" ? "delivered" : "cancelled";
  const terminal = value === "Delivered" || value === "Cancelled";
  return <div className={`premium-status-select ${tone}`}><button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={terminal} onClick={() => setOpen((current) => !current)}><span className="status-dot" />{statusLabel(value)}{!terminal && <span className="status-chevron">⌄</span>}</button>{open && !terminal && <div className="premium-status-menu" role="listbox">{options.map((option) => <button type="button" role="option" aria-selected={option === value} key={option} className={option === value ? "is-current" : ""} onClick={() => { onChange(option); setOpen(false); }}><span className={`status-dot ${option === "New" ? "new" : option === "Preparing" ? "preparing" : option === "Ready" ? "ready" : option === "Delivered" ? "delivered" : "cancelled"}`} />{statusLabel(option)}{option === value && <span className="status-check">✓</span>}</button>)}</div>}</div>;
}
