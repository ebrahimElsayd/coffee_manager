"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ManagerDataSource } from "@/shared/application/ports/manager-data-source";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { ListManagerOrders } from "../../application/use-cases/list-manager-orders";
import type { Order } from "../../domain/manager-order";
import { reconcileOrdersCache } from "../../domain/order-cache";
import { MANAGER_ORDER_INVALIDATED_EVENT, type ManagerOrderInvalidatedDetail } from "../../domain/order-realtime-events";

const CACHE_TTL_MS = 15_000;
const listeners = new Set<(orders: Order[]) => void>();

let cachedOrders: Order[] = [];
let cacheReady = false;
let cacheUpdatedAt = 0;
let pendingLoad: Promise<Order[]> | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let realtimeStarting = false;
let realtimeRetryTimer: ReturnType<typeof setTimeout> | null = null;
let realtimeRetryAttempt = 0;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const pendingRealtimeOrderIds = new Set<string>();
let pendingFullReconciliation = false;
let hookSubscribers = 0;
let activeMutations = 0;
let mutationRevision = 0;

function publish(orders: Order[]) {
  cachedOrders = orders;
  cacheReady = true;
  cacheUpdatedAt = Date.now();
  listeners.forEach((listener) => listener(orders));
}

export function clearManagerOrdersCache() {
  cachedOrders = [];
  cacheReady = false;
  cacheUpdatedAt = 0;
  listeners.forEach((listener) => listener([]));
}

function loadOrders(source: ManagerDataSource, force = false): Promise<Order[]> {
  if (!force && cacheReady && Date.now() - cacheUpdatedAt < CACHE_TTL_MS) return Promise.resolve(cachedOrders);
  if (pendingLoad) {
    return force ? pendingLoad.then(() => loadOrders(source, true)) : pendingLoad;
  }
  const requestRevision = mutationRevision;
  pendingLoad = new ListManagerOrders(source).execute()
    .then((orders) => {
      const nextOrders = [...orders];
      if (activeMutations === 0 && requestRevision === mutationRevision) publish(nextOrders);
      return activeMutations === 0 ? nextOrders : cachedOrders;
    })
    .finally(() => { pendingLoad = null; });
  return pendingLoad;
}

function scheduleReconciliation(source: ManagerDataSource, options?: { orderIds?: readonly string[]; full?: boolean; immediate?: boolean }) {
  if (options?.full) pendingFullReconciliation = true;
  for (const id of options?.orderIds ?? []) if (id) pendingRealtimeOrderIds.add(id);
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = setTimeout(() => {
    realtimeRefreshTimer = null;
    const full = pendingFullReconciliation;
    const orderIds = [...pendingRealtimeOrderIds];
    pendingFullReconciliation = false;
    pendingRealtimeOrderIds.clear();
    if (full || activeMutations > 0 || orderIds.length === 0) {
      void loadOrders(source, true).catch(() => undefined);
      return;
    }
    void source.listOrders({ orderIds }).then((changed) => {
      if (activeMutations > 0) return;
      publish(reconcileOrdersCache(cachedOrders, orderIds, changed));
    }).catch(() => { scheduleReconciliation(source, { full: true }); });
  }, options?.immediate ? 0 : 120);
}

function scheduleRealtimeReconnect(source: ManagerDataSource) {
  if (hookSubscribers === 0 || realtimeRetryTimer) return;
  const delay = Math.min(1_000 * (2 ** realtimeRetryAttempt), 30_000);
  realtimeRetryAttempt += 1;
  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;
    void startRealtime(source);
  }, delay);
}

async function stopRealtime() {
  const db = getSupabaseBrowserClient();
  const channel = realtimeChannel;
  realtimeChannel = null;
  realtimeStarting = false;
  if (channel && db) await db.removeChannel(channel);
}

async function startRealtime(source: ManagerDataSource) {
  if (realtimeChannel || realtimeStarting || hookSubscribers === 0) return;
  const db = getSupabaseBrowserClient();
  if (!db) return;
  realtimeStarting = true;
  try {
    const cafeId = await getManagerCafeId();
    if (hookSubscribers === 0) return;
    const channel = db.channel(`manager-orders-live-${cafeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => scheduleReconciliation(source, { orderIds: [String((payload.new as { id?: unknown }).id ?? "")], immediate: true }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, (payload) => scheduleReconciliation(source, { orderIds: [String((payload.new as { id?: unknown }).id ?? "")] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `cafe_id=eq.${cafeId}` }, (payload) => scheduleReconciliation(source, { orderIds: [String(((payload.new ?? payload.old) as { order_id?: unknown }).order_id ?? "")] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, (payload) => {
        const sessionId = String(((payload.new ?? payload.old) as { session_id?: unknown }).session_id ?? "");
        scheduleReconciliation(source, { orderIds: cachedOrders.filter((order) => order.sessionId === sessionId).map((order) => order.id) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, (payload) => {
        const sessionId = String(((payload.new ?? payload.old) as { id?: unknown }).id ?? "");
        const orderIds = cachedOrders.filter((order) => order.sessionId === sessionId).map((order) => order.id);
        if (orderIds.length) scheduleReconciliation(source, { orderIds });
        // A session event without a cached order is handled by the orders INSERT
        // channel. Avoid a full list reload for unrelated sessions/cafes.
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeRetryAttempt = 0;
          scheduleReconciliation(source, { full: true, immediate: true });
          return;
        }
        if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT" && status !== "CLOSED") return;
        if (realtimeChannel !== channel || hookSubscribers === 0) return;
        realtimeChannel = null;
        if (status !== "CLOSED") void channel.unsubscribe();
        scheduleRealtimeReconnect(source);
      });
    realtimeChannel = channel;
  } catch {
    scheduleRealtimeReconnect(source);
  } finally {
    realtimeStarting = false;
  }
}

export function useManagerOrders(source: ManagerDataSource) {
  const [orders, setLocalOrders] = useState<Order[]>(cachedOrders);
  const [isLoading, setIsLoading] = useState(!cacheReady);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (force = false) => {
    try {
      const nextOrders = await loadOrders(source, force);
      setError(null);
      return nextOrders;
    } catch (reason: unknown) {
      const nextError = reason instanceof Error ? reason : new Error("Unable to load orders");
      if (!cacheReady) setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [source]);

  const setOrders = useCallback((action: SetStateAction<Order[]>) => {
    publish(typeof action === "function" ? action(cachedOrders) : action);
  }, []);

  const beginMutation = useCallback(() => {
    activeMutations += 1;
    mutationRevision += 1;
    return [...cachedOrders];
  }, []);

  const settleMutation = useCallback(async (snapshot: Order[], reason?: unknown) => {
    activeMutations = Math.max(0, activeMutations - 1);
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    const hardNetworkFailure = (typeof navigator !== "undefined" && !navigator.onLine)
      || reason instanceof TypeError
      || /network|fetch|timeout|timed out|connection/i.test(message);
    if (reason && hardNetworkFailure) publish(snapshot);
    mutationRevision += 1;
    if (activeMutations === 0) await loadOrders(source, true);
  }, [source]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const listener = (nextOrders: Order[]) => setLocalOrders(nextOrders);
    listeners.add(listener);
    hookSubscribers += 1;
    void startRealtime(source);
    queueMicrotask(() => { void refresh(false).catch(() => undefined); });

    const reconcile = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (navigator.onLine && hiddenAt && Date.now() - hiddenAt >= 60_000) {
        void refresh(true).catch(() => undefined);
        void startRealtime(source);
      }
      hiddenAt = null;
    };
    const reconcileOnline = () => { if (document.visibilityState === "visible") { void refresh(true).catch(() => undefined); void startRealtime(source); } };
    const reconcileNotificationSignal = (event: Event) => {
      const orderId = (event as CustomEvent<ManagerOrderInvalidatedDetail>).detail?.orderId;
      scheduleReconciliation(source, orderId ? { orderIds: [orderId], immediate: true } : { full: true, immediate: true });
    };
    window.addEventListener("online", reconcileOnline);
    window.addEventListener(MANAGER_ORDER_INVALIDATED_EVENT, reconcileNotificationSignal);
    document.addEventListener("visibilitychange", reconcile);
    return () => {
      listeners.delete(listener);
      hookSubscribers -= 1;
      window.removeEventListener("online", reconcileOnline);
      window.removeEventListener(MANAGER_ORDER_INVALIDATED_EVENT, reconcileNotificationSignal);
      document.removeEventListener("visibilitychange", reconcile);
      if (hookSubscribers === 0) {
        if (realtimeRetryTimer) clearTimeout(realtimeRetryTimer);
        realtimeRetryTimer = null;
        void stopRealtime();
      }
    };
  }, [refresh, source]);

  return { orders, setOrders, isLoading, error, refresh, beginMutation, settleMutation };
}
