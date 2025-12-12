"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TextShimmer } from "./text-shimmer";

interface ReasoningProps {
  isLoading?: boolean;
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function Reasoning({
  isLoading = false,
  children,
  className,
  defaultOpen = false,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [startTime] = useState(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const decimals = Math.floor((ms % 1000) / 100);
    return `${seconds}.${decimals}s`;
  };

  return (
    <div className={cn("rounded-lg border border-border bg-muted/50", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
          {isLoading ? (
            <TextShimmer duration={1.5}>Thinking...</TextShimmer>
          ) : (
            <span>Reasoning</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(isLoading || elapsedTime > 0) && (
            <span className="text-xs tabular-nums">{formatTime(elapsedTime)}</span>
          )}
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="size-4" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3 py-2">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
