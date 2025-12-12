/**
 * Document OCR Service
 * Extracts text and structured data from documents (PDFs, images)
 * Supports: Tesseract.js (local), Google Document AI (cloud)
 */

import { serviceLogger } from "../lib/logger";

// ==============================================
// CONFIGURATION
// ==============================================

export const OCR_CONFIG = {
  // Default provider: 'tesseract' (local) or 'google-document-ai' (cloud)
  defaultProvider: process.env.OCR_PROVIDER || "tesseract",

  // Google Document AI settings
  googleProjectId: process.env.GOOGLE_PROJECT_ID,
  googleLocation: process.env.GOOGLE_LOCATION || "us",
  googleProcessorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,

  // Tesseract settings
  tesseractLanguages: ["eng", "srp", "deu", "fra"], // English, Serbian, German, French

  // Processing limits
  maxFileSizeMB: 20,
  supportedMimeTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/tiff",
    "image/webp",
  ],
};

// ==============================================
// TYPES
// ==============================================

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  extractedData?: ExtractedDocumentData;
  pages?: PageResult[];
  processingTimeMs: number;
}

export interface PageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface ExtractedDocumentData {
  // Common invoice/receipt fields
  vendorName?: string;
  vendorWebsite?: string;
  vendorAddress?: string;
  vendorTaxId?: string;

  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;

  amount?: number;
  currency?: string;
  taxAmount?: number;
  taxRate?: number;
  totalAmount?: number;

  // Line items
  lineItems?: LineItem[];

  // Payment details
  bankAccount?: string;
  iban?: string;
  referenceNumber?: string;

  // Raw entities detected
  entities?: Record<string, string>;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

// ==============================================
// PDF TEXT EXTRACTION (using pdf-parse)
// ==============================================

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const { PDFParse } = await import("pdf-parse");

    const parser = new PDFParse({ data: pdfBuffer });
    const textResult = await parser.getText();

    const text = textResult.text || "";
    const extractedData = extractDataFromText(text);

    await parser.destroy();

    serviceLogger.info({ textLength: text.length }, "PDF text extraction completed");

    return {
      text,
      confidence: 0.95, // PDF text extraction is usually high confidence
      provider: "pdf-parse",
      extractedData,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    serviceLogger.error({ error }, "PDF text extraction failed");
    throw error;
  }
}

// ==============================================
// TESSERACT OCR (Local - for images only)
// ==============================================

let tesseractWorker: unknown = null;

async function _initTesseract() {
  if (tesseractWorker) return tesseractWorker;

  try {
    // Dynamic import to avoid loading if not needed
    const Tesseract = await import("tesseract.js");

    tesseractWorker = await Tesseract.createWorker(OCR_CONFIG.tesseractLanguages.join("+"), 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          serviceLogger.debug({ progress: m.progress }, "OCR progress");
        }
      },
    });

    serviceLogger.info("Tesseract worker initialized");
    return tesseractWorker;
  } catch (error) {
    serviceLogger.error({ error }, "Failed to initialize Tesseract");
    throw new Error("Tesseract initialization failed");
  }
}

async function ocrWithTesseract(imageBuffer: Buffer, _mimeType: string): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const Tesseract = await import("tesseract.js");

    // For simple use cases, use recognize directly
    const result = await Tesseract.recognize(imageBuffer, OCR_CONFIG.tesseractLanguages.join("+"), {
      logger: (m: { status: string }) => {
        serviceLogger.debug({ status: m.status }, "Tesseract status");
      },
    });

    const text = result.data.text;
    const confidence = result.data.confidence / 100; // Convert to 0-1 range

    // Extract structured data from text
    const extractedData = extractDataFromText(text);

    return {
      text,
      confidence,
      provider: "tesseract",
      extractedData,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Tesseract OCR failed");
    throw error;
  }
}

// ==============================================
// GOOGLE DOCUMENT AI (Cloud)
// ==============================================

async function ocrWithGoogleDocumentAI(fileBuffer: Buffer, mimeType: string): Promise<OCRResult> {
  const startTime = Date.now();

  const { googleProjectId, googleLocation, googleProcessorId } = OCR_CONFIG;

  if (!googleProjectId || !googleProcessorId) {
    throw new Error("Google Document AI not configured");
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not set");
  }

  try {
    // Use REST API instead of client library for simpler setup
    const endpoint = `https://${googleLocation}-documentai.googleapis.com/v1/projects/${googleProjectId}/locations/${googleLocation}/processors/${googleProcessorId}:process?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rawDocument: {
          content: fileBuffer.toString("base64"),
          mimeType,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Document AI error: ${error}`);
    }

    const data = (await response.json()) as {
      document?: {
        text?: string;
        pages?: Array<{
          pageNumber: number;
          confidence?: number;
        }>;
        entities?: Array<{
          type: string;
          mentionText: string;
          confidence: number;
        }>;
      };
    };

    const document = data.document;
    if (!document) {
      throw new Error("No document in response");
    }

    const text = document.text || "";
    const pages = document.pages || [];
    const entities = document.entities || [];

    // Calculate average confidence
    const avgConfidence =
      pages.length > 0
        ? pages.reduce((sum, p) => sum + (p.confidence || 0), 0) / pages.length
        : 0.8;

    // Convert entities to extracted data
    const extractedData = extractDataFromEntities(entities, text);

    return {
      text,
      confidence: avgConfidence,
      provider: "google-document-ai",
      extractedData,
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: "", // Full text is at document level
        confidence: p.confidence || 0,
      })),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Google Document AI OCR failed");
    throw error;
  }
}

// ==============================================
// TEXT EXTRACTION HELPERS
// ==============================================

/**
 * Extract structured data from raw OCR text using regex patterns
 */
export function extractDataFromText(text: string): ExtractedDocumentData {
  const data: ExtractedDocumentData = {};

  // Try to infer vendor name from header lines (Serbian/EU formats)
  try {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 50);

    // Match legal entity suffixes commonly used in Serbia/EU
    const companyRegex =
      /^(.*?\b[A-ZŠĐČĆŽ][A-Za-z0-9&.\- ]{1,}\s(?:d\.?o\.?o\.?|doo|d\.?d\.?|a\.?d\.?|gmbh|llc|inc|ltd)\b.*)$/i;
    for (const line of lines) {
      const m = line.match(companyRegex);
      if (m) {
        // Clean trailing address or extra spacing
        data.vendorName = m[1].replace(/\s{2,}/g, " ").trim();
        break;
      }
    }

    // If not found, use line preceding PIB/Tax ID mention
    if (!data.vendorName) {
      const pibIndex = lines.findIndex((l) => /\b(pib|tax\s*id|vat\s*id)\b/i.test(l));
      if (pibIndex > 0) {
        // Pick nearest non-empty line above
        for (let i = pibIndex - 1; i >= 0; i--) {
          const candidate = lines[i];
          if (candidate && candidate.length >= 3) {
            data.vendorName = candidate.replace(/\s{2,}/g, " ").trim();
            break;
          }
        }
      }
    }

    if (!data.vendorName) {
      const genericKeywords =
        /(faktura|račun|racun|invoice|proforma|ponuda|quote|datum|date|ukupno|total|iznos|amount|porez|tax|pdv|vat)/i;
      const candidate = lines.find(
        (l) =>
          !genericKeywords.test(l) &&
          !/^\d/.test(l) &&
          /[A-Za-zŠĐČĆŽšđčćž]/.test(l) &&
          l.length >= 3 &&
          l.length <= 80
      );
      if (candidate) {
        data.vendorName = candidate.replace(/\s{2,}/g, " ").trim();
      }
    }
  } catch {
    // Ignore vendor name inference errors
  }

  // Invoice/Receipt number patterns
  const invoicePatterns = [
    /(?:invoice|faktura|račun|racun)\s*(?:broj|br\.?|no\.?|id)\b\s*[:#]?\s*([A-Z0-9]+(?:[/-][A-Z0-9]+)*)/i,
    /\b(?:broj|inv|no\.?|id|br\.?)\b\s*[:#]?\s*([A-Z0-9]+(?:[/-][A-Z0-9]+)*)/i,
  ];
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.invoiceNumber = match[1];
      break;
    }
  }

  // Date patterns (various formats)
  const datePatterns = [
    /(?:date|datum|dated?)[\s:]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.invoiceDate = match[1];
      break;
    }
  }

  // Amount patterns
  const amountPatterns = [
    /(?:total|ukupno|ukupan\s*iznos|iznos\s*računa|iznos|suma|amount|za\s*uplatu)[^0-9€$£]*([€$£]?\s*[\d,.]+)/i,
    /([€$£]\s*[\d,.]+)/,
    /([\d,.]+)\s*(?:EUR|USD|RSD|GBP|HRK|BAM|KM|CHF)/i,
    /(?:EUR|USD|RSD|GBP|HRK|BAM|KM|CHF)\s*([\d,.]+)/i,
  ];
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      let amountStr = match[1].replace(/[€$£\s]/g, "");
      amountStr = amountStr.replace(/\./g, "").replace(",", ".");
      data.totalAmount = parseFloat(amountStr);
      break;
    }
  }

  // Currency detection
  {
    const lower = text.toLowerCase();
    if (/\u20ac|eur\b/i.test(text)) {
      data.currency = "EUR";
    } else if (/\$|usd\b/i.test(text)) {
      data.currency = "USD";
    } else if (/\brsd\b/i.test(lower) || /\bdin(?:ara)?\b/i.test(lower)) {
      data.currency = "RSD";
    } else if (/£|gbp\b/i.test(text)) {
      data.currency = "GBP";
    } else if (/\bhrk\b|\bkuna\b|kn\b/i.test(lower)) {
      data.currency = "HRK";
    } else if (/\bbam\b|\bkm\b/i.test(lower)) {
      data.currency = "BAM";
    } else if (/\bchf\b/i.test(lower)) {
      data.currency = "CHF";
    }
  }

  // Tax/VAT patterns
  const taxPatterns = [
    /(?:vat|pdv|tax|porez)[\s:]*(\d+[.,]?\d*)\s*%/i,
    /(\d+)\s*%\s*(?:vat|pdv|tax)/i,
  ];
  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.taxRate = parseFloat(match[1].replace(",", "."));
      break;
    }
  }

  // IBAN pattern
  const ibanMatch = text.match(/([A-Z]{2}\d{2}[A-Z0-9]{4,30})/);
  if (ibanMatch) {
    data.iban = ibanMatch[1];
  }

  // Website / domain detection (from URLs or emails)
  try {
    // From email
    const emailDomainMatch = text.match(/[A-Z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
    if (emailDomainMatch) {
      data.vendorWebsite = emailDomainMatch[1].toLowerCase().replace(/^www\./, "");
    }
    // From URL
    if (!data.vendorWebsite) {
      const urlDomainMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
      if (urlDomainMatch) {
        data.vendorWebsite = urlDomainMatch[1].toLowerCase().replace(/^www\./, "");
      }
    }
  } catch {
    // Ignore website inference errors
  }

  // Tax ID / PIB patterns
  const taxIdPatterns = [
    /(?:pib|tax\s*id|vat\s*id)[\s:]*(\d{9,13})/i,
    /(?:mb|matični\s*broj)[\s:]*(\d{8,13})/i,
  ];
  for (const pattern of taxIdPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.vendorTaxId = match[1];
      break;
    }
  }

  // Normalize currency code (map synonyms to ISO code)
  if (data.currency) {
    const cur = data.currency.trim().toUpperCase();
    if (cur === "DIN" || cur === "DINARA") {
      data.currency = "RSD";
    } else if (cur === "EURO") {
      data.currency = "EUR";
    } else if (cur === "KUNA" || cur === "KN" || cur === "HRK") {
      data.currency = "HRK";
    } else if (cur === "KM" || cur === "BAM") {
      data.currency = "BAM";
    } else if (cur.length === 3) {
      data.currency = cur;
    }
  }

  return data;
}

/**
 * Extract structured data from Google Document AI entities
 */
function extractDataFromEntities(
  entities: Array<{ type: string; mentionText: string; confidence: number }>,
  fullText: string
): ExtractedDocumentData {
  const data: ExtractedDocumentData = {
    entities: {},
  };

  for (const entity of entities) {
    const { type, mentionText } = entity;
    data.entities![type] = mentionText;

    // Map entity types to structured fields
    switch (type.toLowerCase()) {
      case "supplier_name":
      case "vendor_name":
        data.vendorName = mentionText;
        break;
      case "supplier_address":
      case "vendor_address":
        data.vendorAddress = mentionText;
        break;
      case "invoice_id":
      case "invoice_number":
        data.invoiceNumber = mentionText;
        break;
      case "invoice_date":
        data.invoiceDate = mentionText;
        break;
      case "due_date":
        data.dueDate = mentionText;
        break;
      case "total_amount":
      case "net_amount":
        data.totalAmount = parseFloat(
          mentionText
            .replace(/[^0-9.,]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        break;
      case "currency":
        data.currency = mentionText;
        break;
      case "vat_amount":
      case "tax_amount":
        data.taxAmount = parseFloat(
          mentionText
            .replace(/[^0-9.,]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        break;
    }
  }

  // Fallback to regex extraction if entities are sparse
  if (!data.invoiceNumber || !data.totalAmount) {
    const textData = extractDataFromText(fullText);
    data.invoiceNumber = data.invoiceNumber || textData.invoiceNumber;
    data.totalAmount = data.totalAmount || textData.totalAmount;
    data.currency = data.currency || textData.currency;
    data.taxRate = data.taxRate || textData.taxRate;
    data.iban = data.iban || textData.iban;
  }

  return data;
}

// ==============================================
// MAIN OCR FUNCTION
// ==============================================

/**
 * Process a document and extract text + structured data
 */
export async function processDocument(
  fileBuffer: Buffer,
  mimeType: string,
  options?: {
    provider?: "tesseract" | "google-document-ai";
  }
): Promise<OCRResult> {
  const provider = options?.provider || OCR_CONFIG.defaultProvider;

  // Validate mime type
  if (!OCR_CONFIG.supportedMimeTypes.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // Check file size
  const fileSizeMB = fileBuffer.length / (1024 * 1024);
  if (fileSizeMB > OCR_CONFIG.maxFileSizeMB) {
    throw new Error(
      `File too large: ${fileSizeMB.toFixed(2)}MB (max: ${OCR_CONFIG.maxFileSizeMB}MB)`
    );
  }

  serviceLogger.info({ provider, mimeType, sizeMB: fileSizeMB.toFixed(2) }, "Processing document");

  try {
    // For PDFs, use pdf-parse for text extraction (faster and more reliable than OCR)
    if (mimeType === "application/pdf") {
      return await extractTextFromPdf(fileBuffer);
    }

    // For images, use OCR
    if (provider === "google-document-ai") {
      return await ocrWithGoogleDocumentAI(fileBuffer, mimeType);
    } else {
      return await ocrWithTesseract(fileBuffer, mimeType);
    }
  } catch (error) {
    serviceLogger.error({ error, provider }, "Document processing failed");
    throw error;
  }
}

/**
 * Process a document from a file path
 */
export async function processDocumentFromPath(
  filePath: string,
  options?: {
    provider?: "tesseract" | "google-document-ai";
  }
): Promise<OCRResult> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".webp": "image/webp",
  };

  const mimeType = mimeTypeMap[ext];
  if (!mimeType) {
    throw new Error(`Unknown file extension: ${ext}`);
  }

  return processDocument(buffer, mimeType, options);
}

export default {
  processDocument,
  processDocumentFromPath,
  OCR_CONFIG,
};
