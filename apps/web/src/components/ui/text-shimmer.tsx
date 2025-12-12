"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TextShimmerProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({ children, className, duration = 2, spread = 2 }: TextShimmerProps) {
  return (
    <span
      style={
        {
          "--spread": spread,
          "--shimmer-duration": `${duration}s`,
        } as CSSProperties
      }
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text",
        "text-transparent [--base-color:#a1a1aa] [--base-gradient-color:#000]",
        "dark:[--base-color:#71717a] dark:[--base-gradient-color:#ffffff]",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)*1em),var(--base-gradient-color)_50%,#0000_calc(50%+var(--spread)*1em))_no-repeat,linear-gradient(var(--base-color)_0_0)_no-repeat]",
        "[background:var(--bg)]",
        "animate-[shimmer-text_var(--shimmer-duration)_ease-in-out_infinite]",
        className
      )}
    >
      {children}
    </span>
  );
}
