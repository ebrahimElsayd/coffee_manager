"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { useManagerNotifications } from "@/features/notifications/presentation/providers/manager-notifications-provider";
import { AccountSettingsDialog } from "@/shared/presentation/components/account-settings-dialog";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { clearManagerOrdersCache } from "@/features/orders/presentation/hooks/use-manager-orders";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

const navigation = [
  { href: "/dashboard", label: "Dashboard", arabic: "لوحة التحكم", icon: "dashboard" },
  { href: "/orders", label: "Orders", arabic: "الطلبات", icon: "orders" },
  { href: "/products", label: "Products & Menu", arabic: "المنتجات والقائمة", icon: "products" },
  { href: "/reports", label: "Reports", arabic: "التقارير", icon: "reports" },
  { href: "/settings", label: "Settings", arabic: "الإعدادات", icon: "settings" },
] as const;

export function ManagerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const { settings, updateSettings } = useManagerSettings();
  const { locale, pick } = useManagerI18n();
  const { newOrderCount } = useManagerNotifications();
  useEffect(() => {
    navigation.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  const logout = () => {
    clearManagerOrdersCache();
    window.sessionStorage.removeItem("coffee-manager:session");
    void getSupabaseBrowserClient()?.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="manager-sidebar fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-white/[.08] bg-[#0b0d0d] px-1.5 py-4 text-[#e8e2d6] shadow-2xl lg:w-[184px] lg:px-2 xl:w-[200px] xl:px-2.5 2xl:w-[224px] 2xl:px-3 2xl:py-6">
      <Link href="/dashboard" className="group flex flex-col items-center border-b border-white/[.08] pb-5 text-center lg:pb-7">
        <span className="mb-3 grid size-12 place-items-center overflow-hidden rounded-full border border-[var(--gold)]/60 bg-[#17130c] bg-cover bg-center bg-no-repeat text-2xl text-[var(--gold)] transition group-hover:bg-[var(--gold)]/10" style={settings.logo ? { backgroundImage: `url(${settings.logo})` } : undefined}>{settings.logo ? null : "♨"}</span>
        <strong className="mt-1 hidden max-w-full truncate text-[13px] font-medium tracking-wide lg:block">{settings.cafeName || "Cafe Management"}</strong>
        <span className="mt-1 hidden max-w-full truncate text-[11px] text-[var(--gold)] lg:block">{settings.branchName || "Cashier &amp; Barista"}</span>
      </Link>

      <nav className="mt-5 flex flex-1 flex-col gap-1.5 lg:mt-5 xl:mt-6 2xl:mt-7" aria-label="Manager navigation">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href === "/products" && pathname.startsWith("/products"));
          return (
            <Link key={item.href} href={item.href} aria-label={item.label} className={`group relative flex min-h-12 items-center justify-center gap-3 rounded-xl px-1.5 transition lg:min-h-12 lg:justify-start lg:px-2.5 xl:min-h-14 xl:px-3 ${active ? "border border-[var(--gold)]/60 bg-[var(--gold)]/[.09] text-[var(--gold)] shadow-[0_0_24px_rgba(224,160,32,.06)]" : "text-[#bcb8ae] hover:bg-white/[.04] hover:text-white"}`}>
              <Icon name={item.icon} active={active} />
              <span className="hidden flex-col leading-tight lg:flex">
                <span className="text-[13px] font-medium">{locale === "ar" ? item.arabic : item.label}</span>
              </span>
              {item.icon === "orders" && newOrderCount > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-extrabold leading-5 text-[#17120a] lg:static lg:ml-auto">{newOrderCount > 99 ? "99+" : newOrderCount}</span>}
            </Link>
          );
        })}
      </nav>

      <Link href="/orders" aria-label="Notifications" className={`mx-1 mb-4 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition lg:mx-2 ${newOrderCount > 0 ? "border-[var(--gold)]/70 bg-[var(--gold)]/[.12] text-[#ffd477] animate-pulse" : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"}`}>
        <span className="text-lg" aria-hidden="true">♧</span>
        <span className="hidden text-xs lg:block">{pick("Notifications", "الإشعارات")}</span>
        {newOrderCount > 0 && <b className="ml-auto rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] text-[#17120a]">{newOrderCount > 99 ? "99+" : newOrderCount}</b>}
      </Link>

      {accountOpen && <div className="absolute bottom-[86px] left-2 right-2 z-30 rounded-xl border border-white/15 bg-[#171916] p-2 shadow-2xl lg:left-3 lg:right-3"><div className="border-b border-white/10 px-3 py-2"><p className="text-xs text-white/45">{pick("Current account", "الحساب الحالي")}</p><b className="mt-1 block text-sm">{pick("Admin", "مدير النظام")}</b><small className="mt-1 block truncate text-[11px] text-[var(--gold)]">{settings.adminEmail}</small><small className="mt-1 block truncate text-[10px] text-white/40">{settings.adminPhone}</small></div><button type="button" onClick={() => setAccountSettingsOpen(true)} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[.06] hover:text-white">⚙ {pick("Account Settings", "إعدادات الحساب")}</button><button type="button" onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-300/80 hover:bg-red-400/10 hover:text-red-200">↪ {pick("Logout", "تسجيل الخروج")}</button></div>}

      <AccountSettingsDialog open={accountSettingsOpen} settings={settings} onClose={() => setAccountSettingsOpen(false)} onSavePhone={async (phone) => { const db = getSupabaseBrowserClient(); if (db) { const { error } = await db.auth.updateUser({ phone }); if (error) throw error; } updateSettings({ adminPhone: phone }); return { verificationRequired: Boolean(db) }; }} onVerifyPhone={async (phone, token) => { const db = getSupabaseBrowserClient(); if (!db) return; const { error } = await db.auth.verifyOtp({ phone, token, type: "phone_change" }); if (error) throw error; }} />
      <button type="button" onClick={() => setAccountOpen((open) => !open)} className="flex items-center justify-center gap-3 border-t border-white/[.08] px-1 pt-5 text-start text-[#d2ccc0] transition hover:text-white lg:justify-start lg:px-3 lg:pt-6" aria-label={pick("Admin account", "حساب المدير")} aria-expanded={accountOpen}>
        <span className="grid size-10 place-items-center rounded-full border border-[var(--gold)]/70 bg-[#2b251a] text-xl text-[var(--gold)]">●</span>
        <span className="flex flex-1 flex-col leading-tight"><span className="text-[13px]">{pick("Admin", "مدير النظام")}</span></span>
        <span className="text-lg text-white/50">⌄</span>
      </button>
    </aside>
  );
}

function Icon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "var(--gold)" : "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "dashboard") return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" {...common} /><rect x="14" y="4" width="6" height="6" rx="1" {...common} /><rect x="4" y="14" width="6" height="6" rx="1" {...common} /><rect x="14" y="14" width="6" height="6" rx="1" {...common} /></svg>;
  if (name === "orders") return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7zM9 7h6M9 11h6M9 15h4" {...common} /><path d="M9 3v2M15 3v2" {...common} /></svg>;
  if (name === "tables") return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M6 9v8M18 9v8M4 17h3M17 17h3M5 7h14l-1-3H6L5 7Z" {...common} /></svg>;
  if (name === "products") return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16M6 10V7l3-3h6l3 3v3M7 10v8M17 10v8M5 18h14" {...common} /><path d="M10 6h4" {...common} /></svg>;
  if (name === "reports") return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V12M10 20V5M16 20v-8M22 20H2" {...common} /></svg>;
  return <svg className="size-7 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14 5.2l3-.2.8 2.9 2.7 1.4-1.1 2.8 1.1 2.8-2.7 1.4-.8 2.9-3-.2L12 21l-2-2.2-3 .2-.8-2.9-2.7-1.4 1.1-2.8-1.1-2.8 2.7-1.4.8-2.9 3 .2L12 3Z" {...common} /><circle cx="12" cy="12" r="3" {...common} /></svg>;
}
