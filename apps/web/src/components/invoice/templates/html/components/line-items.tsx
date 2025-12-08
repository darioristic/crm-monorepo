import type { LineItem } from "@/types/invoice";
import { Description } from "./description";

type Props = {
  lineItems: LineItem[];
  currency: string | null;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  includeDecimals?: boolean;
  locale: string;
  includeUnits?: boolean;
  includeDiscount?: boolean;
  includeVat?: boolean;
};

function formatAmount({
  currency,
  amount,
  maximumFractionDigits,
  locale,
}: {
  currency: string;
  amount: number;
  maximumFractionDigits: number;
  locale: string;
}): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

function calculateLineItemTotal({
  price = 0,
  quantity = 0,
  discount = 0,
}: {
  price?: number;
  quantity?: number;
  discount?: number;
}): number {
  const baseAmount = (price ?? 0) * (quantity ?? 0);
  const discountAmount = baseAmount * ((discount ?? 0) / 100);
  return baseAmount - discountAmount;
}

export function LineItems({
  lineItems,
  currency,
  descriptionLabel,
  quantityLabel,
  priceLabel,
  totalLabel,
  includeDecimals = false,
  includeUnits = false,
  includeDiscount = true,
  includeVat = true,
  locale,
}: Props) {
  const maximumFractionDigits = includeDecimals ? 2 : 0;

  // Dynamic grid columns based on settings
  const getGridStyle = () => {
    let cols = "1.5fr 10%"; // Description, Qty
    if (includeUnits) cols += " 10%"; // Unit
    cols += " 12%"; // Price
    if (includeDiscount) cols += " 10%"; // Disc %
    if (includeVat) cols += " 10%"; // VAT %
    cols += " 15%"; // Total
    return { gridTemplateColumns: cols };
  };

  return (
    <div className="mt-5">
      <div
        className="grid gap-2 items-end relative group mb-2 w-full pb-1 border-b border-border"
        style={getGridStyle()}
      >
        <div className="text-[11px] text-[#878787]">{descriptionLabel}</div>
        <div className="text-[11px] text-[#878787] text-center">{quantityLabel || "Qty"}</div>
        {includeUnits && <div className="text-[11px] text-[#878787] text-center">Unit</div>}
        <div className="text-[11px] text-[#878787] text-center">{priceLabel}</div>
        {includeDiscount && <div className="text-[11px] text-[#878787] text-center">Disc %</div>}
        {includeVat && <div className="text-[11px] text-[#878787] text-center">VAT %</div>}
        <div className="text-[11px] text-[#878787] text-right">{totalLabel}</div>
      </div>

      {lineItems.map((item, index) => (
        <div
          key={`line-item-${index.toString()}`}
          className="grid gap-2 items-start relative group mb-1 w-full py-1"
          style={getGridStyle()}
        >
          <div className="self-start">
            <Description content={item.name} />
          </div>
          <div className="text-[11px] self-start text-center">{item.quantity ?? 0}</div>
          {includeUnits && (
            <div className="text-[11px] self-start text-center">{item.unit || ""}</div>
          )}
          <div className="text-[11px] self-start text-center">
            {currency &&
              formatAmount({
                currency,
                amount: item.price ?? 0,
                maximumFractionDigits,
                locale,
              })}
          </div>
          {includeDiscount && (
            <div className="text-[11px] self-start text-center">{item.discount ?? 0}%</div>
          )}
          {includeVat && (
            <div className="text-[11px] self-start text-center">{item.vat ?? 20}%</div>
          )}
          <div className="text-[11px] text-right self-start">
            {currency &&
              formatAmount({
                maximumFractionDigits,
                currency,
                amount: calculateLineItemTotal({
                  price: item.price,
                  quantity: item.quantity,
                  discount: item.discount,
                }),
                locale,
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
