"use client";

import type { DeliveryNote } from "@crm/types";
import { formatCurrency } from "@/lib/utils";

interface DeliveryNotePreviewProps {
  deliveryNote: DeliveryNote;
  template?: {
    logoUrl?: string | null;
    title?: string;
    fromLabel?: string;
    customerLabel?: string;
    deliveryNoLabel?: string;
    shipDateLabel?: string;
    deliveryDateLabel?: string;
    descriptionLabel?: string;
    priceLabel?: string;
    quantityLabel?: string;
    totalLabel?: string;
    subtotalLabel?: string;
    taxLabel?: string;
    shippingAddressLabel?: string;
    trackingNumberLabel?: string;
    carrierLabel?: string;
    noteLabel?: string;
    currency?: string;
    dateFormat?: string;
    includeDiscount?: boolean;
  };
  className?: string;
}

function formatDate(dateString: string | undefined, format: string = "dd/MM/yyyy"): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();

  if (format === "MM/dd/yyyy") {
    return `${month}/${day}/${year}`;
  }
  if (format === "yyyy-MM-dd") {
    return `${year}-${month}-${day}`;
  }
  return `${day}/${month}/${year}`;
}

export function DeliveryNotePreview({
  deliveryNote,
  template = {},
  className,
}: DeliveryNotePreviewProps) {
  const config = {
    logoUrl: template.logoUrl || null,
    title: template.title || "Delivery Note",
    fromLabel: template.fromLabel || "From",
    customerLabel: template.customerLabel || "Deliver To",
    deliveryNoLabel: template.deliveryNoLabel || "Delivery Note No",
    shipDateLabel: template.shipDateLabel || "Ship Date",
    deliveryDateLabel: template.deliveryDateLabel || "Expected Delivery Date",
    descriptionLabel: template.descriptionLabel || "Description",
    priceLabel: template.priceLabel || "Price",
    quantityLabel: template.quantityLabel || "Qty",
    totalLabel: template.totalLabel || "Total",
    subtotalLabel: template.subtotalLabel || "Subtotal",
    taxLabel: template.taxLabel || "Tax",
    shippingAddressLabel: template.shippingAddressLabel || "Shipping Address",
    trackingNumberLabel: template.trackingNumberLabel || "Tracking Number",
    carrierLabel: template.carrierLabel || "Carrier",
    noteLabel: template.noteLabel || "Notes",
    currency: template.currency || "EUR",
    dateFormat: template.dateFormat || "dd/MM/yyyy",
    includeDiscount: template.includeDiscount ?? false,
  };

  return (
    <div
      className={`bg-white text-black font-['Inter',sans-serif] ${
        className || ""
      }`}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "40px",
        margin: "0 auto",
        boxSizing: "border-box",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Meta */}
        <div>
          <h1 className="text-2xl font-semibold mb-2">{config.title}</h1>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="font-medium">{config.deliveryNoLabel}:</span>
              <span>{deliveryNote.deliveryNumber}</span>
            </div>
            {deliveryNote.shipDate && (
              <div className="flex gap-2">
                <span className="font-medium">{config.shipDateLabel}:</span>
                <span>{formatDate(deliveryNote.shipDate, config.dateFormat)}</span>
              </div>
            )}
            {deliveryNote.deliveryDate && (
              <div className="flex gap-2">
                <span className="font-medium">{config.deliveryDateLabel}:</span>
                <span>{formatDate(deliveryNote.deliveryDate, config.dateFormat)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Logo */}
        {config.logoUrl && (
          <div className="max-w-[200px]">
            <img
              src={config.logoUrl}
              alt="Company Logo"
              className="h-16 object-contain"
            />
          </div>
        )}
      </div>

      {/* Company and Customer */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* From */}
        <div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            {config.fromLabel}
          </p>
          <div className="text-sm leading-relaxed">
            <p className="font-medium">Your Company</p>
          </div>
        </div>

        {/* To */}
        <div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            {config.customerLabel}
          </p>
          <div className="text-sm leading-relaxed">
            {deliveryNote.customerDetails && typeof deliveryNote.customerDetails === 'object' && 'name' in deliveryNote.customerDetails ? (
              <>
                <p className="font-medium">{(deliveryNote.customerDetails as any).name}</p>
                {(deliveryNote.customerDetails as any).address && (
                  <p>{(deliveryNote.customerDetails as any).address}</p>
                )}
                {((deliveryNote.customerDetails as any).city || (deliveryNote.customerDetails as any).zip) && (
                  <p>
                    {(deliveryNote.customerDetails as any).zip && `${(deliveryNote.customerDetails as any).zip} `}
                    {(deliveryNote.customerDetails as any).city}
                  </p>
                )}
                {(deliveryNote.customerDetails as any).country && (
                  <p>{(deliveryNote.customerDetails as any).country}</p>
                )}
              </>
            ) : (
              <p className="font-medium">Customer</p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Information */}
      {(deliveryNote.shippingAddress || deliveryNote.trackingNumber || deliveryNote.carrier) && (
        <div className="mb-8 p-4 bg-gray-50 rounded">
          <h3 className="text-sm font-semibold mb-3">{config.shippingAddressLabel}</h3>
          <div className="space-y-2 text-sm">
            {deliveryNote.shippingAddress && (
              <p className="whitespace-pre-line">{deliveryNote.shippingAddress}</p>
            )}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              {deliveryNote.trackingNumber && (
                <div>
                  <span className="text-gray-500">{config.trackingNumberLabel}: </span>
                  <span className="font-medium">{deliveryNote.trackingNumber}</span>
                </div>
              )}
              {deliveryNote.carrier && (
                <div>
                  <span className="text-gray-500">{config.carrierLabel}: </span>
                  <span className="font-medium">{deliveryNote.carrier}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="mb-8">
        {/* Header */}
        <div
          className={`grid gap-4 pb-2 mb-2 border-b-2 border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide ${
            config.includeDiscount
              ? "grid-cols-[3fr_1fr_1fr_1fr_1fr]"
              : "grid-cols-[3fr_1fr_1fr_1fr]"
          }`}
        >
          <div>{config.descriptionLabel}</div>
          <div className="text-right">{config.quantityLabel}</div>
          <div className="text-right">{config.priceLabel}</div>
          {config.includeDiscount && <div className="text-right">Discount</div>}
          <div className="text-right">{config.totalLabel}</div>
        </div>

        {/* Items */}
        {deliveryNote.items?.map((item, index) => {
          const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
          const discountAmount = lineTotal * ((item.discount || 0) / 100);
          const itemTotal = lineTotal - discountAmount;

          return (
            <div
              key={item.id || index}
              className={`grid gap-4 py-3 border-b border-gray-100 text-sm ${
                config.includeDiscount
                  ? "grid-cols-[3fr_1fr_1fr_1fr_1fr]"
                  : "grid-cols-[3fr_1fr_1fr_1fr]"
              }`}
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                )}
                {item.unit && (
                  <p className="text-xs text-gray-400 mt-1">Unit: {item.unit}</p>
                )}
              </div>
              <div className="text-right">{Number(item.quantity)}</div>
              <div className="text-right">
                {formatCurrency(Number(item.unitPrice || 0), config.currency)}
              </div>
              {config.includeDiscount && (
                <div className="text-right">
                  {Number(item.discount || 0) > 0 ? `${Number(item.discount)}%` : "-"}
                </div>
              )}
              <div className="text-right font-medium">
                {formatCurrency(itemTotal, config.currency)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {deliveryNote.subtotal > 0 && (
        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-2">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{config.subtotalLabel}:</span>
              <span>
                {formatCurrency(Number(deliveryNote.subtotal), config.currency)}
              </span>
            </div>

            {/* Tax */}
            {Number(deliveryNote.taxRate) > 0 && Number(deliveryNote.tax) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {config.taxLabel} ({Number(deliveryNote.taxRate)}%):
                </span>
                <span>
                  {formatCurrency(Number(deliveryNote.tax), config.currency)}
                </span>
              </div>
            )}

            {/* Total */}
            {deliveryNote.total > 0 && (
              <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                <span className="font-semibold">{config.totalLabel}:</span>
                <span className="text-xl font-bold">
                  {formatCurrency(Number(deliveryNote.total), config.currency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes and Terms */}
      {(deliveryNote.notes || deliveryNote.terms) && (
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
          {/* Terms */}
          {deliveryNote.terms && (
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                Terms & Conditions
              </p>
              <p className="text-sm whitespace-pre-wrap">{deliveryNote.terms}</p>
            </div>
          )}

          {/* Notes */}
          {deliveryNote.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                {config.noteLabel}
              </p>
              <p className="text-sm whitespace-pre-wrap">{deliveryNote.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Status Badge */}
      {deliveryNote.status === "delivered" && (
        <div className="absolute top-1/3 right-1/4 transform rotate-[-30deg] opacity-20">
          <div className="border-4 border-green-500 text-green-500 font-bold text-4xl px-8 py-4 rounded">
            DELIVERED
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryNotePreview;

