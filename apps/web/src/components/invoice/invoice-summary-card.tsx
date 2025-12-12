"use client";

import { FormatAmount } from "@/components/format-amount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface InvoiceSummaryData {
  totalAmount: number;
  invoiceCount: number;
  currency: string;
}

interface InvoiceSummaryCardProps {
  data?: InvoiceSummaryData | null;
  title: string;
  isLoading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function InvoiceSummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center">
        <CardTitle className="font-medium text-2xl">
          <Skeleton className="h-[30px] w-32" />
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoiceSummaryCard({
  data,
  title,
  isLoading,
  onClick,
  className,
}: InvoiceSummaryCardProps) {
  if (isLoading) {
    return <InvoiceSummaryCardSkeleton />;
  }

  const content = (
    <Card
      className={cn("transition-colors", onClick && "hover:bg-accent/50 cursor-pointer", className)}
    >
      <CardHeader className="pb-2 flex flex-row items-center">
        <CardTitle className="font-medium text-2xl font-serif">
          <FormatAmount
            amount={data?.totalAmount ?? 0}
            currency={data?.currency ?? "EUR"}
            maximumFractionDigits={0}
            minimumFractionDigits={0}
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-5">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">
            {data?.invoiceCount ?? 0} invoice{(data?.invoiceCount ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left w-full">
        {content}
      </button>
    );
  }

  return content;
}
