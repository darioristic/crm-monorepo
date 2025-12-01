import type { Invoice, InvoiceTemplate } from "../../types";
import { defaultTemplate } from "../../types";
import { formatAmount, formatInvoiceDate } from "../../utils/format";

interface HtmlTemplateProps {
  invoice: Invoice;
  customTemplate?: Partial<InvoiceTemplate>;
  className?: string;
}

export function HtmlTemplate({ invoice, customTemplate, className }: HtmlTemplateProps) {
  // Merge default template with custom settings
  const template: InvoiceTemplate = {
    ...defaultTemplate,
    ...invoice.template,
    ...customTemplate,
  };

  const maximumFractionDigits = template.includeDecimals ? 2 : 0;
  const balance = invoice.total - invoice.paidAmount;

  // Calculate VAT amount
  const vatAmount = template.includeVat ? (invoice.subtotal * template.vatRate) / 100 : 0;

  return (
    <div className={`bg-white text-black p-8 ${className || ""}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        {/* Meta */}
        <div>
          <h1 className="text-2xl font-semibold mb-2">{template.title}</h1>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="font-medium">{template.invoiceNoLabel}:</span>
              <span>{invoice.invoiceNumber}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium">{template.issueDateLabel}:</span>
              <span>{formatInvoiceDate(invoice.issueDate, template.dateFormat)}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium">{template.dueDateLabel}:</span>
              <span>{formatInvoiceDate(invoice.dueDate, template.dateFormat)}</span>
            </div>
          </div>
        </div>

        {/* Logo */}
        {template.logoUrl && (
          <div className="max-w-[200px]">
            <img
              src={template.logoUrl}
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
          <p className="text-xs text-gray-500 mb-2">{template.fromLabel}</p>
          <div className="text-sm leading-relaxed">
            <p className="font-medium">{invoice.company.name}</p>
            {invoice.company.address && <p>{invoice.company.address}</p>}
            {(invoice.company.city || invoice.company.country) && (
              <p>{[invoice.company.city, invoice.company.country].filter(Boolean).join(", ")}</p>
            )}
            {invoice.company.vatNumber && <p>VAT: {invoice.company.vatNumber}</p>}
            {invoice.company.phone && <p>Tel: {invoice.company.phone}</p>}
            {invoice.company.email && <p>{invoice.company.email}</p>}
          </div>
        </div>

        {/* To */}
        <div>
          <p className="text-xs text-gray-500 mb-2">{template.customerLabel}</p>
          <div className="text-sm leading-relaxed">
            <p className="font-medium">{invoice.customer.name}</p>
            {invoice.customer.address && <p>{invoice.customer.address}</p>}
            {(invoice.customer.city || invoice.customer.country) && (
              <p>{[invoice.customer.city, invoice.customer.country].filter(Boolean).join(", ")}</p>
            )}
            {invoice.customer.vatNumber && <p>VAT: {invoice.customer.vatNumber}</p>}
            {invoice.customer.phone && <p>Tel: {invoice.customer.phone}</p>}
            {invoice.customer.email && <p>{invoice.customer.email}</p>}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-8">
        {/* Header */}
        <div
          className={`grid gap-4 pb-2 mb-2 border-b border-gray-300 text-xs font-medium text-gray-500 ${
            template.includeDiscount ? "grid-cols-[3fr_1fr_1fr_1fr_1fr]" : "grid-cols-[3fr_1fr_1fr_1fr]"
          }`}
        >
          <div>{template.descriptionLabel}</div>
          <div>{template.quantityLabel}</div>
          <div>{template.priceLabel}</div>
          {template.includeDiscount && <div>{template.discountLabel}</div>}
          <div className="text-right">{template.totalLabel}</div>
        </div>

        {/* Items */}
        {invoice.items.map((item, index) => (
          <div
            key={item.id || index}
            className={`grid gap-4 py-2 text-sm ${
              template.includeDiscount ? "grid-cols-[3fr_1fr_1fr_1fr_1fr]" : "grid-cols-[3fr_1fr_1fr_1fr]"
            }`}
          >
            <div>
              <p>{item.productName}</p>
                  {item.description && (
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  )}
            </div>
            <div>{item.quantity}</div>
            <div>
              {formatAmount({
                amount: item.unitPrice,
                currency: template.currency,
                locale: template.locale,
                maximumFractionDigits,
              })}
            </div>
            {template.includeDiscount && (
              <div>{item.discount > 0 ? `${item.discount}%` : "-"}</div>
            )}
            <div className="text-right font-medium">
                  {formatAmount({
                amount: item.total,
                currency: template.currency,
                    locale: template.locale,
                maximumFractionDigits,
                  })}
            </div>
          </div>
            ))}
      </div>

      {/* Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-72 space-y-2">
          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{template.subtotalLabel}</span>
            <span>
              {formatAmount({
                amount: invoice.subtotal,
                currency: template.currency,
                locale: template.locale,
                maximumFractionDigits,
              })}
            </span>
          </div>

          {/* VAT */}
          {template.includeVat && template.vatRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {template.vatLabel} ({template.vatRate}%)
              </span>
              <span>
                {formatAmount({
                  amount: vatAmount,
                  currency: template.currency,
                  locale: template.locale,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {/* Tax */}
          {template.includeTax && invoice.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {template.taxLabel} ({invoice.taxRate}%)
              </span>
              <span>
                {formatAmount({
                  amount: invoice.tax,
                  currency: template.currency,
                  locale: template.locale,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between pt-2 border-t border-gray-300">
            <span className="font-medium">{template.totalSummaryLabel}</span>
            <span className="text-xl font-bold">
              {formatAmount({
                amount: invoice.total,
                currency: template.currency,
                locale: template.locale,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Paid */}
          {invoice.paidAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Paid</span>
              <span>
                {formatAmount({
                  amount: invoice.paidAmount,
                  currency: template.currency,
                  locale: template.locale,
                  maximumFractionDigits: 2,
                })}
                  </span>
                </div>
              )}

          {/* Balance */}
          {invoice.paidAmount > 0 && balance > 0 && (
            <div className="flex justify-between font-medium">
              <span>Balance Due</span>
              <span className="text-red-600">
                {formatAmount({
                  amount: balance,
                  currency: template.currency,
                  locale: template.locale,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Details and Notes */}
      <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-200">
        {/* Payment Details */}
        {(template.paymentDetails || invoice.terms) && (
          <div>
            <p className="text-xs text-gray-500 mb-2">{template.paymentLabel}</p>
            <p className="text-sm whitespace-pre-wrap">
              {template.paymentDetails || invoice.terms}
            </p>
          </div>
        )}

        {/* Notes */}
        {(template.noteDetails || invoice.notes) && (
          <div>
            <p className="text-xs text-gray-500 mb-2">{template.noteLabel}</p>
            <p className="text-sm whitespace-pre-wrap">
              {template.noteDetails || invoice.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
