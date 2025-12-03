import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  Quote,
  QuoteTemplate,
  LineItem,
  EditorDoc,
} from "@/types/quote";
import { EditorContent } from "./components/editor-content";
import { LineItems } from "./components/line-items";
import { Logo } from "./components/logo";
import { Meta } from "./components/meta";
import { Summary } from "./components/summary";
import { cn } from "@/lib/utils";

type Props = {
  data: Quote;
  width: number;
  height: number;
  disableScroll?: boolean;
};

export function HtmlTemplate({
  data,
  width,
  height,
  disableScroll = false,
}: Props) {
  if (!data) {
    return null;
  }

  const {
    quoteNumber,
    issueDate,
    validUntil,
    template,
    lineItems,
    customerDetails,
    fromDetails,
    paymentDetails,
    noteDetails,
    currency,
    customerName,
    topBlock,
    bottomBlock,
  } = data;

  const contentStyles = {
    width: "100%",
    maxWidth: width,
    minHeight: height,
  };

  const content = (
    <div
      className="p-4 sm:p-6 md:p-8 h-full flex flex-col"
      style={{ minHeight: height - 5 }}
    >
      <div className="flex justify-between">
        <Meta
          template={template}
          quoteNumber={quoteNumber || null}
          issueDate={issueDate}
          validUntil={validUntil}
        />

        {template.logoUrl && (
          <Logo logo={template.logoUrl} customerName={customerName || ""} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6 mb-4">
        <div>
          <p className="text-[11px] text-[#878787] mb-2 block">
            {template.fromLabel}
          </p>
          <EditorContent content={fromDetails} />
        </div>
        <div className="mt-4 md:mt-0">
          <p className="text-[11px] text-[#878787] mb-2 block">
            {template.customerLabel}
          </p>
          <EditorContent content={customerDetails} />
        </div>
      </div>

      <EditorContent content={topBlock} />

      <LineItems
        lineItems={lineItems}
        currency={currency || "EUR"}
        descriptionLabel={template.descriptionLabel}
        quantityLabel={template.quantityLabel}
        priceLabel={template.priceLabel}
        totalLabel={template.totalLabel}
        includeDecimals={template.includeDecimals}
        locale={template.locale}
        includeUnits={template.includeUnits}
        includeDiscount={template.includeDiscount}
        includeVat={template.includeVat}
      />

      <div className="mt-10 md:mt-12 flex justify-end mb-6 md:mb-8">
        <Summary
          includeVat={template.includeVat}
          includeTax={template.includeTax}
          taxRate={template.taxRate}
          vatRate={template.vatRate}
          currency={currency || "EUR"}
          vatLabel={template.vatLabel}
          taxLabel={template.taxLabel}
          totalLabel={template.totalSummaryLabel}
          lineItems={lineItems}
          includeDiscount={template.includeDiscount}
          discountLabel={template.discountLabel}
          locale={template.locale}
          includeDecimals={template.includeDecimals}
          subtotalLabel={template.subtotalLabel}
        />
      </div>

      <div className="flex flex-col space-y-6 md:space-y-8 mt-auto">
        <div className="flex flex-col gap-4 md:gap-6">
          {noteDetails && (
            <div>
              <p className="text-[11px] text-[#878787] mb-2 block">
                {template.noteLabel}
              </p>
              <EditorContent content={noteDetails} />
            </div>
          )}
          <div>
            <p className="text-[11px] text-[#878787] mb-2 block">
              {template.paymentLabel}
            </p>
            <EditorContent content={paymentDetails} />
          </div>
        </div>

        <EditorContent content={bottomBlock} />
      </div>
    </div>
  );

  if (disableScroll) {
    return (
      <div
        className="bg-background border border-border w-full md:w-auto"
        style={contentStyles}
      >
        {content}
      </div>
    );
  }

  return (
    <ScrollArea
      className="bg-background border border-border w-full md:w-auto h-full [&>div]:h-full"
      style={{
        width: "100%",
        maxWidth: width,
        height,
      }}
    >
      {content}
    </ScrollArea>
  );
}
