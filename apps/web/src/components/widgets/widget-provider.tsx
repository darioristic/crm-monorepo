"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

export type WidgetType =
  | "runway"
  | "cash-flow"
  | "account-balances"
  | "profit-analysis"
  | "revenue-forecast"
  | "revenue-summary"
  | "growth-rate"
  | "customer-lifetime-value";

interface WidgetState {
  isCustomizing: boolean;
  primaryWidgets: WidgetType[];
  setIsCustomizing: (value: boolean) => void;
}

const defaultWidgets: WidgetType[] = [
  "runway",
  "cash-flow",
  "account-balances",
  "profit-analysis",
  "revenue-forecast",
  "revenue-summary",
  "growth-rate",
  "customer-lifetime-value",
];

const WidgetContext = createContext<WidgetState | undefined>(undefined);

export function WidgetProvider({ children }: { children: ReactNode }) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [primaryWidgets] = useState<WidgetType[]>(defaultWidgets);

  return (
    <WidgetContext.Provider
      value={{
        isCustomizing,
        primaryWidgets,
        setIsCustomizing,
      }}
    >
      {children}
    </WidgetContext.Provider>
  );
}

export const useIsCustomizing = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useIsCustomizing must be used within WidgetProvider");
  }
  return context.isCustomizing;
};

export const usePrimaryWidgets = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("usePrimaryWidgets must be used within WidgetProvider");
  }
  return context.primaryWidgets;
};

export const useWidgetActions = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidgetActions must be used within WidgetProvider");
  }
  return {
    setIsCustomizing: context.setIsCustomizing,
  };
};
