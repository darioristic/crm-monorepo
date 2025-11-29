"use client";

import { BarChart3Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyChartStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyChartState({ 
  title = "No Data Available",
  message = "There is no data to display for the selected filters.",
  icon,
  className 
}: EmptyChartStateProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          {icon || <BarChart3Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />}
          <p className="text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

