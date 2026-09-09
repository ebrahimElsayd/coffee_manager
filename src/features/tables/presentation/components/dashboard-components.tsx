"use client";

import type { ManagerOrder, ManagerTable, TableStatus, WorkflowStatus } from "@/shared/application/ports/manager-data-source";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

type DisplayStatus = WorkflowStatus | TableStatus;
export const iconByStatus: Record<DisplayStatus, string> = { New: "●", Preparing: "♨", Ready: "✓", Delivered: "◇", Cancelled: "×", Available: "○", Seated: "♙", Done: "✓" };
export const statusColor: Record<DisplayStatus, string> = { New: "text-[#8fc1ff]", Preparing: "text-[#f4a51c]", Ready: "text-[var(--success)]", Delivered: "text-[#c9a7ff]", Cancelled: "text-red-300", Available: "text-[#73d68d]", Seated: "text-[#e5aa3a]", Done: "text-[#73d68d]" };

export function Stat({ icon, label, sub, value, suffix }: { icon: string; label: string; sub: string; value: number; suffix?: string }) { return <article className="flex min-h-[98px] items-center gap-5 rounded-xl border border-[var(--gold)]/45 bg-[#111312] px-6"><span className="text-4xl text-[#dca03a]">{icon}</span><div><p className="text-sm text-white/85">{label}</p><strong className="mt-1 block text-3xl">{value.toLocaleString()} {suffix && <small className="text-lg font-medium text-[var(--success)]">{suffix}</small>}</strong><small className="text-xs text-white/45">{sub}</small></div></article>; }

export function StatusBadge({ status }: { status: DisplayStatus }) { const { statusLabel } = useManagerI18n(); return <span className={`flex h-10 min-w-28 shrink-0 items-center justify-center rounded-xl border border-current/50 bg-white/[.04] px-3 text-xs font-semibold ${statusColor[status]}`}>{iconByStatus[status]}　{statusLabel(status)}</span>; }

function deriveDisplayTableStatus(table: ManagerTable, orders: ManagerOrder[]): DisplayStatus {
  const tableOrders = orders.filter((order) => order.table === table.number && order.sessionStatus === "Open");
  const hasClosedOrders = orders.some((order) => order.table === table.number && order.sessionStatus === "Closed");
  const activeOrders = tableOrders.filter((order) => order.status !== "Cancelled");
  if (!activeOrders.length) return hasClosedOrders ? "Done" : table.status;
  if (activeOrders.every((order) => order.status === "Delivered")) return "Delivered";
  if (activeOrders.some((order) => order.status === "Preparing")) return "Preparing";
  if (activeOrders.some((order) => order.status === "New")) return "New";
  if (activeOrders.every((order) => order.status === "Ready")) return "Ready";
  return table.status;
}

export function TableList({ tables, orders, selectedTable, onSelect }: { tables: ManagerTable[]; orders: ManagerOrder[]; selectedTable: string; onSelect: (value: string) => void }) {
  const { pick, statusLabel } = useManagerI18n();
  const counts = tables.reduce<Record<string, number>>((result, table) => { const status = deriveDisplayTableStatus(table, orders); result[status] = (result[status] || 0) + 1; return result; }, {});
  return <aside className="dashboard-tables-panel rounded-xl border border-white/10 bg-[#101211] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{pick("Tables", "الطاولات")}</h2><span className="text-xs text-white/40">⌄</span></div><label className="mb-3 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/45">⌕<input className="w-full bg-transparent outline-none" placeholder={pick("Search Table", "ابحث عن طاولة")}/></label><div className="dashboard-table-list premium-table-list">{tables.map((table) => { const tableOrders = orders.filter((item) => item.table === table.number); const status = deriveDisplayTableStatus(table, orders); const selected = table.number === selectedTable; return <button type="button" key={table.number} onClick={() => onSelect(table.number)} className={`premium-table-card ${selected ? "is-selected" : ""}`}><span className="premium-table-icon">♜</span><span className="premium-table-info"><b>{pick("Table", "طاولة")} {table.number}</b><small>{table.guests} · {tableOrders.length || 0} {pick("orders", "طلبات")}</small></span><span className={`premium-table-status ${statusColor[status]}`}>● {statusLabel(status)}</span>{selected && <span className="premium-table-arrow">›</span>}</button>; })}</div><div className="premium-table-summary"><span>{tables.length} {pick("Tables", "طاولات")}</span><span className="text-[#73d68d]">● {counts.Ready || 0}</span><span className="text-[#f4b43f]">● {counts.Preparing || 0}</span><span className="text-[#8d75e8]">● {counts.New || 0}</span></div></aside>;
}
