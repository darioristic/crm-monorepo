import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { ThemeProvider } from "next-themes";
import { ActiveThemeProvider } from "@/components/shared/active-theme";
import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

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
                <NuqsAdapter>
                  {children}
                </NuqsAdapter>
                <Toaster />
              </AuthProvider>
            </QueryProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
