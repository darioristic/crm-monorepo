"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { QuotesDataTable } from "@/components/sales/quotes-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuoteSettings } from "@/hooks/use-quote-settings";

// Dynamic import for QuoteSheet to reduce initial bundle size
// This component includes Tiptap editor which is heavy
const QuoteSheet = dynamic(
  () => import("@/components/quote/quote-sheet").then((mod) => ({ default: mod.QuoteSheet })),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

function QuotesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { defaultSettings } = useQuoteSettings();
  const [refreshSignal, setRefreshSignal] = useState<number>(0);

  const _handleNewQuote = () => {
    router.push(`${pathname}?type=create`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Create and manage your quotes</p>
        </div>
      </div>
      <QuotesDataTable refreshSignal={refreshSignal} />

      {/* Quote Sheet for URL-based opening */}
      <QuoteSheet
        defaultSettings={defaultSettings}
        onQuoteCreated={() => setRefreshSignal(Date.now())}
      />
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
