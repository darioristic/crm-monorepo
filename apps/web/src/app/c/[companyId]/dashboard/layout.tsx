import type React from "react";
import DashboardLayout from "@/app/dashboard/layout";

export default function CompanyDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
