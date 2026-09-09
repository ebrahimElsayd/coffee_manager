"use client";

import { useCallback } from "react";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";

export type ManagerLocale = "ar" | "en";

const statusLabels: Record<string, readonly [string, string]> = {
  all: ["All", "الكل"],
  new: ["New", "جديد"],
  received: ["Received", "تم الاستلام"],
  preparing: ["Preparing", "قيد التحضير"],
  ready: ["Ready", "جاهز"],
  served: ["Delivered", "تم التسليم"],
  delivered: ["Delivered", "تم التسليم"],
  completed: ["Completed", "مكتمل"],
  done: ["Done", "منتهي"],
  cancelled: ["Cancelled", "ملغي"],
  available: ["Available", "متاحة"],
  occupied: ["Occupied", "مشغولة"],
  seated: ["Seated", "يوجد عملاء"],
  paid: ["Paid", "مدفوع"],
  unpaid: ["Unpaid", "غير مدفوع"],
  pending: ["Pending", "قيد الانتظار"],
  acknowledged: ["Acknowledged", "تمت الاستجابة"],
};

export function useManagerI18n() {
  const { settings } = useManagerSettings();
  const locale: ManagerLocale = settings.language === "العربية" ? "ar" : "en";
  const pick = useCallback((english: string, arabic: string) => locale === "ar" ? arabic : english, [locale]);
  const statusLabel = useCallback((status: string) => {
    const labels = statusLabels[status.trim().toLowerCase()];
    return labels ? labels[locale === "ar" ? 1 : 0] : status;
  }, [locale]);

  return { locale, dir: locale === "ar" ? "rtl" as const : "ltr" as const, pick, statusLabel };
}
