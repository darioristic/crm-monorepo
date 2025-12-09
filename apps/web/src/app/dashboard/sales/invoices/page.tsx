"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { InvoicesDataTable } from "@/components/sales/invoices-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";

// Dynamic import for InvoiceSheet to reduce initial bundle size
// This component includes Tiptap editor which is heavy
const InvoiceSheet = dynamic(
  () => import("@/components/invoice/invoice-sheet").then((mod) => ({ default: mod.InvoiceSheet })),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

function InvoicesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { defaultSettings } = useInvoiceSettings();
  const [refreshKey, setRefreshKey] = useState(0);

  const _handleNewInvoice = () => {
    router.push(`${pathname}?type=create`);
  };

  const handleInvoiceCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Create and manage your invoices</p>
        </div>
      </div>
      <InvoicesDataTable refreshTrigger={refreshKey} />

      {/* Invoice Sheet for URL-based opening */}
      <InvoiceSheet defaultSettings={defaultSettings} onInvoiceCreated={handleInvoiceCreated} />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
