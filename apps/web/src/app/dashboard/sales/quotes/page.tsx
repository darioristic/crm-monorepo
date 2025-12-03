"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { QuotesDataTable } from "@/components/sales/quotes-data-table";
import { QuoteSheet } from "@/components/quote/quote-sheet";
import { useQuoteSettings } from "@/hooks/use-quote-settings";

function QuotesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { defaultSettings } = useQuoteSettings();

  const handleNewQuote = () => {
    router.push(`${pathname}?type=create`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage your quotes
          </p>
        </div>
        <Button onClick={handleNewQuote}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Quote
        </Button>
      </div>
      <QuotesDataTable />

      {/* Quote Sheet for URL-based opening */}
      <QuoteSheet defaultSettings={defaultSettings} />
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <QuotesPageContent />
    </Suspense>
  );
}
