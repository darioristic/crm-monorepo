"use client";

import { Timer } from "lucide-react";
import { BaseWidget } from "./base";

export function RunwayWidget() {
  // TODO: Integrate with real data
  const runwayMonths = 0;

  return (
    <BaseWidget
      title="Cash Runway"
      icon={<Timer className="size-4" />}
      description="Your cash runway in months"
      onClick={() => {
        // Navigate to runway analysis
      }}
      actions="View runway"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-normal">{runwayMonths} months</h2>
      </div>
    </BaseWidget>
  );
}
