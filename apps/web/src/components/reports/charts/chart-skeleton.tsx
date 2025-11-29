"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ChartSkeletonProps {
  className?: string;
  showHeader?: boolean;
  height?: number;
}

export function ChartSkeleton({ 
  className, 
  showHeader = true,
  height = 300 
}: ChartSkeletonProps) {
  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
      )}
      <CardContent>
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

