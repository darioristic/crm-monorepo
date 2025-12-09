import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@/components/providers/query-provider";
import { ActiveThemeProvider } from "@/components/shared/active-theme";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { fontVariables } from "@/lib/fonts";
import { initSentry } from "@/lib/sentry";
import "./globals.css";

// Initialize Sentry on client side
if (typeof window !== "undefined") {
  initSentry();
}

export const metadata: Metadata = {
  title: "CRM Dashboard",
  description: "Modern CRM system for managing customers, sales, and projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <TenantProvider>
                  <NuqsAdapter>{children}</NuqsAdapter>
                  <Toaster />
                </TenantProvider>
              </AuthProvider>
            </QueryProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
