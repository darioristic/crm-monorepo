"use client";

import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { invoicesApi } from "@/lib/api";
import { InvoicePublicView } from "../../[token]/invoice-public-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default function InvoiceByIdPage({ params }: Props) {
  const { id } = use(params);

  const {
    data: invoice,
    isLoading,
    error,
  } = useApi<any>(() => invoicesApi.getById(id), { autoFetch: true });

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4">
        <div className="flex flex-col w-full max-w-[595px] py-6">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-[842px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 dotted-bg">
        <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The invoice you're looking for doesn't exist or has been removed.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales/invoices">Go to Invoices</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <InvoicePublicView invoice={invoice} token={id} />;
}
