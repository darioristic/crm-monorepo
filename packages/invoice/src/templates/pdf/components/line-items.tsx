import { Text, View } from "@react-pdf/renderer";
import type { LineItem, InvoiceTemplate } from "../../../types";
import { formatCurrencyForPDF } from "../../../utils/format";

interface LineItemsProps {
  items: LineItem[];
  template: InvoiceTemplate;
}

export function LineItems({ items, template }: LineItemsProps) {
  const maximumFractionDigits = template.includeDecimals ? 2 : 0;

  return (
    <View style={{ marginTop: 20 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 0.5,
          borderBottomColor: "#000",
          paddingBottom: 5,
          marginBottom: 5,
        }}
      >
        <Text style={{ flex: 3, fontSize: 9, fontWeight: 500 }}>
          {template.descriptionLabel}
        </Text>
        <Text style={{ flex: 1, fontSize: 9, fontWeight: 500 }}>
          {template.quantityLabel}
        </Text>
        <Text style={{ flex: 1, fontSize: 9, fontWeight: 500 }}>
          {template.priceLabel}
        </Text>
        {template.includeDiscount && (
          <Text style={{ flex: 1, fontSize: 9, fontWeight: 500 }}>
            {template.discountLabel}
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

      {/* Line Items */}
      {items.map((item, index) => (
        <View
          key={item.id || index}
          style={{
            flexDirection: "row",
            paddingVertical: 5,
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 3 }}>
            <Text style={{ fontSize: 9 }}>{item.productName}</Text>
            {item.description && (
              <Text style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
                {item.description}
              </Text>
            )}
          </View>

          <Text style={{ flex: 1, fontSize: 9 }}>{item.quantity}</Text>

          <Text style={{ flex: 1, fontSize: 9 }}>
            {formatCurrencyForPDF({
              amount: item.unitPrice,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits,
            })}
          </Text>

          {template.includeDiscount && (
            <Text style={{ flex: 1, fontSize: 9 }}>
              {item.discount > 0 ? `${item.discount}%` : "-"}
            </Text>
          )}

          <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>
            {formatCurrencyForPDF({
              amount: item.total,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits,
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}
