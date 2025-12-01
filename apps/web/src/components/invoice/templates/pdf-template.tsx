"use client";

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import type { Invoice, LineItem, EditorDoc } from "@/types/invoice";
import { extractTextFromEditorDoc } from "@/types/invoice";
import {
  calculateTotal,
  calculateLineItemTotal,
  formatInvoiceAmount,
} from "@/utils/invoice-calculate";

// Register fonts (optional - you can add custom fonts)
Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    padding: 40,
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 16,
  },
  meta: {
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 4,
  },
  metaLabel: {
    width: 70,
    color: "#666666",
  },
  metaValue: {
    fontFamily: "Courier",
  },
  logo: {
    height: 50,
    maxWidth: 120,
    objectFit: "contain",
  },
  addressSection: {
    flexDirection: "row",
    gap: 60,
    marginBottom: 40,
  },
  addressBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 8,
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  table: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontWeight: 600,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    paddingVertical: 8,
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellMono: {
    fontSize: 9,
    fontFamily: "Courier",
  },
  descriptionCol: {
    flex: 1,
  },
  qtyCol: {
    width: 50,
    textAlign: "center",
  },
  unitCol: {
    width: 40,
    textAlign: "center",
  },
  priceCol: {
    width: 70,
    textAlign: "right",
  },
  totalCol: {
    width: 80,
    textAlign: "right",
  },
  summaryContainer: {
    alignItems: "flex-end",
    marginBottom: 40,
  },
  summary: {
    width: 200,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  summaryRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#666666",
  },
  summaryValue: {
    fontSize: 9,
    fontFamily: "Courier",
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontWeight: 600,
  },
  summaryTotalValue: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "Courier",
  },
  footer: {
    flexDirection: "row",
    gap: 60,
    marginTop: "auto",
  },
  footerBlock: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 8,
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  qrContainer: {
    alignItems: "flex-end",
    marginTop: 20,
  },
});

type PdfTemplateProps = {
  invoice: Invoice;
};

export function PdfTemplate({ invoice }: PdfTemplateProps) {
  const { template, lineItems } = invoice;
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
    discount: invoice.discount ?? 0,
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
    formatInvoiceAmount({
      amount,
      currency,
      locale,
      maximumFractionDigits,
    });

  const renderTextContent = (content: EditorDoc | string | null) => {
    const text = extractTextFromEditorDoc(content);
    return text.split("\n").map((line, i) => (
      <Text key={i}>{line || " "}</Text>
    ));
  };

  return (
    <Document>
      <Page size={template.size === "letter" ? "LETTER" : "A4"} style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{template.title || "Invoice"}</Text>
            <View style={styles.meta}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{template.invoiceNoLabel}:</Text>
                <Text style={styles.metaValue}>{invoice.invoiceNumber || "-"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{template.issueDateLabel}:</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{template.dueDateLabel}:</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
              </View>
            </View>
          </View>
          {template.logoUrl && (
            <Image src={template.logoUrl} style={styles.logo} />
          )}
        </View>

        {/* From / To */}
        <View style={styles.addressSection}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>{template.fromLabel}</Text>
            <View style={styles.addressText}>
              {renderTextContent(invoice.fromDetails)}
            </View>
          </View>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>{template.customerLabel}</Text>
            <View style={styles.addressText}>
              {renderTextContent(invoice.customerDetails)}
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.descriptionCol]}>
              {template.descriptionLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.qtyCol]}>
              {template.quantityLabel}
            </Text>
            {template.includeUnits && (
              <Text style={[styles.tableHeaderCell, styles.unitCol]}>Unit</Text>
            )}
            <Text style={[styles.tableHeaderCell, styles.priceCol]}>
              {template.priceLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, styles.totalCol]}>
              {template.totalLabel}
            </Text>
          </View>

          {(lineItems || []).map((item: LineItem, index: number) => {
            const itemTotal = calculateLineItemTotal({
              price: item.price,
              quantity: item.quantity,
            });
            return (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.descriptionCol]}>
                  {item.name}
                </Text>
                <Text style={[styles.tableCellMono, styles.qtyCol]}>
                  {item.quantity ?? 0}
                </Text>
                {template.includeUnits && (
                  <Text style={[styles.tableCell, styles.unitCol]}>
                    {item.unit || "-"}
                  </Text>
                )}
                <Text style={[styles.tableCellMono, styles.priceCol]}>
                  {formatAmount(item.price ?? 0)}
                </Text>
                <Text style={[styles.tableCellMono, styles.totalCol]}>
                  {formatAmount(itemTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{template.subtotalLabel}</Text>
              <Text style={styles.summaryValue}>{formatAmount(result.subTotal)}</Text>
            </View>

            {template.includeVat && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {template.vatLabel} ({template.vatRate}%)
                </Text>
                <Text style={styles.summaryValue}>{formatAmount(result.vat)}</Text>
              </View>
            )}

            {template.includeTax && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {template.taxLabel} ({template.taxRate}%)
                </Text>
                <Text style={styles.summaryValue}>{formatAmount(result.tax)}</Text>
              </View>
            )}

            {template.includeDiscount && (invoice.discount ?? 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{template.discountLabel}</Text>
                <Text style={styles.summaryValue}>
                  -{formatAmount(invoice.discount ?? 0)}
                </Text>
              </View>
            )}

            <View style={styles.summaryRowTotal}>
              <Text style={styles.summaryTotalLabel}>
                {template.totalSummaryLabel}
              </Text>
              <Text style={styles.summaryTotalValue}>
                {formatAmount(result.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {invoice.paymentDetails && (
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>{template.paymentLabel}</Text>
              <View style={styles.footerText}>
                {renderTextContent(invoice.paymentDetails)}
              </View>
            </View>
          )}
          {invoice.noteDetails && (
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>{template.noteLabel}</Text>
              <View style={styles.footerText}>
                {renderTextContent(invoice.noteDetails)}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export default PdfTemplate;

