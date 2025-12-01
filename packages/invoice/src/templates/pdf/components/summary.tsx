import { Text, View } from "@react-pdf/renderer";
import type { InvoiceTemplate } from "../../../types";
import { formatCurrencyForPDF } from "../../../utils/format";

interface SummaryProps {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  paidAmount?: number;
  template: InvoiceTemplate;
}

export function Summary({
  subtotal,
  tax,
  taxRate,
  total,
  paidAmount = 0,
  template,
}: SummaryProps) {
  const maximumFractionDigits = template.includeDecimals ? 2 : 0;
  const balance = total - paidAmount;

  // Calculate VAT amount if included
  const vatAmount = template.includeVat ? (subtotal * template.vatRate) / 100 : 0;

  return (
    <View
      style={{
        marginTop: 40,
        marginBottom: 40,
        alignItems: "flex-end",
        marginLeft: "auto",
        width: 250,
      }}
    >
      {/* Subtotal */}
      <View style={{ flexDirection: "row", marginBottom: 5, width: "100%" }}>
        <Text style={{ fontSize: 9, flex: 1 }}>{template.subtotalLabel}</Text>
        <Text style={{ fontSize: 9, textAlign: "right" }}>
          {formatCurrencyForPDF({
            amount: subtotal,
            currency: template.currency,
            locale: template.locale,
            maximumFractionDigits,
          })}
        </Text>
      </View>

      {/* VAT */}
      {template.includeVat && template.vatRate > 0 && (
        <View style={{ flexDirection: "row", marginBottom: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1 }}>
            {template.vatLabel} ({template.vatRate}%)
          </Text>
          <Text style={{ fontSize: 9, textAlign: "right" }}>
            {formatCurrencyForPDF({
              amount: vatAmount,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}

      {/* Tax */}
      {template.includeTax && taxRate > 0 && (
        <View style={{ flexDirection: "row", marginBottom: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1 }}>
            {template.taxLabel} ({taxRate}%)
          </Text>
          <Text style={{ fontSize: 9, textAlign: "right" }}>
            {formatCurrencyForPDF({
              amount: tax,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}

      {/* Total */}
      <View
        style={{
          flexDirection: "row",
          marginTop: 5,
          borderTopWidth: 0.5,
          borderTopColor: "#000",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 5,
          width: "100%",
        }}
      >
        <Text style={{ fontSize: 9, marginRight: 10 }}>
          {template.totalSummaryLabel}
        </Text>
        <Text style={{ fontSize: 21 }}>
          {formatCurrencyForPDF({
            amount: total,
            currency: template.currency,
            locale: template.locale,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>

      {/* Paid Amount */}
      {paidAmount > 0 && (
        <View style={{ flexDirection: "row", marginTop: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1, color: "#00C969" }}>Paid</Text>
          <Text style={{ fontSize: 9, textAlign: "right", color: "#00C969" }}>
            {formatCurrencyForPDF({
              amount: paidAmount,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits: 2,
            })}
              </Text>
            </View>
          )}

      {/* Balance Due */}
      {paidAmount > 0 && balance > 0 && (
        <View style={{ flexDirection: "row", marginTop: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1, fontWeight: 600 }}>Balance Due</Text>
          <Text style={{ fontSize: 12, textAlign: "right", fontWeight: 600 }}>
            {formatCurrencyForPDF({
              amount: balance,
              currency: template.currency,
              locale: template.locale,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      )}
    </View>
  );
}
