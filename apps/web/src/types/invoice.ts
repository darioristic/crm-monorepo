// Invoice Types - Based on Midday Invoice System

export interface LineItem {
  name: string;
  /** Product description - shown below name in gray */
  description?: string;
  quantity?: number;
  price?: number;
  unit?: string;
  productId?: string;
  /** Discount percentage for this line item (0-100) */
  discount?: number;
  /** VAT percentage for this line item */
  vat?: number;
}

export interface EditorDoc {
  [x: string]: unknown;
  type: string;
  content?: EditorDoc[];
}

export interface EditorNode {
  [x: string]: unknown;
  type: string;
  content?: EditorDoc[];
}

interface InlineContent {
  [x: string]: unknown;
  type: string;
  text?: string;
  marks?: Mark[];
}

export interface Mark {
  type: string;
  attrs?: {
    href?: string;
  };
}

export interface TextStyle {
  fontSize: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic" | "oblique";
  color?: string;
  textDecoration?: string;
}

export type InvoiceStatus = "draft" | "overdue" | "paid" | "unpaid" | "canceled" | "scheduled";

export type InvoiceSize = "a4" | "letter";

export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";

export type DeliveryType = "create" | "create_and_send" | "scheduled";

export interface InvoiceTemplate {
  title: string;
  customerLabel: string;
  fromLabel: string;
  invoiceNoLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  descriptionLabel: string;
  priceLabel: string;
  quantityLabel: string;
  unitLabel: string;
  totalLabel: string;
  totalSummaryLabel: string;
  vatLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  discountLabel: string;
  paymentLabel: string;
  noteLabel: string;
  logoUrl: string | null;
  currency: string;
  paymentDetails: EditorDoc | null;
  fromDetails: EditorDoc | null;
  noteDetails: EditorDoc | null;
  dateFormat: DateFormat;
  includeVat: boolean;
  includeTax: boolean;
  includeDiscount: boolean;
  includeDecimals: boolean;
  includeUnits: boolean;
  includeQr: boolean;
  includePdf: boolean;
  taxRate: number;
  vatRate: number;
  size: InvoiceSize;
  deliveryType: DeliveryType;
  locale: string;
  timezone: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  amount: number | null;
  currency: string | null;
  lineItems: LineItem[];
  paymentDetails: EditorDoc | null;
  customerDetails: EditorDoc | null;
  fromDetails: EditorDoc | null;
  noteDetails: EditorDoc | null;
  note: string | null;
  internalNote: string | null;
  vat: number | null;
  tax: number | null;
  discount: number | null;
  subtotal: number | null;
  status: InvoiceStatus;
  template: InvoiceTemplate;
  token: string;
  filePath: string[] | null;
  paidAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  reminderSentAt: string | null;
  sentTo: string | null;
  topBlock: EditorDoc | null;
  bottomBlock: EditorDoc | null;
  customerId: string | null;
  customerName: string | null;
  customer: {
    id: string;
    name: string | null;
    website: string | null;
    email: string | null;
  } | null;
  team: {
    name: string | null;
  } | null;
  scheduledAt: string | null;
}

export interface InvoiceFormValues {
  id: string;
  status: string;
  template: InvoiceTemplate;
  fromDetails: EditorDoc | string | null;
  customerDetails: EditorDoc | string | null;
  customerId: string;
  customerName?: string;
  paymentDetails: EditorDoc | string | null;
  noteDetails: EditorDoc | string | null;
  dueDate: string;
  issueDate: string;
  invoiceNumber: string;
  logoUrl?: string | null;
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal?: number | null;
  topBlock?: EditorDoc | null;
  bottomBlock?: EditorDoc | null;
  amount: number;
  lineItems: LineItem[];
  token?: string;
  scheduledAt?: string | null;
}

export interface InvoiceDefaultSettings extends Partial<InvoiceFormValues> {
  template: InvoiceTemplate;
}

// Default template values
export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplate = {
  title: "Invoice",
  customerLabel: "To Customer",
  fromLabel: "From",
  invoiceNoLabel: "Invoice No",
  issueDateLabel: "Issue Date",
  dueDateLabel: "Due Date",
  descriptionLabel: "Description",
  priceLabel: "Price",
  quantityLabel: "Quantity",
  unitLabel: "Unit",
  totalLabel: "Total",
  totalSummaryLabel: "Total",
  vatLabel: "VAT",
  subtotalLabel: "Subtotal",
  taxLabel: "Tax",
  discountLabel: "Discount",
  paymentLabel: "Payment Details",
  noteLabel: "Note",
  logoUrl: null,
  currency: "EUR",
  paymentDetails: null,
  fromDetails: null,
  noteDetails: null,
  dateFormat: "dd.MM.yyyy",
  includeVat: true,
  includeTax: false,
  includeDiscount: true,
  includeDecimals: true,
  includeUnits: true,
  includeQr: false,
  includePdf: true,
  taxRate: 0,
  vatRate: 20,
  size: "a4",
  deliveryType: "create",
  locale: "sr-RS",
  timezone: "Europe/Belgrade",
};

// Helper to create empty editor doc
export function createEmptyEditorDoc(): EditorDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

// Helper to create editor doc from text
export function createEditorDocFromText(text: string): EditorDoc {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined,
    })),
  };
}

// Helper to extract text from editor doc
export function extractTextFromEditorDoc(doc: EditorDoc | string | null): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;

  const nodes = doc.content ?? [];
  return nodes
    .map((node) => {
      const inlines = node.content ?? [];
      return inlines
        .map((inline: InlineContent | string | null) =>
          typeof inline === "object" && inline && "text" in inline ? String(inline.text || "") : ""
        )
        .join("");
    })
    .join("\n");
}

// Generate unique invoice token
export function generateInvoiceToken(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Generate next invoice number
export function generateInvoiceNumber(lastNumber?: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  if (!lastNumber) {
    return `INV-${year}${month}-001`;
  }

  const match = lastNumber.match(/INV-(\d{6})-(\d+)/);
  if (!match) {
    return `INV-${year}${month}-001`;
  }

  const lastYearMonth = match[1];
  const lastSeq = parseInt(match[2], 10);
  const currentYearMonth = `${year}${month}`;

  if (lastYearMonth === currentYearMonth) {
    return `INV-${currentYearMonth}-${String(lastSeq + 1).padStart(3, "0")}`;
  }

  return `INV-${currentYearMonth}-001`;
}
