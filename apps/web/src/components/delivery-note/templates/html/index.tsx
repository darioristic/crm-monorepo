import type { DeliveryNote } from "@crm/types";
import { format, parseISO } from "date-fns";
import { EditorContent } from "@/components/invoice/templates/html/components/editor-content";
import { LineItems } from "@/components/invoice/templates/html/components/line-items";
import { Logo } from "@/components/invoice/templates/html/components/logo";
import { Summary } from "@/components/invoice/templates/html/components/summary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type DeliveryNoteTemplate = {
  logoUrl?: string | null;
  title?: string;
  fromLabel?: string;
  customerLabel?: string;
  deliveryNoLabel?: string;
  shipDateLabel?: string;
  deliveryDateLabel?: string;
  shippingAddressLabel?: string;
  trackingNumberLabel?: string;
  carrierLabel?: string;
  currency?: string;
  dateFormat?: string;
  includeDiscount?: boolean;
  includeVat?: boolean;
  includeTax?: boolean;
  includeDecimals?: boolean;
  locale?: string;
};

type DeliveryNoteData = {
  deliveryNote: DeliveryNote;
  template?: DeliveryNoteTemplate;
  customerDetails?: any;
  fromDetails?: any;
  paymentDetails?: any;
  noteDetails?: any;
  topBlock?: any;
  bottomBlock?: any;
};

type Props = {
  data: DeliveryNoteData;
  width: number;
  height: number;
  disableScroll?: boolean;
};

function formatDate(dateStr: string | null | undefined, dateFormat: string = "dd.MM.yyyy"): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr);
    return format(date, dateFormat);
  } catch {
    return dateStr;
  }
}

export function HtmlTemplate({ data, width, height, disableScroll = false }: Props) {
  if (!data || !data.deliveryNote) {
    return null;
  }

  const {
    deliveryNote,
    template = {},
    customerDetails,
    fromDetails,
    paymentDetails,
    noteDetails,
    topBlock,
    bottomBlock,
  } = data;

  const config: DeliveryNoteTemplate = {
    logoUrl: template.logoUrl || null,
    title: template.title || "Delivery Note",
    fromLabel: template.fromLabel || "From",
    customerLabel: template.customerLabel || "Deliver To",
    deliveryNoLabel: template.deliveryNoLabel || "Delivery Note No",
    shipDateLabel: template.shipDateLabel || "Ship Date",
    deliveryDateLabel: template.deliveryDateLabel || "Expected Delivery Date",
    shippingAddressLabel: template.shippingAddressLabel || "Shipping Address",
    trackingNumberLabel: template.trackingNumberLabel || "Tracking Number",
    carrierLabel: template.carrierLabel || "Carrier",
    currency: template.currency || "EUR",
    dateFormat: template.dateFormat || "dd.MM.yyyy",
    includeDiscount: template.includeDiscount ?? true,
    includeVat: template.includeVat ?? false,
    includeTax: template.includeTax ?? true,
    includeDecimals: template.includeDecimals ?? true,
    locale: template.locale || "sr-RS",
  };

  // Transform delivery note items to line items format
  const lineItems =
    deliveryNote.items?.map((item) => ({
      name: item.productName,
      description: item.description || "",
      quantity: item.quantity,
      price: item.unitPrice || 0,
      unit: item.unit || "pcs",
      discount: item.discount || 0,
      vat: 0,
    })) || [];

  const contentStyles = {
    width: "100%",
    maxWidth: width,
    minHeight: height,
  };

  const content = (
    <div className="p-4 sm:p-6 md:p-8 h-full flex flex-col" style={{ minHeight: height - 5 }}>
      <div className="flex justify-between">
        <div className="mb-2">
          <h2 className="text-[21px] font-medium mb-1 w-fit min-w-[100px]">{config.title}</h2>
          <div className="flex flex-col gap-0.5">
            <div className="flex space-x-1 items-center">
              <div className="flex items-center flex-shrink-0 space-x-1">
                <span className="truncate text-[11px] text-[#878787]">
                  {config.deliveryNoLabel ? `${config.deliveryNoLabel}:` : ""}
                </span>
                <span className="text-[11px] flex-shrink-0">{deliveryNote.deliveryNumber}</span>
              </div>
            </div>
            {deliveryNote.shipDate && (
              <div className="flex space-x-1 items-center">
                <div className="flex items-center flex-shrink-0 space-x-1">
                  <span className="truncate text-[11px] text-[#878787]">
                    {config.shipDateLabel ? `${config.shipDateLabel}:` : ""}
                  </span>
                  <span className="text-[11px] flex-shrink-0">
                    {formatDate(deliveryNote.shipDate, config.dateFormat)}
                  </span>
                </div>
              </div>
            )}
            {deliveryNote.deliveryDate && (
              <div className="flex space-x-1 items-center">
                <div className="flex items-center flex-shrink-0 space-x-1">
                  <span className="truncate text-[11px] text-[#878787]">
                    {config.deliveryDateLabel ? `${config.deliveryDateLabel}:` : ""}
                  </span>
                  <span className="text-[11px] flex-shrink-0">
                    {formatDate(deliveryNote.deliveryDate, config.dateFormat)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {config.logoUrl && (
          <Logo logo={config.logoUrl} customerName={deliveryNote.companyId || ""} />
        )}
      </div>

      {/* Header with 3 columns: From | Customer | Shipping Address */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6 mb-4">
        <div>
          <p className="text-[11px] text-[#878787] mb-2 block">{config.fromLabel}</p>
          <EditorContent content={fromDetails} />
        </div>
        <div className="mt-4 md:mt-0">
          <p className="text-[11px] text-[#878787] mb-2 block">{config.customerLabel}</p>
          <EditorContent content={customerDetails} />
        </div>
        <div className="mt-4 md:mt-0">
          <p className="text-[11px] text-[#878787] mb-2 block">{config.shippingAddressLabel}</p>
          {deliveryNote.shippingAddress ? (
            <p className="text-[11px] whitespace-pre-line leading-relaxed">
              {deliveryNote.shippingAddress}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">-</p>
          )}
        </div>
      </div>

      {/* Shipping Tracking Information */}
      {(deliveryNote.trackingNumber || deliveryNote.carrier) && (
        <div className="mb-4 p-3 bg-muted/30 rounded">
          <div className="flex flex-wrap gap-4">
            {deliveryNote.trackingNumber && (
              <div>
                <span className="text-[11px] text-[#878787]">{config.trackingNumberLabel}: </span>
                <span className="text-sm font-medium">{deliveryNote.trackingNumber}</span>
              </div>
            )}
            {deliveryNote.carrier && (
              <div>
                <span className="text-[11px] text-[#878787]">{config.carrierLabel}: </span>
                <span className="text-sm font-medium">{deliveryNote.carrier}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <EditorContent content={topBlock} />

      <LineItems
        lineItems={lineItems}
        currency={config.currency || "EUR"}
        descriptionLabel="Description"
        quantityLabel="Qty"
        priceLabel="Price"
        totalLabel="Total"
        includeDecimals={config.includeDecimals ?? true}
        locale={config.locale || "sr-RS"}
        includeUnits={true}
        includeDiscount={config.includeDiscount ?? true}
        includeVat={config.includeVat ?? false}
      />

      {deliveryNote.subtotal > 0 && (
        <div className="mt-10 md:mt-12 flex justify-end mb-6 md:mb-8">
          <Summary
            includeVat={config.includeVat ?? false}
            includeTax={config.includeTax ?? true}
            taxRate={deliveryNote.taxRate || 0}
            vatRate={0}
            currency={config.currency || "EUR"}
            vatLabel="VAT"
            taxLabel="Tax"
            totalLabel="Total"
            lineItems={lineItems}
            includeDiscount={config.includeDiscount ?? true}
            discountLabel="Discount"
            locale={config.locale || "sr-RS"}
            includeDecimals={config.includeDecimals ?? true}
            subtotalLabel="Subtotal"
          />
        </div>
      )}

      <div className="flex flex-col space-y-6 md:space-y-8 mt-auto">
        <div className="flex flex-col gap-4 md:gap-6">
          {noteDetails && (
            <div>
              <p className="text-[11px] text-[#878787] mb-2 block">Notes</p>
              <EditorContent content={noteDetails} />
            </div>
          )}
          {paymentDetails && (
            <div>
              <p className="text-[11px] text-[#878787] mb-2 block">Terms & Conditions</p>
              <EditorContent content={paymentDetails} />
            </div>
          )}
        </div>

        <EditorContent content={bottomBlock} />
      </div>
    </div>
  );

  if (disableScroll) {
    return (
      <div className="bg-background border border-border w-full md:w-auto" style={contentStyles}>
        {content}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full md:w-auto" style={contentStyles}>
      <div
        className={cn(
          "bg-background border border-border w-full md:w-auto",
          "print:border-0 print:shadow-none"
        )}
        style={contentStyles}
      >
        {content}
      </div>
    </ScrollArea>
  );
}
