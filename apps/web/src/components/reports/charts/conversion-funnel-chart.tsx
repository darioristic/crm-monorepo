"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRightIcon, TrendingUpIcon } from "lucide-react";
import type { ConversionFunnel } from "@crm/types";

interface ConversionFunnelChartProps {
  data: ConversionFunnel;
  className?: string;
}

export function ConversionFunnelChart({ data, className }: ConversionFunnelChartProps) {
  const stages = [
    { label: "Quotes Created", value: data.totalQuotes, color: "bg-blue-500" },
    { label: "Quotes Sent", value: data.sentQuotes, color: "bg-indigo-500" },
    { label: "Quotes Accepted", value: data.acceptedQuotes, color: "bg-violet-500" },
    { label: "Converted to Invoice", value: data.convertedToInvoice, color: "bg-purple-500" },
    { label: "Invoices Paid", value: data.paidInvoices, color: "bg-green-500" },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sales Conversion Funnel</CardTitle>
        <CardDescription>Quote to paid invoice conversion pipeline</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Funnel visualization */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const percentage = (stage.value / maxValue) * 100;
            const conversionFromPrevious = index > 0 && stages[index - 1].value > 0
              ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
              : null;

            return (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{stage.value}</span>
                    {conversionFromPrevious && (
                      <span className="text-xs text-muted-foreground">
                        ({conversionFromPrevious}% from previous)
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted">
                  <div
                    className={`absolute inset-y-0 left-0 ${stage.color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
              <TrendingUpIcon className="h-5 w-5" />
              {data.conversionRate}%
            </div>
            <p className="text-sm text-muted-foreground">Overall Conversion Rate</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {data.avgDaysToConvert} days
            </div>
            <p className="text-sm text-muted-foreground">Avg. Time to Convert</p>
          </div>
        </div>

        {/* Flow visualization */}
        <div className="flex items-center justify-center gap-2 pt-4 border-t">
          {stages.map((stage, index) => (
            <div key={stage.label} className="flex items-center">
              <div className={`px-3 py-1.5 rounded-md ${stage.color} text-white text-xs font-medium`}>
                {stage.value}
              </div>
              {index < stages.length - 1 && (
                <ArrowRightIcon className="mx-1 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

