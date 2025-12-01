import type { Invoice, InvoiceForPdf, InvoiceTemplate, defaultTemplate } from "../types";

interface CompanyData {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

interface CustomerData {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Transform company data to formatted string for invoice
 */
export function transformCompanyToContent(company?: CompanyData | null): string {
  if (!company) return "";

  const lines: string[] = [];

  if (company.name) lines.push(company.name);
  if (company.address) lines.push(company.address);
  if (company.email) lines.push(company.email);
  if (company.phone) lines.push(company.phone);

  return lines.join("\n");
}

/**
 * Transform customer data to formatted string for invoice
 */
export function transformCustomerToContent(customer?: CustomerData | null): string {
  if (!customer) return "";

  const lines: string[] = [];

  if (customer.name) lines.push(customer.name);
  if (customer.address) lines.push(customer.address);
  if (customer.email) lines.push(customer.email);
  if (customer.phone) lines.push(customer.phone);

  return lines.join("\n");
}

/**
 * Prepare invoice data for PDF generation
 */
export function prepareInvoiceForPdf(
  invoice: Invoice,
  template: Partial<InvoiceTemplate>,
  companyData?: CompanyData | null,
  customerData?: CustomerData | null
): InvoiceForPdf {
  const fullTemplate: InvoiceTemplate = {
    title: template.title ?? "RAČUN",
    fromLabel: template.fromLabel ?? "Od",
    customerLabel: template.customerLabel ?? "Za",
    invoiceNoLabel: template.invoiceNoLabel ?? "Broj računa",
    issueDateLabel: template.issueDateLabel ?? "Datum izdavanja",
    dueDateLabel: template.dueDateLabel ?? "Rok plaćanja",
    descriptionLabel: template.descriptionLabel ?? "Opis",
    quantityLabel: template.quantityLabel ?? "Količina",
    priceLabel: template.priceLabel ?? "Cena",
    totalLabel: template.totalLabel ?? "Ukupno",
    subtotalLabel: template.subtotalLabel ?? "Međuzbir",
    taxLabel: template.taxLabel ?? "PDV",
    totalSummaryLabel: template.totalSummaryLabel ?? "Ukupno za plaćanje",
    paymentLabel: template.paymentLabel ?? "Podaci za plaćanje",
    noteLabel: template.noteLabel ?? "Napomena",
    currency: template.currency ?? invoice.currency ?? "EUR",
    dateFormat: template.dateFormat ?? "dd.MM.yyyy",
    includeVat: template.includeVat ?? true,
    vatRate: template.vatRate ?? invoice.taxRate ?? 20,
    includeTax: template.includeTax ?? false,
    taxRate: template.taxRate ?? 0,
    includeQr: template.includeQr ?? false,
    size: template.size ?? "a4",
    locale: template.locale ?? "sr-RS",
    timezone: template.timezone ?? "Europe/Belgrade",
    paymentDetails: template.paymentDetails ?? null,
    noteDetails: template.noteDetails ?? null,
    fromDetails: template.fromDetails ?? null,
    logoUrl: template.logoUrl ?? companyData?.logoUrl ?? null,
  };

  return {
    ...invoice,
    template: fullTemplate,
    fromDetails: transformCompanyToContent(companyData),
    customerDetails: transformCustomerToContent(customerData),
  };
}

