"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ChartError({
  title = "Error Loading Chart",
  message = "Failed to load chart data. Please try again.",
  onRetry,
  className,
}: ChartErrorProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertCircleIcon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground mb-4">{message}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
