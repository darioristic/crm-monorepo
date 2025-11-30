export type LineItem = {
  id?: string;
  productName: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyLogo?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  paidAmount: number;
  currency: string;
  notes?: string | null;
  terms?: string | null;
  items: LineItem[];
  createdAt: string;
  updatedAt?: string;
};

export type InvoiceTemplate = {
  id?: string;
  companyId?: string;
  logoUrl?: string | null;
  title: string;
  fromLabel: string;
  customerLabel: string;
  invoiceNoLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  descriptionLabel: string;
  quantityLabel: string;
  priceLabel: string;
  totalLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  totalSummaryLabel: string;
  paymentLabel: string;
  noteLabel: string;
  currency: string;
  dateFormat: string;
  includeVat: boolean;
  vatRate: number;
  includeTax: boolean;
  taxRate: number;
  includeQr: boolean;
  size: "a4" | "letter";
  locale: string;
  timezone: string;
  paymentDetails?: string | null;
  noteDetails?: string | null;
  fromDetails?: string | null;
};

export type InvoiceForPdf = Invoice & {
  template: InvoiceTemplate;
  fromDetails?: string | null;
  customerDetails?: string | null;
};

export const defaultTemplate: InvoiceTemplate = {
  title: "RAČUN",
  fromLabel: "Od",
  customerLabel: "Za",
  invoiceNoLabel: "Broj računa",
  issueDateLabel: "Datum izdavanja",
  dueDateLabel: "Rok plaćanja",
  descriptionLabel: "Opis",
  quantityLabel: "Količina",
  priceLabel: "Cena",
  totalLabel: "Ukupno",
  subtotalLabel: "Međuzbir",
  taxLabel: "PDV",
  totalSummaryLabel: "Ukupno za plaćanje",
  paymentLabel: "Podaci za plaćanje",
  noteLabel: "Napomena",
  currency: "EUR",
  dateFormat: "dd.MM.yyyy",
  includeVat: true,
  vatRate: 20,
  includeTax: false,
  taxRate: 0,
  includeQr: false,
  size: "a4",
  locale: "sr-RS",
  timezone: "Europe/Belgrade",
  paymentDetails: null,
  noteDetails: null,
  fromDetails: null,
};

