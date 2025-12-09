// Order Calculation Utilities - Based on Midday

import type { LineItem } from "@/types/order";

export interface CalculateTotalParams {
  lineItems: LineItem[];
  taxRate?: number;
  vatRate?: number;
  includeVat?: boolean;
  includeTax?: boolean;
}

export interface CalculateTotalResult {
  /** Sum of all line items (before any item discounts) - Amount before discount */
  grossTotal: number;
  /** Amount after all line item discounts are applied - Subtotal */
  subTotal: number;
  /** Final total including VAT and tax */
  total: number;
  /** VAT amount (calculated on subtotal after discounts) */
  vat: number;
  /** Tax amount (calculated on subtotal after discounts) */
  tax: number;
  /** Total discount amount (sum of all line item discounts) */
  discountAmount: number;
}

/**
 * Calculate total for order including VAT, tax, and discount
 *
 * Discount is AUTOMATICALLY calculated from line items (not entered manually)
 *
 * Calculation order:
 * 1. For each line item:
 *    - lineTotal = quantity * price (before discount)
 *    - lineDiscount = lineTotal * (item.discount / 100)
 *    - lineNet = lineTotal - lineDiscount (after discount)
 * 2. grossTotal = sum of all lineTotal (Amount before discount)
 * 3. discountAmount = sum of all lineDiscount (calculated from items)
 * 4. subTotal = grossTotal - discountAmount (Subtotal after discount)
 * 5. vat = subTotal * vatRate / 100 (VAT on subtotal)
 * 6. tax = subTotal * taxRate / 100 (if includeTax)
 * 7. total = subTotal + vat + tax
 */
export function calculateTotal({
  lineItems,
  taxRate = 0,
  vatRate = 0,
  includeVat = true,
  includeTax = false,
}: CalculateTotalParams): CalculateTotalResult {
  const safeLineItems = lineItems || [];
  const safeTaxRate = taxRate ?? 0;
  const safeVatRate = vatRate ?? 0;

  let grossTotal = 0;
  let totalDiscount = 0;
  let subTotal = 0;

  // Calculate totals from line items
  for (const item of safeLineItems) {
    if (!item) continue;

    const safePrice = item.price ?? 0;
    const safeQuantity = item.quantity ?? 0;
    const itemDiscountPercent = item.discount ?? 0;

    // Line total before discount
    const lineTotal = safePrice * safeQuantity;
    grossTotal += lineTotal;

    // Calculate item discount amount
    const lineDiscountAmount = lineTotal * (itemDiscountPercent / 100);
    totalDiscount += lineDiscountAmount;

    // Line net after discount
    const lineNet = lineTotal - lineDiscountAmount;
    subTotal += lineNet;
  }

  // Calculate VAT on subtotal (after all discounts)
  const totalVAT = includeVat ? (subTotal * safeVatRate) / 100 : 0;

  // Calculate tax on subtotal
  const tax = includeTax ? (subTotal * safeTaxRate) / 100 : 0;

  // Calculate final total
  const total = subTotal + totalVAT + tax;

  return {
    grossTotal,
    subTotal,
    total,
    vat: totalVAT,
    tax,
    discountAmount: totalDiscount,
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
  const safePrice = price ?? 0;
  const safeQuantity = quantity ?? 0;
  return safePrice * safeQuantity;
}

/**
 * Format order amount with currency
 */
export function formatOrderAmount({
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
  return Number.isNaN(parsed) ? 0 : parsed;
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

  return lineItems.some((item) => item.name && (item.quantity ?? 0) > 0 && (item.price ?? 0) > 0);
}
