"use client";

import type { Invoice as InvoiceData } from "@crm/types";
import { formatCurrency } from "@/lib/utils";

interface InvoicePreviewProps {
  invoice: InvoiceData;
  template?: {
    logoUrl?: string | null;
    title?: string;
    fromLabel?: string;
    customerLabel?: string;
    invoiceNoLabel?: string;
    issueDateLabel?: string;
    dueDateLabel?: string;
    descriptionLabel?: string;
    priceLabel?: string;
    quantityLabel?: string;
    totalLabel?: string;
    subtotalLabel?: string;
    taxLabel?: string;
    paymentLabel?: string;
    noteLabel?: string;
    currency?: string;
    dateFormat?: string;
    includeDiscount?: boolean;
  };
  className?: string;
}

function formatDate(dateString: string, format: string = "dd/MM/yyyy"): string {
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

export function InvoicePreview({ invoice, template = {}, className }: InvoicePreviewProps) {
  const config = {
    logoUrl: template.logoUrl || invoice.logoUrl || null,
    title: template.title || "Invoice",
    fromLabel: template.fromLabel || "From",
    customerLabel: template.customerLabel || "Bill To",
    invoiceNoLabel: template.invoiceNoLabel || "Invoice No",
    issueDateLabel: template.issueDateLabel || "Issue Date",
    dueDateLabel: template.dueDateLabel || "Due Date",
    descriptionLabel: template.descriptionLabel || "Description",
    priceLabel: template.priceLabel || "Price",
    quantityLabel: template.quantityLabel || "Qty",
    totalLabel: template.totalLabel || "Total",
    subtotalLabel: template.subtotalLabel || "Subtotal",
    taxLabel: template.taxLabel || "Tax",
    paymentLabel: template.paymentLabel || "Payment Details",
    noteLabel: template.noteLabel || "Notes",
    currency: template.currency || "EUR",
    dateFormat: template.dateFormat || "dd/MM/yyyy",
    includeDiscount: template.includeDiscount ?? false,
  };

  const balance = Number(invoice.total) - Number(invoice.paidAmount);
  const from =
    invoice.fromDetails && typeof invoice.fromDetails === "object"
      ? (invoice.fromDetails as any)
      : null;
  const to =
    invoice.customerDetails && typeof invoice.customerDetails === "object"
      ? (invoice.customerDetails as any)
      : null;

  return (
    <div
      className={`bg-white text-black font-['Inter',sans-serif] ${className || ""}`}
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
              <span className="font-medium">{config.invoiceNoLabel}:</span>
              <span>{invoice.invoiceNumber}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium">{config.issueDateLabel}:</span>
              <span>{formatDate(invoice.issueDate, config.dateFormat)}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium">{config.dueDateLabel}:</span>
              <span>{formatDate(invoice.dueDate, config.dateFormat)}</span>
            </div>
          </div>
        </div>

        {/* Logo */}
        {config.logoUrl && (
          <div className="max-w-[200px]">
            <img src={config.logoUrl} alt="Company Logo" className="h-16 object-contain" />
          </div>
        )}
      </div>

      {/* Company and Customer */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{config.fromLabel}</p>
          <div className="text-sm leading-relaxed">
            <p className="font-medium">{(from?.name as string) || "Your Company"}</p>
            {from && (
              <div className="mt-1 space-y-1 text-gray-700">
                {from?.address && <p>{String(from.address)}</p>}
                {(from?.city || from?.zip || from?.state) && (
                  <p>
                    {from?.zip ? `${String(from.zip)} ` : ""}
                    {from?.city ? String(from.city) : ""}
                    {from?.state ? `, ${String(from.state)}` : ""}
                  </p>
                )}
                {from?.country && <p>{String(from.country)}</p>}
                {from?.email && <p>{String(from.email)}</p>}
                {from?.phone && <p>{String(from.phone)}</p>}
                {from?.vatNumber && <p>VAT: {String(from.vatNumber)}</p>}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
            {config.customerLabel}
          </p>
          <div className="text-sm leading-relaxed">
            <p className="font-medium">{(to?.name as string) || "Customer"}</p>
            {to && (
              <div className="mt-1 space-y-1 text-gray-700">
                {to?.address && <p>{String(to.address)}</p>}
                {(to?.city || to?.zip || to?.state) && (
                  <p>
                    {to?.zip ? `${String(to.zip)} ` : ""}
                    {to?.city ? String(to.city) : ""}
                    {to?.state ? `, ${String(to.state)}` : ""}
                  </p>
                )}
                {to?.country && <p>{String(to.country)}</p>}
                {to?.email && <p>{String(to.email)}</p>}
                {to?.phone && <p>{String(to.phone)}</p>}
                {to?.vatNumber && <p>VAT: {String(to.vatNumber)}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

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
        {invoice.items?.map((item, index) => (
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
              {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
            </div>
            <div className="text-right">{Number(item.quantity)}</div>
            <div className="text-right">
              {formatCurrency(Number(item.unitPrice), config.currency)}
            </div>
            {config.includeDiscount && (
              <div className="text-right">
                {Number(item.discount) > 0 ? `${Number(item.discount)}%` : "-"}
              </div>
            )}
            <div className="text-right font-medium">
              {formatCurrency(Number(item.total), config.currency)}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-72 space-y-2">
          {/* Amount before discount (if discount exists) */}
          {Number(invoice.discount) > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount before discount:</span>
                <span>
                  {formatCurrency(
                    Number(invoice.subtotal) + Number(invoice.discount),
                    config.currency
                  )}
                </span>
              </div>

              {/* Discount */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount:</span>
                <span className="text-red-600">
                  -{formatCurrency(Number(invoice.discount), config.currency)}
                </span>
              </div>
            </>
          )}

          {/* Subtotal (after discount) */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{config.subtotalLabel}:</span>
            <span>{formatCurrency(Number(invoice.subtotal), config.currency)}</span>
          </div>

          {/* VAT */}
          {Number(invoice.taxRate) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VAT Amount ({Number(invoice.taxRate)}%):</span>
              <span>{formatCurrency(Number(invoice.tax), config.currency)}</span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between pt-3 border-t-2 border-gray-300">
            <span className="font-semibold">{config.totalLabel}:</span>
            <span className="text-xl font-bold">
              {formatCurrency(Number(invoice.total), config.currency)}
            </span>
          </div>

          {/* Paid */}
          {Number(invoice.paidAmount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Paid</span>
              <span>{formatCurrency(Number(invoice.paidAmount), config.currency)}</span>
            </div>
          )}

          {/* Balance */}
          {Number(invoice.paidAmount) > 0 && balance > 0 && (
            <div className="flex justify-between font-semibold text-red-600">
              <span>Balance Due</span>
              <span>{formatCurrency(balance, config.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes and Terms */}
      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
        {/* Terms */}
        {invoice.terms && (
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
              {config.paymentLabel}
            </p>
            <p className="text-sm whitespace-pre-wrap">{invoice.terms}</p>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{config.noteLabel}</p>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Status Badge */}
      {invoice.status === "paid" && (
        <div className="absolute top-1/3 right-1/4 transform rotate-[-30deg] opacity-20">
          <div className="border-4 border-green-500 text-green-500 font-bold text-4xl px-8 py-4 rounded">
            PAID
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicePreview;
