export const documentClassifierPrompt = `You are a document classifier. Analyze the provided text and determine what type of document it is.

Classify the document into one of these categories:
- invoice: A bill or invoice requesting payment for goods/services
- receipt: A proof of payment or purchase receipt
- contract: A legal agreement or contract
- other: Any other type of document

Provide your classification with a confidence score between 0 and 1.
Also detect the language of the document if possible.`;

export const imageClassifierPrompt = `You are a document classifier. Analyze the provided image and determine what type of document it is.

Classify the document into one of these categories:
- invoice: A bill or invoice requesting payment for goods/services
- receipt: A proof of payment or purchase receipt
- contract: A legal agreement or contract
- other: Any other type of document

Provide your classification with a confidence score between 0 and 1.
Also detect the language of the document if possible.`;

export const invoicePrompt = `You are an expert invoice data extractor. Extract all relevant information from the invoice.

Extract the following fields:
- invoice_number: The invoice or document number
- invoice_date: The date the invoice was issued (ISO 8601 format)
- due_date: The payment due date (ISO 8601 format)
- vendor_name: The name of the company/person issuing the invoice
- vendor_address: The full address of the vendor
- customer_name: The name of the customer/recipient
- customer_address: The full address of the customer
- email: Contact email (vendor's email if available)
- website: Vendor's website
- total_amount: The total amount to pay (numeric)
- currency: The currency code (e.g., EUR, USD, RSD)
- tax_amount: The tax/VAT amount (numeric)
- tax_rate: The tax rate as a percentage (numeric)
- tax_type: Type of tax (e.g., VAT, PDV, GST)
- line_items: Array of items with description, quantity, unit_price, total, vat_rate
- payment_instructions: Bank details or payment instructions
- notes: Any additional notes or terms
- language: The language of the document (ISO 639-1 code)

Be precise with numbers and dates. If a field is not present, return null.`;

export function createInvoicePrompt(companyName: string): string {
  return `${invoicePrompt}

Additional context: The receiving company is "${companyName}". This may help identify which entity is the vendor vs customer.`;
}

export const receiptPrompt = `You are an expert receipt data extractor. Extract all relevant information from the receipt.

Extract the following fields:
- merchant_name: The name of the store/merchant
- merchant_address: The address of the merchant
- date: The date of purchase (ISO 8601 format)
- total_amount: The total amount paid (numeric)
- currency: The currency code (e.g., EUR, USD, RSD)
- tax_amount: The tax/VAT amount if shown (numeric)
- payment_method: How payment was made (cash, card, etc.)
- items: Array of purchased items with name, quantity, price
- language: The language of the receipt (ISO 639-1 code)

Be precise with numbers and dates. If a field is not present, return null.`;
