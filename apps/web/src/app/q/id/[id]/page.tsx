"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotePublicView } from "../../[token]/quote-public-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default function QuoteByIdPage({ params }: Props) {
  const { id } = use(params);
  interface PublicQuote {
    id: string;
    quoteNumber: string | null;
    issueDate: string | null;
    validUntil: string | null;
    createdAt: string;
    updatedAt: string | null;
    total: number;
    currency?: string | null;
    items?: Array<{
      productName?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      unit?: string;
      discount?: number;
      vat?: number;
      vatRate?: number;
    }>;
    terms?: string;
    notes?: string;
    companyId: string;
    companyName?: string;
    company?: {
      name?: string;
      addressLine1?: string;
      address?: string;
      addressLine2?: string;
      city?: string;
      zip?: string;
      postalCode?: string;
      country?: string;
      email?: string;
      billingEmail?: string;
      phone?: string;
      vatNumber?: string;
      website?: string;
    };
    fromDetails?: unknown;
    customerDetails?: unknown;
    logoUrl?: string | null;
    vat?: number | null;
    tax?: number | null;
    discount?: number | null;
    subtotal: number;
    status: string;
    taxRate?: number;
    vatRate?: number;
    sentAt?: string | null;
    viewedAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
  }
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchQuote() {
      try {
        // Use public API endpoint that doesn't require authentication
        // Uses Next.js proxy to avoid CORS issues
        const response = await fetch(`/api/quotes/public/${id}`);

        if (!response.ok) {
          throw new Error("Quote not found");
        }

        const data = await response.json();
        setQuote(data.data as PublicQuote);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load quote"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuote();
  }, [id]);

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

  if (error || !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 dotted-bg">
        <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The quote you're looking for doesn't exist or has been removed.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales/quotes">Go to Quotes</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <QuotePublicView quote={quote} token={id} />;
}
