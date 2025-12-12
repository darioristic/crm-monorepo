"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestionProps {
  text: string;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
}

export function Suggestion({
  text,
  onClick,
  className,
  icon,
  variant = "default",
}: SuggestionProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
        variant === "default" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "outline" && "border border-border bg-transparent hover:bg-secondary/50",
        variant === "ghost" && "bg-transparent hover:bg-secondary/50",
        className
      )}
    >
      {icon || <Sparkles className="size-3.5 text-muted-foreground" />}
      <span>{text}</span>
      <ArrowRight className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
    </motion.button>
  );
}

interface SuggestionListProps {
  suggestions: Array<{
    id: string;
    text: string;
    icon?: React.ReactNode;
  }>;
  onSelect?: (suggestion: { id: string; text: string }) => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  layout?: "horizontal" | "vertical" | "grid";
}

export function SuggestionList({
  suggestions,
  onSelect,
  className,
  variant = "default",
  layout = "horizontal",
}: SuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn(
        "flex gap-2",
        layout === "horizontal" && "flex-wrap",
        layout === "vertical" && "flex-col",
        layout === "grid" && "grid grid-cols-2 gap-2",
        className
      )}
    >
      {suggestions.map((suggestion, index) => (
        <motion.div
          key={suggestion.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Suggestion
            text={suggestion.text}
            icon={suggestion.icon}
            variant={variant}
            onClick={() => onSelect?.(suggestion)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Predefined AI suggestions for common use cases
export const defaultChatSuggestions = [
  { id: "summarize", text: "Summarize this conversation" },
  { id: "explain", text: "Explain in simple terms" },
  { id: "action-items", text: "List action items" },
  { id: "follow-up", text: "Suggest follow-up questions" },
];

export const defaultInvoiceSuggestions = [
  { id: "create-invoice", text: "Create a new invoice" },
  { id: "overdue", text: "Show overdue invoices" },
  { id: "revenue", text: "Calculate monthly revenue" },
  { id: "top-customers", text: "Top customers by revenue" },
];

export const defaultAnalyticsSuggestions = [
  { id: "trends", text: "Show sales trends" },
  { id: "compare", text: "Compare with last month" },
  { id: "forecast", text: "Revenue forecast" },
  { id: "insights", text: "Key insights" },
];
