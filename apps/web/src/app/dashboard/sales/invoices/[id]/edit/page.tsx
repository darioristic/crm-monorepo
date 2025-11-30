"use client";

import { use } from "react";
import type { Invoice } from "@crm/types";
import { invoicesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { InvoiceForm } from "@/components/sales/invoice-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditInvoicePage({ params }: PageProps) {
  const { id } = use(params);

  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useApi<Invoice>(() => invoicesApi.getById(id), { autoFetch: true });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refetch()}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sales/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invoice not found</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sales/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Invoice</h1>
        <p className="text-muted-foreground">
          Editing invoice {invoice.invoiceNumber}
        </p>
      </div>
      <InvoiceForm invoice={invoice} mode="edit" />
    </div>
  );
}

