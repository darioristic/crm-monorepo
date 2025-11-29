"use client";

import { useParams } from "next/navigation";
import type { Quote } from "@crm/types";
import { quotesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { QuoteForm } from "@/components/sales/quote-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditQuotePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: quote, isLoading, error, refetch } = useApi<Quote>(
    () => quotesApi.getById(id),
    { autoFetch: true }
  );

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
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refetch()}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sales/quotes">Back to Quotes</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Quote not found</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sales/quotes">Back to Quotes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Quote</h1>
        <p className="text-muted-foreground">
          Editing quote {quote.quoteNumber}
        </p>
      </div>
      <QuoteForm quote={quote} mode="edit" />
    </div>
  );
}

