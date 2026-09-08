import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ManagerSettingsProvider } from "@/shared/presentation/providers/manager-settings-provider";
import { ManagerNotificationsProvider } from "@/features/notifications/presentation/providers/manager-notifications-provider";

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
      <body><ManagerSettingsProvider><ManagerNotificationsProvider>{children}</ManagerNotificationsProvider></ManagerSettingsProvider></body>
    </html>
  );
}
