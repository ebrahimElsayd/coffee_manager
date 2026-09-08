import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase-config";
let client: SupabaseClient | null = null;
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (client) return client;
  const config = getSupabaseConfig();
  if (!config || typeof window === "undefined") return null;
  client = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
