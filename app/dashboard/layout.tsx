"use client";

import { DashboardDataProvider } from "@/contexts/dashboard-data-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardDataProvider>{children}</DashboardDataProvider>;
}
