import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import type { DeliveryNote } from "@crm/types";

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
  fromDetails?: any;
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

export async function PdfTemplate({ deliveryNote, fromDetails }: PdfTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={{ padding: 40, fontFamily: "Inter" }}>
        {/* Header */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>
            Delivery Note
          </Text>
          <View style={{ fontSize: 10 }}>
            <Text>Delivery Note No: {deliveryNote.deliveryNumber}</Text>
            {deliveryNote.shipDate && (
              <Text>Ship Date: {formatDate(deliveryNote.shipDate)}</Text>
            )}
            {deliveryNote.deliveryDate && (
              <Text>Expected Delivery: {formatDate(deliveryNote.deliveryDate)}</Text>
            )}
          </View>
        </View>

        {/* From and To Details */}
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {/* From Details */}
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 5 }}>
              From
            </Text>
            {fromDetails && fromDetails.content ? (
              fromDetails.content.map((paragraph: any, idx: number) => (
                <Text key={idx} style={{ fontSize: 9, marginBottom: 2 }}>
                  {paragraph.content?.map((text: any) => text.text).join("") || ""}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 9, color: "#666" }}>Company Information</Text>
            )}
          </View>

          {/* Customer Details */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 5 }}>
              Deliver To
            </Text>
            {deliveryNote.companyName && (
              <Text style={{ fontSize: 9, marginBottom: 2 }}>{deliveryNote.companyName}</Text>
            )}
            {deliveryNote.shippingAddress && (
              <Text style={{ fontSize: 9 }}>{deliveryNote.shippingAddress}</Text>
            )}
          </View>
        </View>

        {/* Shipping Information */}
        {(deliveryNote.trackingNumber || deliveryNote.carrier) && (
          <View style={{ marginBottom: 20, padding: 10, backgroundColor: "#f5f5f5" }}>
            {deliveryNote.trackingNumber && (
              <Text style={{ fontSize: 9, marginBottom: 2 }}>
                Tracking: {deliveryNote.trackingNumber}
              </Text>
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
              borderBottom: "1px solid #000",
              paddingBottom: 5,
              marginBottom: 10,
            }}
          >
            <Text style={{ flex: 3, fontSize: 9, fontWeight: 600 }}>Description</Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: 600, textAlign: "right" }}>
              Qty
            </Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: 600, textAlign: "right" }}>
              Price
            </Text>
            <Text style={{ flex: 1, fontSize: 9, fontWeight: 600, textAlign: "right" }}>
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
                  flexDirection: "row",
                  paddingVertical: 5,
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                <View style={{ flex: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 500 }}>
                    {item.productName}
                  </Text>
                  {item.description && (
                    <Text style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
                  {item.quantity} {item.unit}
                </Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
                  {formatCurrency(item.unitPrice || 0)}
                </Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right", fontWeight: 500 }}>
                  {formatCurrency(itemTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        {deliveryNote.subtotal > 0 && (
          <View style={{ marginTop: "auto", alignItems: "flex-end", marginTop: 20 }}>
            <View style={{ width: 200 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <Text style={{ fontSize: 9 }}>Subtotal:</Text>
                <Text style={{ fontSize: 9 }}>{formatCurrency(deliveryNote.subtotal)}</Text>
              </View>
              {deliveryNote.taxRate > 0 && deliveryNote.tax > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <Text style={{ fontSize: 9 }}>
                    Tax ({deliveryNote.taxRate}%):
                  </Text>
                  <Text style={{ fontSize: 9 }}>{formatCurrency(deliveryNote.tax)}</Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  borderTop: "2px solid #000",
                  paddingTop: 5,
                  marginTop: 5,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: 600 }}>Total:</Text>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>
                  {formatCurrency(deliveryNote.total)}
                </Text>
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
                <Text style={{ fontSize: 9, fontWeight: 600, marginBottom: 5 }}>
                  Notes
                </Text>
                <Text style={{ fontSize: 8 }}>{deliveryNote.notes}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}

