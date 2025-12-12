"use client";

import { formatAmount } from "@/lib/utils";

type Props = {
  amount: number;
  currency: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  locale?: string;
};

export function FormatAmount({
  amount,
  currency,
  maximumFractionDigits,
  minimumFractionDigits,
  locale,
}: Props) {
  return formatAmount({
    locale: locale || "sr-RS",
    amount: amount,
    currency,
    maximumFractionDigits,
    minimumFractionDigits,
  });
}
