import type { LineItem } from "../types";

/**
 * Calculate the total for a single line item
 */
export function calculateLineItemTotal({
  quantity = 0,
  unitPrice = 0,
  discount = 0,
}: {
  quantity?: number;
  unitPrice?: number;
  discount?: number;
}): number {
  const safeQuantity = quantity ?? 0;
  const safePrice = unitPrice ?? 0;
  const safeDiscount = discount ?? 0;

  const lineTotal = safeQuantity * safePrice;
  const discountAmount = lineTotal * (safeDiscount / 100);

  return lineTotal - discountAmount;
}

/**
 * Calculate invoice totals from line items
 */
export function calculateTotal({
  lineItems,
  taxRate = 0,
  vatRate = 0,
  discount = 0,
  includeVat = true,
  includeTax = false,
}: {
  lineItems: Array<{ quantity?: number; unitPrice?: number; discount?: number }>;
  taxRate?: number;
  vatRate?: number;
  discount?: number;
  includeVat?: boolean;
  includeTax?: boolean;
}): {
  subTotal: number;
  total: number;
  vat: number;
  tax: number;
} {
  // Handle cases where lineItems might be undefined or null
  const safeLineItems = lineItems || [];

  // Calculate Subtotal: Sum of all line item totals
  const subTotal = safeLineItems.reduce((acc, item) => {
    if (!item) return acc;
    return acc + calculateLineItemTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    });
  }, 0);

  // Handle cases where rates might be undefined
  const safeTaxRate = taxRate ?? 0;
  const safeVatRate = vatRate ?? 0;
  const safeDiscount = discount ?? 0;

  // Calculate VAT on the Subtotal
  const vat = includeVat ? (subTotal * safeVatRate) / 100 : 0;

  // Calculate tax on subtotal
  const tax = includeTax ? (subTotal * safeTaxRate) / 100 : 0;

  // Calculate Total: Subtotal + VAT + Tax - Discount
  const total = subTotal + vat + tax - safeDiscount;

  return {
    subTotal,
    total,
    vat,
    tax,
  };
}

/**
 * Recalculate line items with totals
 */
export function recalculateLineItems(items: LineItem[]): LineItem[] {
  return items.map((item) => ({
    ...item,
    total: calculateLineItemTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    }),
  }));
}

/**
 * Calculate balance due
 */
export function calculateBalance(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

/**
 * Check if invoice is fully paid
 */
export function isFullyPaid(total: number, paidAmount: number): boolean {
  return paidAmount >= total;
}

/**
 * Calculate payment percentage
 */
export function calculatePaymentPercentage(total: number, paidAmount: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (paidAmount / total) * 100);
}
