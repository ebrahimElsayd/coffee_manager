"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";

export type TableServiceRequest = {
  id: string;
  sessionId: string;
  table: string;
  type: string;
  status: "open" | "acknowledged" | "resolved" | "cancelled";
  note: string | null;
  createdAt: string;
};

type RequestRow = {
  id: string;
  session_id: string;
  type: string;
  status: TableServiceRequest["status"];
  note: string | null;
  created_at: string;
  table_sessions: { cafe_tables: { cafe_id: string; table_number: number } | { cafe_id: string; table_number: number }[] } | null;
};

function mapRequest(row: RequestRow): TableServiceRequest | null {
  const relation = row.table_sessions?.cafe_tables;
  const table = Array.isArray(relation) ? relation[0] : relation;
  if (!table) return null;
  return { id: row.id, sessionId: row.session_id, table: String(table.table_number), type: row.type, status: row.status, note: row.note, createdAt: row.created_at };
}

export function useTableServiceRequestsListener() {
  const [pendingRequests, setPendingRequests] = useState<TableServiceRequest[]>([]);
  const [lastLiveRequestId, setLastLiveRequestId] = useState<string | null>(null);
  const cafeIdRef = useRef<string | null>(null);

  const loadPending = useCallback(async (cafeId: string) => {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    const result = await db.from("service_requests")
      .select("id,session_id,type,status,note,created_at,table_sessions!inner(cafe_tables!inner(cafe_id,table_number))")
      .eq("table_sessions.cafe_tables.cafe_id", cafeId)
      .eq("status", "open")
      .order("created_at", { ascending: true });
    if (result.error) throw result.error;
    setPendingRequests((result.data as unknown as RequestRow[]).map(mapRequest).filter((item): item is TableServiceRequest => Boolean(item)));
  }, []);

  const loadOne = useCallback(async (cafeId: string, requestId: string) => {
    const db = getSupabaseBrowserClient();
    if (!db) return null;
    const result = await db.from("service_requests")
      .select("id,session_id,type,status,note,created_at,table_sessions!inner(cafe_tables!inner(cafe_id,table_number))")
      .eq("id", requestId).eq("cafe_id", cafeId).eq("status", "open").maybeSingle();
    if (result.error) throw result.error;
    return result.data ? mapRequest(result.data as unknown as RequestRow) : null;
  }, []);

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let connecting = false;
    const reconcile = async () => {
      const cafeId = cafeIdRef.current;
      if (!cafeId || disposed) return;
      try { await loadPending(cafeId); retryAttempt = 0; } catch { scheduleReconnect(); }
    };
    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      const delay = Math.min(30_000, 1_000 * 2 ** retryAttempt++);
      retryTimer = setTimeout(() => { retryTimer = null; void connect(); }, delay);
    };
    const connect = async () => {
      if (disposed || connecting || channel) return;
      connecting = true;
      try {
        const cafeId = cafeIdRef.current ?? await getManagerCafeId();
        cafeIdRef.current = cafeId;
        await loadPending(cafeId);
        if (disposed) return;
        const db = getSupabaseBrowserClient();
        if (!db) return;
        channel = db.channel(`table-service-requests:${cafeId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_requests", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
            const requestId = (payload.new as { id?: unknown }).id;
            if (typeof requestId === "string") setLastLiveRequestId(requestId);
            if (typeof requestId === "string") void loadOne(cafeId, requestId).then((request) => {
              if (!request || disposed) return;
              setPendingRequests((current) => current.some((item) => item.id === request.id) ? current : [...current, request]);
            }).catch(scheduleReconnect);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") { retryAttempt = 0; return; }
            if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT" && status !== "CLOSED") return;
            if (disposed) return;
            const failed = channel;
            channel = null;
            if (failed && status !== "CLOSED") void failed.unsubscribe();
            scheduleReconnect();
          });
      } catch { setPendingRequests([]); scheduleReconnect(); }
      finally { connecting = false; }
    };
    let hiddenAt: number | null = null;
    const wake = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (navigator.onLine && hiddenAt && Date.now() - hiddenAt >= 60_000) { void reconcile(); if (!channel) scheduleReconnect(); }
      hiddenAt = null;
    };
    const wakeOnline = () => { if (document.visibilityState !== "hidden") { void reconcile(); if (!channel) scheduleReconnect(); } };
    void connect();
    window.addEventListener("online", wakeOnline);
    document.addEventListener("visibilitychange", wake);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", wakeOnline);
      document.removeEventListener("visibilitychange", wake);
      if (channel) { const db = getSupabaseBrowserClient(); if (db) void db.removeChannel(channel); }
      channel = null;
    };
  }, [loadOne, loadPending]);

  const acknowledgeRequest = useCallback(async (requestId: string) => {
    const db = getSupabaseBrowserClient();
    const cafeId = cafeIdRef.current;
    if (!db || !cafeId) throw new Error("Supabase is not configured");
    const result = await db.from("service_requests").update({ status: "acknowledged" }).eq("id", requestId).eq("cafe_id", cafeId).eq("status", "open");
    if (result.error) throw result.error;
    setPendingRequests((current) => current.filter((request) => request.id !== requestId));
  }, []);

  return { pendingRequests, lastLiveRequestId, acknowledgeRequest };
}
