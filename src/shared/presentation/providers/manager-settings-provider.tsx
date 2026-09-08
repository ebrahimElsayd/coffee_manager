"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { loadCafeSettings, loadPublicCafeBranding, saveCafeBillingSettings, saveCafeSettings } from "@/shared/infrastructure/supabase/supabase-cafe-settings";

export type ManagerSettings = {
  cafeName: string;
  branchName: string;
  phone: string;
  currency: string;
  address: string;
  logo: string;
  adminEmail: string;
  adminPhone: string;
  theme: "Dark" | "Light";
  language: "العربية" | "English";
  density: "Comfortable" | "Compact";
  notifications: { newOrder: boolean; ready: boolean; stock: boolean; sound: boolean };
  receipt: { header: string; footer: string; showPrices: boolean; showTax: boolean; serviceEnabled: boolean; serviceType: "percent" | "fixed"; serviceValue: number; taxEnabled: boolean; taxType: "percent" | "fixed"; taxValue: number; size: "Standard" | "Compact" | "Large" };
};

const defaults: ManagerSettings = {
  cafeName: "Cafe Management", branchName: "Cairo Branch", phone: "", currency: "EGP — Egyptian Pound", address: "", logo: "", adminEmail: "manager@kingscafe.com", adminPhone: "+20 100 000 0000",
  theme: "Dark", language: "العربية", density: "Comfortable",
  notifications: { newOrder: true, ready: true, stock: true, sound: true },
  receipt: { header: "Cafe Management", footer: "Thank you for choosing us", showPrices: true, showTax: false, serviceEnabled: false, serviceType: "percent", serviceValue: 0, taxEnabled: false, taxType: "percent", taxValue: 0, size: "Standard" },
};

type SettingsContextValue = { settings: ManagerSettings; updateSettings: (patch: Partial<ManagerSettings>) => void; resetSettings: () => void };
const SettingsContext = createContext<SettingsContextValue | null>(null);
const storageKey = "kings-cafe-manager-settings";

export function ManagerSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ManagerSettings>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ManagerSettings>;
        // Hydration is the one intentional state sync from browser storage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings({ ...defaults, ...parsed, notifications: { ...defaults.notifications, ...parsed.notifications }, receipt: { ...defaults.receipt, ...parsed.receipt } });
      }
    } catch { /* use defaults when storage is unavailable or malformed */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const db = getSupabaseBrowserClient();
    if (!db) { queueMicrotask(() => { if (active) setRemoteLoaded(true); }); return () => { active = false; }; }
    void Promise.all([db.auth.getSession(), loadCafeSettings().catch(() => null)]).then(async ([authResult, cafe]) => {
      if (!active) return;
      const publicBranding = cafe ? null : await loadPublicCafeBranding().catch(() => null);
      if (!active) return;
      const user = authResult.data.session?.user;
      setSettings((current) => ({
        ...current,
        ...(publicBranding ? { cafeName: publicBranding.cafeName || current.cafeName, logo: publicBranding.logo || current.logo, receipt: { ...current.receipt, header: publicBranding.cafeName || current.receipt.header } } : {}),
        ...(cafe ? { cafeName: cafe.cafe_name || current.cafeName, branchName: cafe.branch_name || current.branchName, phone: cafe.phone ?? current.phone, currency: cafe.currency || current.currency, address: cafe.address ?? current.address, logo: cafe.logo_url ?? current.logo, receipt: { ...current.receipt, header: cafe.cafe_name || current.receipt.header, serviceEnabled: cafe.service_charge_enabled, serviceType: cafe.service_charge_type, serviceValue: Number(cafe.service_charge_value || 0), taxEnabled: cafe.tax_charge_enabled, taxType: cafe.tax_charge_type, taxValue: Number(cafe.tax_charge_value || 0) } } : {}),
        adminEmail: user?.email ?? current.adminEmail,
        adminPhone: user?.phone || current.adminPhone,
      }));
      setRemoteLoaded(true);
    }).catch(() => { if (active) setRemoteLoaded(true); });
    return () => { active = false; };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !remoteLoaded) return;
    void saveCafeSettings({ cafe_name: settings.cafeName, branch_name: settings.branchName, phone: settings.phone, currency: settings.currency, address: settings.address, logo_url: settings.logo }).catch(() => { /* UI remains usable while a transient save retries on the next change. */ });
  }, [hydrated, remoteLoaded, settings.cafeName, settings.branchName, settings.phone, settings.currency, settings.address, settings.logo]);

  useEffect(() => {
    if (!hydrated || !remoteLoaded) return;
    void saveCafeBillingSettings({
      serviceEnabled: settings.receipt.serviceEnabled,
      serviceType: settings.receipt.serviceType,
      serviceValue: settings.receipt.serviceValue,
      taxEnabled: settings.receipt.taxEnabled,
      taxType: settings.receipt.taxType,
      taxValue: settings.receipt.taxValue,
    }).catch(() => { /* Retry on the next settings change. */ });
  }, [hydrated, remoteLoaded, settings.receipt.serviceEnabled, settings.receipt.serviceType, settings.receipt.serviceValue, settings.receipt.taxEnabled, settings.receipt.taxType, settings.receipt.taxValue]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // The logo is a remote asset; never duplicate its base64 payload in the
      // browser cache. This keeps settings persistence below storage quotas.
      window.localStorage.setItem(storageKey, JSON.stringify({ ...settings, logo: "" }));
    } catch (error) {
      // Storage can still be unavailable in private browsing; keep the
      // in-memory settings usable in that case.
      if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22)) {
        try { window.localStorage.removeItem(storageKey); } catch { /* storage is unavailable; keep the in-memory state */ }
      }
    }
    document.documentElement.dataset.theme = settings.theme.toLowerCase();
    document.documentElement.lang = settings.language === "العربية" ? "ar" : "en";
    document.documentElement.dir = settings.language === "العربية" ? "rtl" : "ltr";
  }, [settings, hydrated]);

  const value = useMemo(() => ({
    settings,
    updateSettings: (patch: Partial<ManagerSettings>) => setSettings((current) => ({ ...current, ...patch })),
    resetSettings: () => setSettings(defaults),
  }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useManagerSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useManagerSettings must be used inside ManagerSettingsProvider");
  return context;
}
