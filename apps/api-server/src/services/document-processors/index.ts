/**
 * Document Processors
 *
 * AI-powered document processing services for invoices, receipts, and general documents
 */

// Embeddings
export { Embed, embedService } from "./embed";
export type { GetInvoiceRequest, InvoiceResult } from "./invoice-processor";

// Processors
export { InvoiceProcessor, invoiceProcessor } from "./invoice-processor";
// Prompts
export * from "./prompts";
export type { GetReceiptRequest, ReceiptResult } from "./receipt-processor";
export { ReceiptProcessor, receiptProcessor } from "./receipt-processor";
// Schemas
export * from "./schemas";
