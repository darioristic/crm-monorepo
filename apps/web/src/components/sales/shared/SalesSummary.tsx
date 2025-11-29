"use client";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SalesSummaryProps {
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  paidAmount?: number;
  showBalance?: boolean;
  className?: string;
}

export function SalesSummary({
  subtotal,
  taxRate,
  tax,
  total,
  paidAmount,
  showBalance = false,
  className,
}: SalesSummaryProps) {
  const balance = paidAmount !== undefined ? total - paidAmount : 0;
  const hasBalance = showBalance && paidAmount !== undefined && balance > 0;

  return (
    <Card className={cn("p-4 bg-muted/50", className)}>
      <div className="space-y-2 text-right">
        <div className="flex justify-end gap-8">
          <span className="text-muted-foreground">Subtotal:</span>
          <span className="font-medium w-32">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-end gap-8">
          <span className="text-muted-foreground">Tax ({taxRate}%):</span>
          <span className="font-medium w-32">{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-end gap-8 text-lg border-t pt-2">
          <span className="font-semibold">Total:</span>
          <span className="font-bold w-32">{formatCurrency(total)}</span>
        </div>
        {showBalance && paidAmount !== undefined && (
          <>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-muted-foreground">Paid:</span>
              <span className="font-medium w-32 text-green-600">
                {formatCurrency(paidAmount)}
              </span>
            </div>
            {hasBalance && (
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-muted-foreground">Balance Due:</span>
                <span className="font-medium w-32 text-destructive">
                  {formatCurrency(balance)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

