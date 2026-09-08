import { getSupabaseBrowserClient } from "./supabase-browser";
import { getManagerCafeId } from "./supabase-cafe-settings";

export type ManagedTable = {
  id: string;
  cafeId: string;
  number: string;
  status: "available" | "occupied";
  qrToken: string;
};

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase unavailable");
  return client;
}

export async function listCafeTables(): Promise<ManagedTable[]> {
  const client = requireClient();
  const cafeId = await getManagerCafeId();
  const { data, error } = await client
    .from("cafe_tables")
    .select("id,cafe_id,table_number,status,qr_token")
    .eq("cafe_id", cafeId)
    .order("table_number");
  if (error) throw error;
  return (data ?? []).map((table) => ({
    id: String(table.id),
    cafeId: String(table.cafe_id),
    number: String(table.table_number),
    status: table.status === "occupied" ? "occupied" : "available",
    qrToken: String(table.qr_token),
  }));
}

export async function createCafeTable(tableNumber: string) {
  const normalized = tableNumber.trim();
  if (!normalized) throw new Error("Enter a table number");
  const client = requireClient();
  const cafeId = await getManagerCafeId();
  const { error } = await client.from("cafe_tables").insert({
    cafe_id: cafeId,
    table_number: normalized,
    status: "available",
  });
  if (error) throw error;
}

export async function deleteCafeTable(id: string) {
  const client = requireClient();
  const cafeId = await getManagerCafeId();
  const { data: activeSessions, error: sessionError } = await client
    .from("table_sessions")
    .select("id")
    .eq("table_id", id)
    .in("status", ["open", "ordering", "payment_pending"])
    .limit(1);
  if (sessionError) throw sessionError;
  if ((activeSessions ?? []).length > 0) throw new Error("Close the active table session before removing this table");
  const { error } = await client.from("cafe_tables").delete().eq("id", id).eq("cafe_id", cafeId);
  if (error) throw error;
}

export function getTableQrUrl(tableNumber: string, cafeId: string, qrToken?: string) {
  const path = `/table/${encodeURIComponent(tableNumber)}`;
  const query = `?cafe=${encodeURIComponent(cafeId)}${qrToken ? `&token=${encodeURIComponent(qrToken)}` : ""}`;
  const configuredCustomerUrl = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim().replace(/\/$/, "");
  if (configuredCustomerUrl) return `${configuredCustomerUrl}${path}${query}`;
  if (typeof window === "undefined") return `${path}${query}`;
  return `${window.location.protocol}//${window.location.hostname}:3002${path}${query}`;
}
