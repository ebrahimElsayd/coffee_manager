"use client";

import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";
import type { ManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";

type Props = { open: boolean; settings: ManagerSettings; role?: string; emailConfirmed?: boolean; onClose: () => void; onRequestPasswordReset?: () => Promise<void> | void };

export function AccountSettingsDialog({ open, settings, role, emailConfirmed = false, onClose, onRequestPasswordReset }: Props) {
  const { pick } = useManagerI18n();
  const operatorLabel = role === "manager" || role === "admin" || role === "owner"
    ? pick("Cafe owner · Full operations", "مالك الكافيه · كل عمليات التشغيل")
    : pick("One operating account", "حساب تشغيل موحّد");
  if (!open) return null;
  const requestPasswordReset = async () => { try { await onRequestPasswordReset?.(); window.alert(pick("A password reset link was sent to the account email.", "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد الحساب.")); } catch (error) { window.alert(error instanceof Error ? error.message : pick("Could not send the reset link.", "تعذر إرسال رابط إعادة التعيين.")); } };
  return <div className="account-settings-dialog fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={pick("Account settings", "إعدادات الحساب")} onClick={onClose}><section className="w-full max-w-md rounded-2xl border border-[var(--gold)]/50 bg-[#151715] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-white/10 pb-4"><div><p className="text-xs uppercase tracking-[.2em] text-[var(--gold)]">{pick("Security", "الأمان")}</p><h2 className="mt-1 font-serif text-2xl">{pick("Account Settings", "إعدادات الحساب")}</h2><p className="mt-1 text-xs text-white/45">{operatorLabel}</p></div><button type="button" onClick={onClose} className="text-xl text-white/50 hover:text-white" aria-label={pick("Close", "إغلاق")}>×</button></div><div className="mt-5 space-y-4"><label className="block text-sm text-white/70">{pick("Account Email", "بريد الحساب")}<input readOnly value={settings.adminEmail} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55 outline-none" /><small className={`mt-1 block text-xs ${emailConfirmed ? "text-emerald-300" : "text-amber-300"}`}>{emailConfirmed ? pick("Email confirmed", "البريد مؤكد") : pick("Email confirmation pending", "تأكيد البريد معلق")}</small></label><button type="button" onClick={() => { void requestPasswordReset(); }} className="w-full rounded-xl border border-[var(--gold)]/60 py-3 text-sm text-[#f5ca72] transition hover:bg-[var(--gold)]/10">{pick("Change Password", "تغيير كلمة المرور")}</button></div><button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-[#eab454] py-3 text-sm font-semibold text-[#1a1308]">{pick("Close", "إغلاق")}</button></section></div>;
}
