"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { InvoicesDataTable } from "@/components/sales/invoices-data-table";
import { InvoiceSheet } from "@/components/invoice/invoice-sheet";
import { useInvoiceSettings } from "@/hooks/use-invoice";

function InvoicesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { defaultSettings } = useInvoiceSettings();

  const handleNewInvoice = () => {
    router.push(`${pathname}?type=create`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage your invoices
          </p>
        </div>
        <Button onClick={handleNewInvoice}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>
      <InvoicesDataTable />

      {/* Invoice Sheet for URL-based opening */}
      <InvoiceSheet defaultSettings={defaultSettings} />
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
