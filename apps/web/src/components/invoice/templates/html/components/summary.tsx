import type { LineItem } from "@/types/invoice";

type Props = {
  includeVat: boolean;
  includeTax: boolean;
  includeDiscount: boolean;
  discountLabel: string;
  taxRate: number;
  vatRate: number;
  locale: string;
  currency: string | null;
  vatLabel: string;
  taxLabel: string;
  totalLabel: string;
  lineItems: LineItem[];
  includeDecimals?: boolean;
  subtotalLabel: string;
};

/**
 * Calculate total with discount from line items
 * Discount is calculated automatically from item.discount percentage
 */
function calculateTotal({
  lineItems,
  taxRate = 0,
  vatRate = 0,
  includeVat = true,
  includeTax = true,
}: {
  lineItems: Array<{ price?: number; quantity?: number; discount?: number }>;
  taxRate?: number;
  vatRate?: number;
  includeVat?: boolean;
  includeTax?: boolean;
}) {
  const safeLineItems = lineItems || [];

  let grossTotal = 0;
  let totalDiscount = 0;
  let subTotal = 0;

  for (const item of safeLineItems) {
    if (!item) continue;
    const safePrice = item.price ?? 0;
    const safeQuantity = item.quantity ?? 0;
    const itemDiscountPercent = item.discount ?? 0;

    const lineTotal = safePrice * safeQuantity;
    grossTotal += lineTotal;

    const lineDiscountAmount = lineTotal * (itemDiscountPercent / 100);
    totalDiscount += lineDiscountAmount;

    subTotal += lineTotal - lineDiscountAmount;
  }

  const safeTaxRate = taxRate ?? 0;
  const safeVatRate = vatRate ?? 0;

  const totalVAT = includeVat ? (subTotal * safeVatRate) / 100 : 0;
  const tax = includeTax ? (subTotal * safeTaxRate) / 100 : 0;
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

export function Summary({
  includeVat,
  includeTax,
  includeDiscount,
  discountLabel,
  locale,
  taxRate,
  vatRate,
  currency,
  vatLabel,
  taxLabel,
  totalLabel,
  lineItems,
  includeDecimals,
  subtotalLabel,
}: Props) {
  const maximumFractionDigits = includeDecimals ? 2 : 0;

  const {
    grossTotal,
    subTotal,
    total,
    vat: totalVAT,
    tax: totalTax,
    discountAmount,
  } = calculateTotal({
    lineItems,
    taxRate,
    vatRate,
    includeVat,
    includeTax,
  });

  const hasDiscount = includeDiscount && discountAmount > 0;

  return (
    <div className="w-[320px] flex flex-col">
      {/* Amount before discount */}
      {hasDiscount && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px] text-[#878787] font-mono">
            Amount before discount:
          </span>
          <span className="text-right text-[11px] text-[#878787]">
            {currency &&
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: currency,
                maximumFractionDigits: 2,
              }).format(grossTotal)}
          </span>
        </div>
      )}

      {/* Discount (calculated from items) */}
      {hasDiscount && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px] text-[#878787] font-mono">
            {discountLabel}:
          </span>
          <span className="text-right text-[11px] text-red-500">
            {currency &&
              `-${new Intl.NumberFormat(locale, {
                style: "currency",
                currency: currency,
                maximumFractionDigits: 2,
              }).format(discountAmount)}`}
          </span>
        </div>
      )}

      {/* Subtotal */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787] font-mono">
          {subtotalLabel}:
        </span>
        <span className="text-right text-[11px] text-[#878787]">
          {currency &&
            new Intl.NumberFormat(locale, {
              style: "currency",
              currency: currency,
              maximumFractionDigits,
            }).format(subTotal)}
        </span>
      </div>

      {includeVat && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px] text-[#878787] font-mono">
            {vatLabel} ({vatRate}%)
          </span>
          <span className="text-right text-[11px] text-[#878787]">
            {currency &&
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: currency,
                maximumFractionDigits: 2,
              }).format(totalVAT)}
          </span>
        </div>
      )}

      {includeTax && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px] text-[#878787] font-mono">
            {taxLabel} ({taxRate}%)
          </span>
          <span className="text-right text-[11px] text-[#878787]">
            {currency &&
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: currency,
                maximumFractionDigits: 2,
              }).format(totalTax)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center py-4 mt-2 border-t border-border">
        <span className="text-[11px] text-[#878787] font-mono">
          {totalLabel}
        </span>
        <span className="text-right text-[21px]">
          {currency &&
            new Intl.NumberFormat(locale, {
              style: "currency",
              currency: currency,
              maximumFractionDigits:
                includeTax || includeVat ? 2 : maximumFractionDigits,
            }).format(total)}
        </span>
      </div>
    </div>
  );
}
