"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ManagerNotificationsProvider } from "@/features/notifications/presentation/providers/manager-notifications-provider";
import { useManagerAuth } from "@/shared/presentation/providers/manager-auth-provider";

const publicPaths = new Set(["/", "/login"]);

export function ManagerAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useManagerAuth();
  const isPublic = publicPaths.has(pathname);

  useEffect(() => {
    if (!isPublic && (status === "signed-out" || status === "unauthorized")) {
      router.replace("/login");
      router.refresh();
    }
  }, [isPublic, router, status]);

  if (isPublic) return children;
  if (status !== "authenticated") {
    return <main className="grid min-h-screen place-items-center bg-[var(--background)] text-sm text-white/55">جاري التحقق من الجلسة…</main>;
  }
  return <ManagerNotificationsProvider>{children}</ManagerNotificationsProvider>;
}
