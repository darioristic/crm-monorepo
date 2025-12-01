import { Document, Font, Image, Page, View } from "@react-pdf/renderer";
import QRCodeUtil from "qrcode";
import type { Invoice, InvoiceTemplate } from "../../types";
import { defaultTemplate } from "../../types";
import {
  Meta,
  LineItems,
  Summary,
  CompanyDetailsBlock,
  PaymentDetails,
  Notes,
  QRCode,
} from "./components";

// Register Inter font
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

interface PdfTemplateProps {
  invoice: Invoice;
  customTemplate?: Partial<InvoiceTemplate>;
}

export async function PdfTemplate({ invoice, customTemplate }: PdfTemplateProps) {
  // Merge default template with custom settings
  const template: InvoiceTemplate = {
    ...defaultTemplate,
    ...invoice.template,
    ...customTemplate,
  };

  // Generate QR code if enabled
  let qrCodeData: string | null = null;
  if (template.includeQr) {
    // Generate payment QR code data
    const qrContent = `Invoice: ${invoice.invoiceNumber}\nAmount: ${invoice.total} ${template.currency}`;
    qrCodeData = await QRCodeUtil.toDataURL(qrContent, {
          margin: 0,
          width: 60 * 3,
    });
  }

  return (
    <Document>
      <Page
        wrap
        size={template.size.toUpperCase() as "LETTER" | "A4"}
        style={{
          padding: 40,
          backgroundColor: "#fff",
          color: "#000",
          fontFamily: "Inter",
          fontWeight: 400,
        }}
      >
        {/* Header with Meta and Logo */}
        <View
          style={{
            marginBottom: 20,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Meta
            invoiceNumber={invoice.invoiceNumber}
            issueDate={invoice.issueDate}
            dueDate={invoice.dueDate}
            template={template}
          />

          {template.logoUrl && (
            <View style={{ maxWidth: 200 }}>
              <Image
                src={template.logoUrl}
                style={{
                  height: 60,
                  objectFit: "contain",
                }}
              />
            </View>
          )}
        </View>

        {/* Company and Customer Details */}
        <View style={{ flexDirection: "row", marginTop: 20 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <CompanyDetailsBlock
              label={template.fromLabel}
              company={invoice.company}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 20 }}>
            <CompanyDetailsBlock
              label={template.customerLabel}
              company={invoice.customer}
            />
          </View>
        </View>

        {/* Line Items */}
        <LineItems items={invoice.items} template={template} />

        {/* Summary */}
        <View
          style={{
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <Summary
            subtotal={invoice.subtotal}
            tax={invoice.tax}
            taxRate={invoice.taxRate}
            total={invoice.total}
            paidAmount={invoice.paidAmount}
            template={template}
          />

          {/* Payment Details and Notes */}
          <View style={{ flexDirection: "row", marginTop: 20 }}>
            <View style={{ flex: 1, marginRight: 20 }}>
              <PaymentDetails
                label={template.paymentLabel}
                content={template.paymentDetails || invoice.terms || null}
              />

              {qrCodeData && <QRCode data={qrCodeData} />}
            </View>

            <View style={{ flex: 1, marginLeft: 20 }}>
              <Notes
                label={template.noteLabel}
                content={template.noteDetails || invoice.notes || null}
              />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export { renderToStream, renderToBuffer } from "@react-pdf/renderer";
