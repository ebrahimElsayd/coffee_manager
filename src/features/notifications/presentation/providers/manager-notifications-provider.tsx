"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { useTableServiceRequestsListener } from "@/features/table-service/presentation/hooks/use-table-service-requests-listener";
import { generateSafeUUID } from "@/shared/utils/uuid";
import { MANAGER_ORDER_INVALIDATED_EVENT } from "@/features/orders/domain/order-realtime-events";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

type NotificationKind = "new-order" | "order-ready" | "info";

type ManagerNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
};

type NotificationContextValue = {
  newOrderCount: number;
  syncNewOrderCount: (count: number) => void;
  notifyNewOrder: (order: { id: string; table: string }) => void;
  notifyOrderReady: (table: string) => void;
  pushInfo: (message: string) => void;
  dismiss: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const notificationTone: Record<NotificationKind, { icon: string; border: string; surface: string; title: string }> = {
  "new-order": { icon: "♨", border: "border-[var(--gold)]/55", surface: "bg-[#22190b]/95", title: "text-[#ffd477]" },
  "order-ready": { icon: "✓", border: "border-[var(--success)]/55", surface: "bg-[#10261d]/95", title: "text-[#b9f5d2]" },
  info: { icon: "●", border: "border-[#69a9ff]/45", surface: "bg-[#101b28]/95", title: "text-[#b8d8ff]" },
};

export function ManagerNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { settings } = useManagerSettings();
  const { pick } = useManagerI18n();
  const [notifications, setNotifications] = useState<ManagerNotification[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const timers = useRef(new Map<string, number>());
  const { pendingRequests, lastLiveRequestId, acknowledgeRequest } = useTableServiceRequestsListener();

  useEffect(() => {
    let mounted = true;
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const enforceSession = async () => {
      const result = await db.auth.getSession();
      if (!mounted) return;
      const path = window.location.pathname;
      if (result.error || (!result.data.session && path !== "/login")) {
        window.sessionStorage.removeItem("coffee-manager:session");
        if (path !== "/login") window.location.replace("/login");
      } else if (result.data.session) {
        // Compatibility marker for legacy screens; authentication is Supabase-owned.
        window.sessionStorage.setItem("coffee-manager:session", "active");
      }
    };
    void enforceSession();
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      const path = window.location.pathname;
      if (!session && path !== "/login") {
        window.sessionStorage.removeItem("coffee-manager:session");
        window.location.replace("/login");
      } else if (session) {
        window.sessionStorage.setItem("coffee-manager:session", "active");
      }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const playSound = useCallback(() => {
    if (!settings.notifications.sound) return;
    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.25);
      oscillator.addEventListener("ended", () => void context.close(), { once: true });
    } catch { /* Sound is optional and may be blocked until user interaction. */ }
  }, [settings.notifications.sound]);

  const push = useCallback((kind: NotificationKind, title: string, message: string) => {
    const id = generateSafeUUID();
    setNotifications((current) => {
      const retained = kind === "info" ? current.filter((notification) => notification.kind !== "info") : current;
      return [{ id, kind, title, message }, ...retained].slice(0, 3);
    });
    playSound();
    const timer = window.setTimeout(() => dismiss(id), 4200);
    timers.current.set(id, timer);
  }, [dismiss, playSound]);

  // The database trigger is the source of truth for cross-screen events.
  // Historical rows are hydration state, not new events. Only a live INSERT may
  // create a toast; reconnect/focus reconciliation silently seeds dedupe state.
  const remoteSeen = useRef(new Set<string>());
  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let connecting = false;
    const showRemote = (row: { id?: string; order_id?: string; title?: string; body?: string }) => {
      if (!row.id || remoteSeen.current.has(row.id)) return;
      remoteSeen.current.add(row.id);
      if (row.title === "تم استلام طلبك") {
        window.dispatchEvent(new CustomEvent(MANAGER_ORDER_INVALIDATED_EVENT, {
          detail: { orderId: row.order_id },
        }));
        setNewOrderCount((current) => current + 1);
        push("new-order", "New order", row.body ?? "A customer order was received.");
      }
      else if (row.title?.includes("جاهز")) push("order-ready", "Order ready", row.body ?? "An order is ready to serve.");
    };
    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(30_000, 1_000 * 2 ** retryAttempt++);
      retryTimer = setTimeout(() => { retryTimer = null; void connect(); }, delay);
    };
    const reconcile = async (activeCafeId: string) => {
      const db = getSupabaseBrowserClient();
      if (!db || disposed) return;
      const result = await db.from("notifications").select("id,order_id,title,body,type").eq("cafe_id", activeCafeId).eq("is_read", false).order("created_at", { ascending: false }).limit(50);
      if (result.error) throw result.error;
      for (const row of (result.data ?? []) as Array<{ id?: string; order_id?: string; title?: string }>) {
        if (!row.id || remoteSeen.current.has(row.id)) continue;
        remoteSeen.current.add(row.id);
        // Reconcile silently when an INSERT happened while the Realtime
        // channel was reconnecting; do not replay a historical toast.
        if (row.order_id && row.title === "تم استلام طلبك") {
          window.dispatchEvent(new CustomEvent(MANAGER_ORDER_INVALIDATED_EVENT, {
            detail: { orderId: row.order_id },
          }));
        }
      }
    };
    const connect = async () => {
      if (disposed || connecting || channel) return;
      connecting = true;
      try {
        const activeCafeId = await getManagerCafeId();
        const db = getSupabaseBrowserClient();
        if (!db) return;
        await reconcile(activeCafeId);
        if (disposed) return;
        channel = db.channel(`manager-notifications-live:${activeCafeId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `cafe_id=eq.${activeCafeId}` }, (payload) => showRemote(payload.new as { id?: string; order_id?: string; title?: string; body?: string }))
          .subscribe((status) => {
            if (status === "SUBSCRIBED") { retryAttempt = 0; return; }
            if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT" && status !== "CLOSED") return;
            if (disposed) return;
            const failed = channel;
            channel = null;
            if (failed && status !== "CLOSED") void failed.unsubscribe();
            scheduleReconnect();
          });
      } catch { scheduleReconnect(); }
      finally { connecting = false; }
    };
    let hiddenAt: number | null = null;
    const wake = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (navigator.onLine && hiddenAt && Date.now() - hiddenAt >= 60_000) { if (channel) { void getManagerCafeId().then(reconcile).catch(scheduleReconnect); } else scheduleReconnect(); }
      hiddenAt = null;
    };
    const wakeOnline = () => { if (document.visibilityState !== "hidden") { if (channel) { void getManagerCafeId().then(reconcile).catch(scheduleReconnect); } else scheduleReconnect(); } };
    void connect();
    window.addEventListener("online", wakeOnline);
    document.addEventListener("visibilitychange", wake);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", wakeOnline);
      document.removeEventListener("visibilitychange", wake);
      const db = getSupabaseBrowserClient();
      if (db && channel) void db.removeChannel(channel);
      channel = null;
    };
  }, [push]);

  const serviceSeen = useRef(new Set<string>());
  useEffect(() => {
    if (!lastLiveRequestId || serviceSeen.current.has(lastLiveRequestId)) return;
    const request = pendingRequests.find((item) => item.id === lastLiveRequestId);
    if (!request) return;
    serviceSeen.current.add(lastLiveRequestId);
    playSound();
  }, [lastLiveRequestId, pendingRequests, playSound]);

  const activeServiceRequest = pendingRequests[0];
  const serviceRequestLabel = activeServiceRequest?.type === "bill"
    ? pick("requested the bill", "طلب الحساب")
    : activeServiceRequest?.type === "waiter"
      ? pick("requested a waiter", "طلب النادل")
      : pick(`sent a ${activeServiceRequest?.type ?? "service"} request`, `أرسل طلب ${activeServiceRequest?.type ?? "خدمة"}`);

  const syncNewOrderCount = useCallback((count: number) => setNewOrderCount(Math.max(0, count)), []);

  const value = useMemo<NotificationContextValue>(() => ({
    newOrderCount,
    syncNewOrderCount,
    notifyNewOrder: (order) => {
      if (!settings.notifications.newOrder) return;
      push("new-order", "New order", `Table ${order.table} · Order ${order.id}`);
    },
    notifyOrderReady: (table) => {
      if (!settings.notifications.ready) return;
      push("order-ready", "Order ready", `Table ${table} is ready to serve`);
    },
    pushInfo: (message) => push("info", "Order updated", message),
    dismiss,
  }), [dismiss, newOrderCount, push, settings.notifications.newOrder, settings.notifications.ready, syncNewOrderCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {activeServiceRequest && <section className="pointer-events-none fixed inset-x-4 top-4 z-[125] flex justify-center" aria-live="assertive" aria-label={pick("Pending table service request", "طلب خدمة طاولة معلّق")}>
        <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[var(--gold)]/70 bg-[#21190b]/[.98] p-4 shadow-[0_22px_70px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/[.12] text-xl text-[#ffd477]" aria-hidden="true">♧</span>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#f5ca72]">{pick("Table service request", "طلب خدمة للطاولة")}</p><strong className="mt-1 block text-lg text-white">{pick("Table", "طاولة")} {activeServiceRequest.table} {serviceRequestLabel}</strong><p className="mt-1 text-sm text-white/60">{activeServiceRequest.note || pick("Open the table to review and handle this request.", "افتح الطاولة لمراجعة هذا الطلب والتعامل معه.")}</p></div>
            <span className="mt-1 size-2.5 shrink-0 animate-pulse rounded-full bg-[#f5ca72]" aria-hidden="true" />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { const request = activeServiceRequest; router.push(`/orders?table=${encodeURIComponent(request.table)}`); void acknowledgeRequest(request.id); }} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/75 transition hover:bg-white/10">{pick("Open table", "فتح الطاولة")}</button><button type="button" onClick={() => { void acknowledgeRequest(activeServiceRequest.id); }} className="rounded-lg bg-[var(--gold)] px-3 py-2 text-xs font-semibold text-[#17120a] transition hover:brightness-110">{pick("Close", "إغلاق")}</button></div>
        </article>
      </section>}
      <section className={`manager-notification-stack pointer-events-none fixed right-4 ${activeServiceRequest ? "top-28" : "top-4"} z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2`} aria-live="polite" aria-label={pick("Operational notifications", "الإشعارات التشغيلية")}>
        {notifications.map((notification) => {
          const tone = notificationTone[notification.kind];
          return (
            <article key={notification.id} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${tone.border} ${tone.surface} p-3.5 shadow-[0_18px_55px_rgba(0,0,0,.48)] backdrop-blur-xl`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${tone.border} ${tone.title}`}>{tone.icon}</span>
              <span className="min-w-0 flex-1"><strong className={`block text-sm ${tone.title}`}>{notification.title}</strong><small className="mt-1 block text-xs leading-5 text-white/65">{notification.message}</small></span>
              <button type="button" onClick={() => dismiss(notification.id)} aria-label="Dismiss notification" className="grid size-7 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white">×</button>
            </article>
          );
        })}
      </section>
    </NotificationContext.Provider>
  );
}

export function useManagerNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useManagerNotifications must be used inside ManagerNotificationsProvider");
  return context;
}
