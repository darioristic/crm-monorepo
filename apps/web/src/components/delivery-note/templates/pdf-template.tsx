import type { DeliveryNote } from "@crm/types";
import { Document, Font, Page, Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import type { EditorDoc as QuoteEditorDoc } from "@/types/quote";

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
  ],
});

type PdfTemplateProps = {
  deliveryNote: DeliveryNote;
  fromDetails?: QuoteEditorDoc | string | null;
  customerDetails?: QuoteEditorDoc | string | null;
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = parseISO(dateStr);
    return format(date, "dd.MM.yyyy");
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function PdfTemplate({
  deliveryNote,
  fromDetails,
  customerDetails,
}: PdfTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={{ padding: 40, fontFamily: "Inter" }}>
        {/* Header */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>Delivery Note</Text>
          <View style={{ fontSize: 10 }}>
            <Text>Delivery Note No: {deliveryNote.deliveryNumber}</Text>
            {deliveryNote.shipDate && <Text>Ship Date: {formatDate(deliveryNote.shipDate)}</Text>}
            {deliveryNote.deliveryDate && (
              <Text>Expected Delivery: {formatDate(deliveryNote.deliveryDate)}</Text>
            )}
          </View>
        </View>

        {/* Header with 3 columns: From | Customer | Shipping Address */}
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {/* From Details */}
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 5 }}>From</Text>
            {typeof fromDetails === "string" ? (
              <Text style={{ fontSize: 9 }}>{fromDetails}</Text>
            ) : fromDetails?.content ? (
              fromDetails.content.map((paragraph) => (
                <Text
                  key={
                    (paragraph.content ?? [])
                      .map((t) =>
                        typeof t === "object" && t && "text" in t
                          ? String((t as { text?: string }).text || "")
                          : ""
                      )
                      .join("") || "paragraph"
                  }
                  style={{ fontSize: 9, marginBottom: 2 }}
                >
                  {(paragraph.content ?? [])
                    .map((inline) =>
                      typeof inline === "object" && inline && "text" in inline
                        ? String((inline as { text?: string }).text || "")
                        : ""
                    )
                    .join("") || ""}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 9, color: "#666" }}>Company Information</Text>
            )}
          </View>

          {/* Customer Details */}
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 5 }}>Deliver To</Text>
            {typeof customerDetails === "string" ? (
              <Text style={{ fontSize: 9, marginBottom: 2 }}>{customerDetails}</Text>
            ) : customerDetails?.content ? (
              customerDetails.content.map((paragraph) => (
                <Text
                  key={
                    (paragraph.content ?? [])
                      .map((t) =>
                        typeof t === "object" && t && "text" in t
                          ? String((t as { text?: string }).text || "")
                          : ""
                      )
                      .join("") || "paragraph"
                  }
                  style={{ fontSize: 9, marginBottom: 2 }}
                >
                  {(paragraph.content ?? [])
                    .map((inline) =>
                      typeof inline === "object" && inline && "text" in inline
                        ? String((inline as { text?: string }).text || "")
                        : ""
                    )
                    .join("") || ""}
                </Text>
              ))
            ) : null}
          </View>

          {/* Shipping Address */}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 5 }}>Shipping Address</Text>
            {deliveryNote.shippingAddress ? (
              <Text style={{ fontSize: 9 }}>{deliveryNote.shippingAddress}</Text>
            ) : (
              <Text style={{ fontSize: 9, color: "#666" }}>-</Text>
            )}
          </View>
        </View>

        {/* Shipping Tracking Information */}
        {(deliveryNote.trackingNumber || deliveryNote.carrier) && (
          <View
            style={{
              marginBottom: 20,
              padding: 10,
              backgroundColor: "#f5f5f5",
              flexDirection: "row",
              gap: 20,
            }}
          >
            {deliveryNote.trackingNumber && (
              <Text style={{ fontSize: 9 }}>Tracking: {deliveryNote.trackingNumber}</Text>
            )}
            {deliveryNote.carrier && (
              <Text style={{ fontSize: 9 }}>Carrier: {deliveryNote.carrier}</Text>
            )}
          </View>
        )}

        {/* Items */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
              borderBottomColor: "#000",
              paddingBottom: 5,
              marginBottom: 10,
            }}
          >
            <Text style={{ width: 25, fontSize: 9, fontWeight: 600, textAlign: "center" }}>#</Text>
            <Text style={{ flex: 3, fontSize: 9, fontWeight: 600 }}>Description</Text>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              Qty
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              Price
            </Text>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                fontWeight: 600,
                textAlign: "right",
              }}
            >
              Total
            </Text>
          </View>

          {deliveryNote.items?.map((item, index) => {
            const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
            const discountAmount = lineTotal * ((item.discount || 0) / 100);
            const itemTotal = lineTotal - discountAmount;

            return (
              <View
                key={item.id || index}
                style={{
                  paddingVertical: 5,
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#e5e5e5",
                }}
              >
                {/* Main row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <Text style={{ width: 25, fontSize: 9, textAlign: "center" }}>{index + 1}</Text>
                  <View style={{ flex: 3 }}>
                    <Text style={{ fontSize: 9, fontWeight: 500 }}>{item.productName}</Text>
                    {item.description && (
                      <Text style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "center" }}>
                    {formatCurrency(item.unitPrice || 0)}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 9,
                      textAlign: "right",
                      fontWeight: 500,
                    }}
                  >
                    {formatCurrency(itemTotal)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        {deliveryNote.subtotal > 0 && (
          <View style={{ alignItems: "flex-end", marginTop: 20 }}>
            <View style={{ width: 280 }}>
              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 4,
                  width: "100%",
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#e5e5e5",
                }}
              >
                <Text style={{ fontSize: 9, flex: 1, color: "#000" }}>Subtotal:</Text>
                <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
                  {formatCurrency(deliveryNote.subtotal)}
                </Text>
              </View>
              {deliveryNote.taxRate > 0 && deliveryNote.tax > 0 && (
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
                    Tax ({deliveryNote.taxRate}%):
                  </Text>
                  <Text style={{ fontSize: 9, textAlign: "right", color: "#000" }}>
                    {formatCurrency(deliveryNote.tax)}
                  </Text>
                </View>
              )}
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
                <Text style={{ fontSize: 9, marginRight: 10, color: "#000" }}>Total:</Text>
                <Text style={{ fontSize: 21 }}>{formatCurrency(deliveryNote.total)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Notes and Terms */}
        {(deliveryNote.notes || deliveryNote.terms) && (
          <View style={{ marginTop: 30, flexDirection: "row", gap: 20 }}>
            {deliveryNote.terms && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: 600, marginBottom: 5 }}>
                  Terms & Conditions
                </Text>
                <Text style={{ fontSize: 8 }}>{deliveryNote.terms}</Text>
              </View>
            )}
            {deliveryNote.notes && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: 600, marginBottom: 5 }}>Notes</Text>
                <Text style={{ fontSize: 8 }}>{deliveryNote.notes}</Text>
              </View>
            )}
          </View>
        )}
        {/* Footer with line and page number */}
        <View
          fixed
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            right: 20,
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
      </Page>
    </Document>
  );
}
