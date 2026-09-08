import { getSupabaseBrowserClient } from "./supabase-browser";

let resolvedCafe: { userId: string; cafeId: string } | null = null;

/** Resolves the signed-in staff member's explicit cafe scope. */
export async function getManagerCafeId(): Promise<string> {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured");
  const session = await db.auth.getSession();
  const user = session.data.session?.user;
  if (session.error || !user) throw session.error ?? new Error("Staff authentication is required");
  if (resolvedCafe?.userId === user.id) return resolvedCafe.cafeId;
  const profile = await db.from("staff_profiles").select("cafe_id").eq("user_id", user.id).maybeSingle();
  if (profile.error) throw profile.error;
  if (typeof profile.data?.cafe_id !== "string") throw new Error("Staff account is not linked to a cafe");
  resolvedCafe = { userId: user.id, cafeId: profile.data.cafe_id };
  return profile.data.cafe_id;
}

export type CafeSettingsRecord = {
  id: string;
  cafe_name: string;
  phone: string | null;
  currency: string | null;
  address: string | null;
  logo_url: string | null;
  branch_name: string | null;
  service_charge_type: "percent" | "fixed";
  service_charge_value: number | string;
  service_charge_enabled: boolean;
  tax_charge_type: "percent" | "fixed";
  tax_charge_value: number | string;
  tax_charge_enabled: boolean;
};

export async function loadCafeSettings(): Promise<CafeSettingsRecord | null> {
  const db = getSupabaseBrowserClient();
  if (!db) return null;
  const cafeId = await getManagerCafeId();
  const { data, error } = await db.from("cafe_settings").select("id,cafe_name,phone,currency,address,logo_url,branch_name,service_charge_type,service_charge_value,service_charge_enabled,tax_charge_type,tax_charge_value,tax_charge_enabled").eq("id", cafeId).maybeSingle();
  if (error) throw error;
  return data as CafeSettingsRecord | null;
}

export async function saveCafeBillingSettings(settings: {
  serviceEnabled: boolean; serviceType: "percent" | "fixed"; serviceValue: number;
  taxEnabled: boolean; taxType: "percent" | "fixed"; taxValue: number;
}) {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured");
  const cafeId = await getManagerCafeId();
  const { error } = await db.from("cafe_settings").update({
    service_charge_enabled: settings.serviceEnabled,
    service_charge_type: settings.serviceType,
    service_charge_value: Math.max(0, settings.serviceValue),
    tax_charge_enabled: settings.taxEnabled,
    tax_charge_type: settings.taxType,
    tax_charge_value: Math.max(0, settings.taxValue),
    updated_at: new Date().toISOString(),
  }).eq("id", cafeId);
  if (error) throw error;
}

export async function saveCafeSettings(settings: Pick<CafeSettingsRecord, "cafe_name" | "phone" | "currency" | "address" | "logo_url" | "branch_name">) {
  const db = getSupabaseBrowserClient();
  if (!db) throw new Error("Supabase is not configured");
  const cafeId = await getManagerCafeId();
  const { error } = await db.from("cafe_settings").upsert({ id: cafeId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

export type PublicCafeBranding = {
  cafeId: string;
  cafeName: string;
  logo: string;
};

export async function loadPublicCafeBranding(): Promise<PublicCafeBranding | null> {
  const cafeId = process.env.NEXT_PUBLIC_CAFE_ID?.trim();
  const db = getSupabaseBrowserClient();
  if (!cafeId || !db) return null;
  const { data, error } = await db.rpc("get_public_cafe_branding", { target_cafe_id: cafeId }).maybeSingle();
  if (error) throw error;
  const row = data as { cafe_id?: unknown; cafe_name?: unknown; logo_url?: unknown } | null;
  if (!row || typeof row.cafe_id !== "string") return null;
  return {
    cafeId: row.cafe_id,
    cafeName: typeof row.cafe_name === "string" ? row.cafe_name : "",
    logo: typeof row.logo_url === "string" ? row.logo_url : "",
  };
}
