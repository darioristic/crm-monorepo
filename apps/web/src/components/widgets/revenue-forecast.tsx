"use client";

import { TrendingUp } from "lucide-react";
import { BaseWidget } from "./base";

export function RevenueForecastWidget() {
  // TODO: Integrate with real data
  const nextMonthProjection = 88976512.24;

  return (
    <BaseWidget
      title="Forecast"
      icon={<TrendingUp className="size-4" />}
      description={
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#878787]">Revenue projection</p>

          {/* Simple trend line */}
          <div className="h-12 w-full flex items-center">
            <svg
              viewBox="0 0 100 40"
              className="w-full h-full"
              preserveAspectRatio="none"
              role="img"
            >
              <title>Revenue trend line</title>
              <path
                d="M 0 35 Q 20 30, 30 25 T 50 20 T 70 15 T 100 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-foreground"
              />
            </svg>
          </div>

          <p className="text-sm text-[#878787]">
            Next month projection{" "}
            <span className="font-medium text-foreground">
              +€{nextMonthProjection.toLocaleString()}
            </span>
          </p>
        </div>
      }
      actions="View forecast details"
      onClick={() => {
        // Navigate to forecast
      }}
    >
      <div />
    </BaseWidget>
  );
}
