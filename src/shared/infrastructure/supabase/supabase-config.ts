export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/** Returns configuration only when both public environment variables exist. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function hasSupabaseConfig(): boolean {
  return getSupabaseConfig() !== null;
}
