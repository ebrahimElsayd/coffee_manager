import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ManagerSettingsProvider } from "@/shared/presentation/providers/manager-settings-provider";
import { ManagerAuthProvider } from "@/shared/presentation/providers/manager-auth-provider";
import { ManagerAppShell } from "@/shared/presentation/components/manager-app-shell";

export const metadata: Metadata = {
  title: "King's Café Manager",
  description: "Cashier and barista operations dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><ManagerAuthProvider><ManagerSettingsProvider><ManagerAppShell>{children}</ManagerAppShell></ManagerSettingsProvider></ManagerAuthProvider></body>
    </html>
  );
}
