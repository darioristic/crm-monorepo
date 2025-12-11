// Delivery Note Types - Based on Order System

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

export type DeliveryNoteStatus = "pending" | "in_transit" | "delivered" | "returned";

export type DeliveryNoteSize = "a4" | "letter";

export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";

export type DeliveryType = "create" | "create_and_send" | "scheduled";

export interface DeliveryNoteTemplate {
  title: string;
  customerLabel: string;
  fromLabel: string;
  deliveryNoLabel: string;
  issueDateLabel: string;
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
  size: DeliveryNoteSize;
  deliveryType: DeliveryType;
  locale: string;
  timezone: string;
}

export interface DeliveryNoteFormValues {
  id: string;
  status: DeliveryNoteStatus;
  template: DeliveryNoteTemplate;
  fromDetails: EditorDoc | string | null;
  customerDetails: EditorDoc | string | null;
  customerId: string;
  customerName?: string;
  paymentDetails: EditorDoc | string | null;
  noteDetails: EditorDoc | string | null;
  issueDate: string;
  deliveryNumber: string;
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

export interface DeliveryNoteDefaultSettings extends Partial<DeliveryNoteFormValues> {
  template: DeliveryNoteTemplate;
}

// Default template values
export const DEFAULT_DELIVERY_NOTE_TEMPLATE: DeliveryNoteTemplate = {
  title: "Delivery Note",
  customerLabel: "Deliver to",
  fromLabel: "From",
  deliveryNoLabel: "Delivery No",
  issueDateLabel: "Date",
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

// Generate unique delivery note token
export function generateDeliveryNoteToken(): string {
  return `dn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Generate next delivery note number
export function generateDeliveryNoteNumber(lastNumber?: string): string {
  const year = new Date().getFullYear();

  if (!lastNumber) {
    return `DN-${year}-001`;
  }

  const patterns = [
    /^DN-(\d{13})-[A-Z0-9]+$/, // DN-<timestamp>-<random>
    /^DN-(\d{6})-(\d+)$/, // DN-YYYYMM-xxx
    /^DN-(\d{4})-(\d+)$/, // DN-YYYY-xxx
  ];

  for (const re of patterns) {
    const m = lastNumber.match(re);
    if (m) {
      const lastYear =
        m[1].length === 13
          ? new Date(parseInt(m[1], 10)).getFullYear().toString()
          : m[1].length === 6
            ? m[1].slice(0, 4)
            : m[1];
      const lastSeqRaw = m[2];
      const lastSeq = lastSeqRaw ? parseInt(lastSeqRaw, 10) : 0;
      if (String(year) === lastYear) {
        return `DN-${year}-${String(lastSeq + 1).padStart(3, "0")}`;
      }
      return `DN-${year}-001`;
    }
  }

  return `DN-${year}-001`;
}

export function formatDeliveryNoteNumber(num: string | null | undefined): string {
  if (!num) return "-";
  let m = num.match(/^DN-(\d{13})-[A-Z0-9]+$/);
  if (m) {
    const ts = parseInt(m[1], 10);
    const year = new Date(ts).getFullYear();
    return `DN-${year}-001`;
  }
  m = num.match(/^DN-(\d{6})-(\d+)$/);
  if (m) {
    const year = m[1].slice(0, 4);
    const seq = String(parseInt(m[2], 10)).padStart(3, "0");
    return `DN-${year}-${seq}`;
  }
  m = num.match(/^DN-(\d{4})-(\d+)$/);
  if (m) {
    const year = m[1];
    const seq = String(parseInt(m[2], 10)).padStart(3, "0");
    return `DN-${year}-${seq}`;
  }
  return num;
}
