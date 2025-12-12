"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PaymentStatus = "excellent" | "good" | "average" | "poor" | "unknown";

const statusLabels: Record<PaymentStatus, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  poor: "Poor",
  unknown: "Unknown",
};

const statusDescriptions: Record<PaymentStatus, string> = {
  excellent: "Consistently paid on time",
  good: "Mostly paid on time",
  average: "Some late payments",
  poor: "Frequently late payments",
  unknown: "No payment history yet",
};

interface PaymentScoreVisualizerProps {
  score: number;
  count?: number;
}

function PaymentScoreVisualizer({ score, count = 15 }: PaymentScoreVisualizerProps) {
  const filledBars = Math.round((score / 100) * count);

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`bar-${i}`}
          className={cn("w-1 h-5 rounded-sm", i < filledBars ? "bg-foreground" : "bg-muted")}
        />
      ))}
    </div>
  );
}

export function InvoicePaymentScoreSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row justify-between">
        <CardTitle>
          <Skeleton className="h-8 w-32" />
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

interface InvoicePaymentScoreProps {
  score?: number;
  paidInvoices?: number;
  totalInvoices?: number;
  isLoading?: boolean;
}

export function InvoicePaymentScore({
  score = 0,
  paidInvoices: _paidInvoices = 0,
  totalInvoices = 0,
  isLoading,
}: InvoicePaymentScoreProps) {
  if (isLoading) {
    return <InvoicePaymentScoreSkeleton />;
  }

  const getPaymentStatus = (): PaymentStatus => {
    if (totalInvoices === 0) return "unknown";
    if (score >= 90) return "excellent";
    if (score >= 70) return "good";
    if (score >= 50) return "average";
    return "poor";
  };

  const paymentStatus = getPaymentStatus();

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-col xl:flex-row justify-between gap-4">
        <CardTitle className="font-medium text-2xl font-serif">
          {statusLabels[paymentStatus]}
        </CardTitle>

        <PaymentScoreVisualizer score={score} count={15} />
      </CardHeader>

      <CardContent className="sm:hidden xl:flex">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Payment score</div>
          <div className="text-sm text-muted-foreground">{statusDescriptions[paymentStatus]}</div>
        </div>
      </CardContent>
    </Card>
  );
}
