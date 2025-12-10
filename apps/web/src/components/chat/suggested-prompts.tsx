"use client";

import {
  AlertCircleIcon,
  BarChart3Icon,
  FileTextIcon,
  PackageIcon,
  PieChartIcon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  className?: string;
}

interface DynamicSuggestionsProps {
  suggestions: string[];
  onSelect: (prompt: string) => void;
  className?: string;
}

const SUGGESTED_PROMPTS = [
  {
    icon: FileTextIcon,
    label: "Invoices",
    prompt: "Show me recent invoices",
    description: "View and manage invoices",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: AlertCircleIcon,
    label: "Overdue",
    prompt: "Which invoices are overdue and need attention?",
    description: "Track payment issues",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    icon: UsersIcon,
    label: "Customers",
    prompt: "Show my top customers by revenue",
    description: "Customer insights",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: TargetIcon,
    label: "Pipeline",
    prompt: "What's the status of our sales pipeline?",
    description: "Track deals & opportunities",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: TrendingUpIcon,
    label: "Sales",
    prompt: "Analyze our sales performance this month",
    description: "Revenue & conversions",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: BarChart3Icon,
    label: "Analytics",
    prompt: "Give me a complete business overview with KPIs",
    description: "Metrics & trends",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    icon: PackageIcon,
    label: "Products",
    prompt: "What are our best selling products?",
    description: "Product performance",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: PieChartIcon,
    label: "Reports",
    prompt: "Generate a monthly sales report",
    description: "Detailed reports",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
];

export function SuggestedPrompts({ onSelect, className }: SuggestedPromptsProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl", className)}>
      {SUGGESTED_PROMPTS.map((item, index) => (
        <Button
          key={item.label}
          variant="outline"
          className={cn(
            "h-auto flex flex-col items-start gap-2 p-4 hover:bg-muted/50 text-left",
            "transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
            "animate-in fade-in slide-in-from-bottom-2"
          )}
          style={{ animationDelay: `${index * 50}ms` }}
          onClick={() => onSelect(item.prompt)}
        >
          <div className={cn("p-2 rounded-lg", item.bgColor)}>
            <item.icon className={cn("h-4 w-4", item.color)} />
          </div>
          <div>
            <span className="text-sm font-medium block">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  );
}

export function InlineSuggestions({ onSelect, className }: SuggestedPromptsProps) {
  const quickPrompts = [
    "Show overdue invoices",
    "List recent customers",
    "Revenue this month",
    "Pipeline status",
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {quickPrompts.map((prompt, index) => (
        <Button
          key={prompt}
          variant="secondary"
          size="sm"
          className={cn(
            "text-xs animate-in fade-in slide-in-from-bottom-1",
            "transition-all hover:scale-105"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}

// Dynamic suggestions that can be updated after AI responses
export function DynamicSuggestions({ suggestions, onSelect, className }: DynamicSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2 py-4", className)}>
      <span className="text-xs text-muted-foreground mr-2">Suggested:</span>
      {suggestions.map((suggestion, index) => (
        <Button
          key={suggestion}
          variant="outline"
          size="sm"
          className={cn(
            "text-xs h-7 animate-in fade-in slide-in-from-left-2",
            "hover:bg-primary/10 hover:border-primary/50"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
