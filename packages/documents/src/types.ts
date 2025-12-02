export type DocumentType = "invoice" | "receipt" | "contract" | "other";

export interface DocumentClassifierRequest {
  content: string;
}

export interface DocumentClassifierImageRequest {
  content: string; // base64 or URL
}

export interface ClassificationResult {
  type: DocumentType;
  confidence: number;
  language?: string;
}

export interface GetDocumentRequest {
  documentUrl: string;
  companyName?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  vatRate?: number;
}

export interface ExtractedInvoice {
  type: "invoice";
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  customerName: string | null;
  customerAddress: string | null;
  email: string | null;
  website: string | null;
  totalAmount: number | null;
  currency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  lineItems: InvoiceLineItem[];
  paymentInstructions: string | null;
  notes: string | null;
  language: string | null;
}

export interface ExtractedReceipt {
  type: "receipt";
  merchantName: string | null;
  merchantAddress: string | null;
  date: string | null;
  totalAmount: number | null;
  currency: string | null;
  taxAmount: number | null;
  paymentMethod: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  language: string | null;
}

export type ExtractedDocument = ExtractedInvoice | ExtractedReceipt;

