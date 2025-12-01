// Invoice Calculation Utilities - Based on Midday

import type { LineItem } from "@/types/invoice";

export interface CalculateTotalParams {
  lineItems: LineItem[];
  taxRate?: number;
  vatRate?: number;
  discount?: number;
  includeVat?: boolean;
  includeTax?: boolean;
}

export interface CalculateTotalResult {
  subTotal: number;
  total: number;
  vat: number;
  tax: number;
}

/**
 * Calculate total for invoice including VAT, tax, and discount
 */
export function calculateTotal({
  lineItems,
  taxRate = 0,
  vatRate = 0,
  discount = 0,
  includeVat = true,
  includeTax = false,
}: CalculateTotalParams): CalculateTotalResult {
  // Handle cases where lineItems might be undefined or null
  const safeLineItems = lineItems || [];

  // Calculate Subtotal: Sum of all Base Prices for line items
  const subTotal = safeLineItems.reduce((acc, item) => {
    // Handle cases where item might be undefined or null
    if (!item) return acc;

    const safePrice = item.price ?? 0;
    const safeQuantity = item.quantity ?? 0;

    return acc + safePrice * safeQuantity;
  }, 0);

  // Handle cases where rates might be undefined
  const safeTaxRate = taxRate ?? 0;
  const safeVatRate = vatRate ?? 0;
  const safeDiscount = discount ?? 0;

  // Calculate VAT (Total): Calculate VAT on the Subtotal
  const totalVAT = includeVat ? (subTotal * safeVatRate) / 100 : 0;

  // Calculate Total: Subtotal + VAT - Discount
  const total = subTotal + (includeVat ? totalVAT : 0) - safeDiscount;

  // Calculate tax (if included) - tax should be calculated on subtotal, not total
  const tax = includeTax ? (subTotal * safeTaxRate) / 100 : 0;

  return {
    subTotal,
    total: total + tax,
    vat: totalVAT,
    tax,
  };
}

/**
 * Calculate total for a single line item
 */
export function calculateLineItemTotal({
  price = 0,
  quantity = 0,
}: {
  price?: number;
  quantity?: number;
}): number {
  // Handle cases where undefined is explicitly passed
  const safePrice = price ?? 0;
  const safeQuantity = quantity ?? 0;

  // Calculate and return total price
  return safePrice * safeQuantity;
}

/**
 * Format amount with currency
 */
export function formatInvoiceAmount({
  amount,
  currency = "EUR",
  locale = "sr-RS",
  maximumFractionDigits = 2,
}: {
  amount: number;
  currency?: string;
  locale?: string;
  maximumFractionDigits?: number;
}): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(amount);
}

/**
 * Format number without currency symbol
 */
export function formatNumber({
  value,
  locale = "sr-RS",
  maximumFractionDigits = 2,
}: {
  value: number;
  locale?: string;
  maximumFractionDigits?: number;
}): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value);
}

/**
 * Parse currency string to number
 */
export function parseCurrencyString(value: string): number {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string, locale = "sr-RS"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  });
  
  const parts = formatter.formatToParts(0);
  const symbolPart = parts.find((part) => part.type === "currency");
  return symbolPart?.value || currency;
}

/**
 * Validate line items have required fields
 */
export function validateLineItems(lineItems: LineItem[]): boolean {
  if (!lineItems || lineItems.length === 0) return false;
  
  return lineItems.some(
    (item) => item.name && (item.quantity ?? 0) > 0 && (item.price ?? 0) > 0
  );
}

