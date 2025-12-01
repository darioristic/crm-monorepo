import { format as formatDate } from "date-fns";

/**
 * Format amount as currency
 */
export function formatAmount({
  amount,
  currency,
  locale = "sr-RS",
  maximumFractionDigits = 2,
}: {
  amount: number;
  currency: string;
  locale?: string;
  maximumFractionDigits?: number;
}): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits,
    }).format(amount);
}

/**
 * Format amount for PDF (handles negative values properly)
 * React-pdf sometimes strips minus signs from formatted currency values
 */
export function formatCurrencyForPDF({
  amount,
  currency,
  locale = "sr-RS",
  maximumFractionDigits = 2,
}: {
  amount: number;
  currency: string;
  locale?: string;
  maximumFractionDigits?: number;
}): string {
  if (!currency) return "";

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  const formatted = formatAmount({
    amount: absoluteAmount,
    currency,
    locale,
    maximumFractionDigits,
  });

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format date with given format string
 */
export function formatInvoiceDate(
  date: string | Date,
  dateFormat: string = "dd/MM/yyyy",
  timezone?: string
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatDate(dateObj, dateFormat);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format invoice number with prefix
 */
export function formatInvoiceNumber(
  number: string | number,
  prefix: string = "INV-"
): string {
  const numStr = String(number).padStart(5, "0");
  return `${prefix}${numStr}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string, locale: string = "sr-RS"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value || currency;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and spaces, handle comma as decimal separator
  const cleaned = value
    .replace(/[^\d.,\-]/g, "")
    .replace(/,/g, ".");
  return parseFloat(cleaned) || 0;
}
