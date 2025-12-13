import type { EditorDoc } from "@crm/schemas";
import { Document, Font, Image, Page, Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import QRCodeUtil from "qrcode";
import type { Order } from "@/types/order";
import { extractTextFromEditorDoc } from "@/types/order";
import { calculateTotal, formatOrderAmount } from "@/utils/order-calculate";

// Register Inter font - matching Midday's approach with .ttf files
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf",
      fontWeight: 500,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf",
      fontWeight: 700,
    },
    // Italic fonts
    {
      src: "https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc69thjQ.ttf",
      fontWeight: 500,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTcB9xhjQ.ttf",
      fontWeight: 600,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTcPtxhjQ.ttf",
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});

type PdfTemplateProps = {
  order: Order;
};

/**
 * Calculate line item total with discount
 */
function calculateLineItemTotalWithDiscount({
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

/**
 * Render EditorDoc content for PDF
 */
function renderEditorContent(content: EditorDoc | string | null, style?: Record<string, unknown>) {
  let parsed: EditorDoc | string | null = content;
  if (typeof content === "string") {
    try {
      const obj = JSON.parse(content);
      if (obj && typeof obj === "object" && "type" in obj) {
        parsed = obj as EditorDoc;
      }
    } catch {
      parsed = content;
    }
  }
  const extracted = extractTextFromEditorDoc(parsed);
  const text =
    extracted && extracted.trim().length > 0
      ? extracted
      : typeof content === "string"
        ? content
        : "";
  return text.split("\n").map((line, idx) => (
    <Text
      key={`${idx}-${line || "line"}`}
      style={{ fontSize: 9, lineHeight: 1.6, ...(style || {}) }}
    >
      {line || " "}
    </Text>
  ));
}

// Async function matching Midday's approach
export async function PdfTemplate({ order }: PdfTemplateProps) {
  const { template, lineItems } = order;
  const locale = template.locale || "sr-RS";
  const currency = template.currency || "EUR";
  const maximumFractionDigits = template.includeDecimals ? 2 : 0;

  const dateFormatMap: Record<string, string> = {
    "dd/MM/yyyy": "dd/MM/yyyy",
    "MM/dd/yyyy": "MM/dd/yyyy",
    "yyyy-MM-dd": "yyyy-MM-dd",
    "dd.MM.yyyy": "dd.MM.yyyy",
  };
  const formatStr = dateFormatMap[template.dateFormat] || "dd.MM.yyyy";

  const result = calculateTotal({
    lineItems: lineItems || [],
    vatRate: template.vatRate,
    taxRate: template.taxRate,
    includeVat: template.includeVat,
    includeTax: template.includeTax,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), formatStr);
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number) =>
    formatOrderAmount({
      amount,
      currency,
      locale,
      maximumFractionDigits,
    });

  // Generate QR code if enabled
  let qrCode = null;
  if (template.includeQr && order.token) {
    qrCode = await QRCodeUtil.toDataURL(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com"}/q/${order.token}`,
      { margin: 0, width: 40 * 3 }
    );
  }

  return (
    <Document>
      <Page
        wrap
        size={template.size === "letter" ? "LETTER" : "A4"}
        style={{
          fontFamily: "Inter",
          fontWeight: 400,
          fontSize: 10,
          padding: 20,
          backgroundColor: "#fff",
          color: "#000",
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <View>
            <Text style={{ fontSize: 21, fontWeight: 500, marginBottom: 8 }}>
              {template.title || "Order"}
            </Text>
            <View style={{ flexDirection: "column", gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
                  {template.orderNoLabel}:
                </Text>
                <Text style={{ fontSize: 9 }}>{order.orderNumber || "-"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 9, fontWeight: 500, marginRight: 2 }}>
                  {template.issueDateLabel}:
                </Text>
                <Text style={{ fontSize: 9 }}>{formatDate(order.issueDate)}</Text>
              </View>
              {/* Optional delivery/expected field could go here if present */}
            </View>
          </View>
          {template.logoUrl && (
            <View style={{ maxWidth: 300 }}>
              <Image src={template.logoUrl} style={{ height: 75, objectFit: "contain" }} />
            </View>
          )}
        </View>

        {/* From / To */}
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: 500, marginBottom: 4 }}>
              {template.fromLabel}
            </Text>
            <View style={{ marginTop: 10 }}>{renderEditorContent(order.fromDetails)}</View>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: 500, marginBottom: 4 }}>To Vendor</Text>
            <View style={{ marginTop: 10 }}>{renderEditorContent(order.customerDetails)}</View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={{ marginTop: 20 }}>
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
              borderBottomColor: "#000",
              paddingBottom: 5,
              marginBottom: 5,
            }}
          >
            <Text
              style={{
                width: 25,
                fontSize: 9,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              #
            </Text>
            <Text style={{ flex: 3, fontSize: 9, fontWeight: 500 }}>
              {template.descriptionLabel}
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              {template.quantityLabel}
            </Text>
            {template.includeUnits && (
              <Text
                style={{
                  flex: 1,
                  fontSize: 9,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {(template as unknown as Record<string, string>).unitLabel || "Unit"}
              </Text>
            )}
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              {template.priceLabel}
            </Text>
            {template.includeDiscount && (
              <Text
                style={{
                  flex: 0.7,
                  fontSize: 9,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {template.discountLabel || "Pop."}
              </Text>
            )}
            {template.includeVat && (
              <Text
                style={{
                  flex: 0.7,
                  fontSize: 9,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {template.vatLabel || "PDV"}
              </Text>
            )}
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 500,
                textAlign: "right",
              }}
            >
              {template.totalLabel}
            </Text>
          </View>

          {(lineItems || []).map((item, index) => {
            const itemTotal = calculateLineItemTotalWithDiscount({
              price: item.price,
              quantity: item.quantity,
              discount: item.discount,
            });
            return (
              <View
                key={item.productId || `line-item-${index}`}
                style={{
                  paddingVertical: 5,
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#e5e5e5",
                }}
                wrap={false}
              >
                {/* Main row with item data */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <Text style={{ width: 25, fontSize: 9, textAlign: "center" }}>{index + 1}</Text>
                  <Text style={{ flex: 3, fontSize: 9 }}>{item.name}</Text>
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
                    {item.quantity ?? 0}
                  </Text>
                  {template.includeUnits && (
                    <Text style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
                      {item.unit || ""}
                    </Text>
                  )}
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
                    {formatAmount(item.price ?? 0)}
                  </Text>
                  {template.includeDiscount && (
                    <Text style={{ flex: 0.7, fontSize: 9, textAlign: "center" }}>
                      {item.discount ?? 0}%
                    </Text>
                  )}
                  {template.includeVat && (
                    <Text style={{ flex: 0.7, fontSize: 9, textAlign: "center" }}>
                      {item.vat ?? template.vatRate ?? 20}%
                    </Text>
                  )}
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
                    {formatAmount(itemTotal)}
                  </Text>
                </View>
                {item.description && (
                  <View style={{ flexDirection: "row", marginTop: 2 }}>
                    <View style={{ width: 25 }} />
                    <View style={{ flex: 3 }}>
                      {renderEditorContent(item.description, {
                        fontSize: 8,
                        color: "#666666",
                        fontStyle: "italic",
                      })}
                    </View>
                    <Text style={{ flex: 1 }} />
                    {template.includeUnits && <Text style={{ flex: 1 }} />}
                    <Text style={{ flex: 1 }} />
                    {template.includeDiscount && <Text style={{ flex: 0.7 }} />}
                    {template.includeVat && <Text style={{ flex: 0.7 }} />}
                    <Text style={{ flex: 1 }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View
          style={{
            marginTop: 60,
            marginBottom: 40,
            alignItems: "flex-end",
            marginLeft: "auto",
            width: 280,
          }}
          wrap={false}
          minPresenceAhead={100}
        >
          {/* Amount before discount */}
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 4,
              width: "100%",
              borderBottomWidth: 0.5,
              borderBottomColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>Amount before discount:</Text>
            <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
              {formatAmount(result.grossTotal)}
            </Text>
          </View>

          {/* Discount */}
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 4,
              width: "100%",
              borderBottomWidth: 0.5,
              borderBottomColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>{template.discountLabel}:</Text>
            <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
              -{formatAmount(result.discountAmount)}
            </Text>
          </View>

          {/* Subtotal */}
          <View
            style={{
              flexDirection: "row",
              paddingVertical: 4,
              width: "100%",
              borderBottomWidth: 0.5,
              borderBottomColor: "#e5e5e5",
            }}
          >
            <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>{template.subtotalLabel}:</Text>
            <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
              {formatAmount(result.subTotal)}
            </Text>
          </View>

          {/* VAT Amount */}
          {template.includeVat && (
            <View
              style={{
                flexDirection: "row",
                paddingVertical: 4,
                width: "100%",
                borderBottomWidth: 0.5,
                borderBottomColor: "#e5e5e5",
              }}
            >
              <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>
                VAT Amount ({template.vatRate}%):
              </Text>
              <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
                {formatAmount(result.vat)}
              </Text>
            </View>
          )}

          {/* Tax (if enabled) */}
          {template.includeTax && (
            <View
              style={{
                flexDirection: "row",
                paddingVertical: 4,
                width: "100%",
                borderBottomWidth: 0.5,
                borderBottomColor: "#e5e5e5",
              }}
            >
              <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>
                {template.taxLabel} ({template.taxRate}%):
              </Text>
              <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
                {formatAmount(result.tax)}
              </Text>
            </View>
          )}

          {/* Total */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 5,
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 5,
              width: "100%",
            }}
          >
            <Text style={{ fontSize: 9, marginRight: 10, color: "#000" }}>
              {template.totalSummaryLabel}:
            </Text>
            <Text style={{ fontSize: 21 }}>{formatAmount(result.total)}</Text>
          </View>
        </View>

        {/* Note - Full width above payment */}
        {order.noteDetails && (
          <View style={{ marginTop: 20 }} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 500 }}>{template.noteLabel}</Text>
            <View style={{ marginTop: 6 }}>{renderEditorContent(order.noteDetails)}</View>
          </View>
        )}

        {/* Fixed bottom area with Payment Details above footer line and page number */}
        <View
          fixed
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            right: 20,
          }}
        >
          {order.paymentDetails && (
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: 500 }}>{template.paymentLabel}</Text>
                <View style={{ marginTop: 6 }}>{renderEditorContent(order.paymentDetails)}</View>
              </View>
              {qrCode && (
                <View style={{ marginLeft: 20 }}>
                  <Image src={qrCode} style={{ width: 40, height: 40 }} />
                </View>
              )}
            </View>
          )}
          <View
            style={{
              marginTop: 3,
              borderTopWidth: 0.5,
              borderTopColor: "#e5e5e5",
              paddingTop: 6,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 8, color: "#666666" }} />
            <Text
              style={{ fontSize: 8, color: "#666666" }}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
