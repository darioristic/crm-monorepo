import type { LineItem } from "@/types/quote";

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

  const formatCurrency = (amount: number) => {
    if (!currency) return "";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="w-[320px] flex flex-col">
      {/* Amount before discount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">
          Amount before discount:
        </span>
        <span className="text-right text-[11px] text-[#878787]">
          {formatCurrency(grossTotal)}
        </span>
      </div>

      {/* Discount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">
          {discountLabel}:
        </span>
        <span className="text-right text-[11px] text-[#878787]">
          -{formatCurrency(discountAmount)}
        </span>
      </div>

      {/* Subtotal */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">
          {subtotalLabel}:
        </span>
        <span className="text-right text-[11px] text-[#878787]">
          {formatCurrency(subTotal)}
        </span>
      </div>

      {/* VAT Amount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">
          VAT Amount ({vatRate}%):
        </span>
        <span className="text-right text-[11px] text-[#878787]">
          {formatCurrency(totalVAT)}
        </span>
      </div>

      {/* Total */}
      <div className="flex justify-between items-center py-4 mt-2 border-t border-border">
        <span className="text-[11px] text-[#878787]">
          {totalLabel}:
        </span>
        <span className="text-right text-[21px]">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
