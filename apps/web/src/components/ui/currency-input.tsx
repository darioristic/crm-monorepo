"use client";

import { forwardRef } from "react";
import { NumericFormat, type NumericFormatProps } from "react-number-format";
import { cn } from "@/lib/utils";
import { Input } from "./input";

// Common currency symbols
export const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "Fr",
  CAD: "C$",
  AUD: "A$",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  RUB: "₽",
  KRW: "₩",
  HRK: "kn",
  BAM: "KM",
  RSD: "din",
};

interface CurrencyInputProps extends Omit<NumericFormatProps, "customInput"> {
  currency?: string;
  showSymbol?: boolean;
  symbolPosition?: "left" | "right";
  className?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      currency = "USD",
      showSymbol = true,
      symbolPosition = "left",
      thousandSeparator = true,
      decimalScale = 2,
      fixedDecimalScale = true,
      allowNegative = false,
      className,
      ...props
    },
    ref
  ) => {
    const symbol = currencySymbols[currency] || currency;

    return (
      <div className={cn("relative", className)}>
        {showSymbol && symbolPosition === "left" && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {symbol}
          </span>
        )}
        <NumericFormat
          getInputRef={ref}
          thousandSeparator={thousandSeparator}
          decimalScale={decimalScale}
          fixedDecimalScale={fixedDecimalScale}
          allowNegative={allowNegative}
          customInput={Input}
          className={cn(
            showSymbol && symbolPosition === "left" && "pl-8",
            showSymbol && symbolPosition === "right" && "pr-8",
            "text-right tabular-nums"
          )}
          {...props}
        />
        {showSymbol && symbolPosition === "right" && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {symbol}
          </span>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

// Simple version without symbol (backwards compatible)
export function SimpleCurrencyInput({ thousandSeparator = true, ...props }: NumericFormatProps) {
  return <NumericFormat thousandSeparator={thousandSeparator} customInput={Input} {...props} />;
}
