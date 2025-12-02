"use client";

import { Button } from "@/components/ui/button";
import {
  FileTextIcon,
  UsersIcon,
  TrendingUpIcon,
  PackageIcon,
  AlertCircleIcon,
  BarChart3Icon,
} from "lucide-react";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    icon: FileTextIcon,
    label: "Invoices",
    prompt: "Show me recent invoices",
    color: "text-blue-500",
  },
  {
    icon: AlertCircleIcon,
    label: "Overdue",
    prompt: "Which invoices are overdue?",
    color: "text-red-500",
  },
  {
    icon: UsersIcon,
    label: "Customers",
    prompt: "List my top customers",
    color: "text-green-500",
  },
  {
    icon: TrendingUpIcon,
    label: "Sales",
    prompt: "What's our quote conversion rate?",
    color: "text-purple-500",
  },
  {
    icon: PackageIcon,
    label: "Products",
    prompt: "Show product categories summary",
    color: "text-orange-500",
  },
  {
    icon: BarChart3Icon,
    label: "Analytics",
    prompt: "Give me a business overview",
    color: "text-cyan-500",
  },
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
      {SUGGESTED_PROMPTS.map((item) => (
        <Button
          key={item.label}
          variant="outline"
          className="h-auto flex flex-col items-center gap-2 p-4 hover:bg-muted/50"
          onClick={() => onSelect(item.prompt)}
        >
          <item.icon className={`h-5 w-5 ${item.color}`} />
          <span className="text-sm font-medium">{item.label}</span>
        </Button>
      ))}
    </div>
  );
}

export function InlineSuggestions({ onSelect }: SuggestedPromptsProps) {
  const quickPrompts = [
    "Show overdue invoices",
    "List recent customers",
    "Revenue this month",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {quickPrompts.map((prompt) => (
        <Button
          key={prompt}
          variant="secondary"
          size="sm"
          className="text-xs"
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}

