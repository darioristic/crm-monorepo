/**
 * Document Loader
 *
 * Supports loading and extracting text from various document formats:
 * - PDF (with OCR fallback for scanned documents)
 * - Office documents (DOCX, XLSX, PPTX)
 * - OpenDocument formats (ODT, ODS, ODP)
 * - Text formats (TXT, CSV, Markdown, RTF)
 */

import { Mistral } from "@mistralai/mistralai";
import { extractText, getDocumentProxy } from "unpdf";
import { logger } from "../processors/logger";
import { cleanText, extractTextFromRtf } from "../utils";

// Initialize Mistral client for OCR
const mistralClient = process.env.MISTRAL_API_KEY
  ? new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  : null;

export interface LoadDocumentRequest {
  content: Blob | ArrayBuffer | Buffer;
  metadata: {
    mimetype: string;
    filename?: string;
  };
}

export interface LoadDocumentResult {
  text: string | null;
  pageCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Load and extract text from a document
 */
export async function loadDocument({
  content,
  metadata,
}: LoadDocumentRequest): Promise<LoadDocumentResult> {
  let document: string | null = null;
  let pageCount: number | undefined;

  // Convert content to appropriate format
  const blob = content instanceof Blob ? content : new Blob([content], { type: metadata.mimetype });

  try {
    switch (metadata.mimetype) {
      case "application/pdf":
      case "application/x-pdf": {
        const result = await loadPdf(blob);
        document = result.text;
        pageCount = result.pageCount;
        break;
      }

      case "text/csv": {
        document = await loadCsv(blob);
        break;
      }

      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.oasis.opendocument.text":
      case "application/vnd.oasis.opendocument.spreadsheet":
      case "application/vnd.oasis.opendocument.presentation":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/msword":
      case "application/vnd.ms-excel":
      case "application/docx": {
        document = await loadOfficeDocument(blob);
        break;
      }

      case "text/markdown":
      case "text/plain": {
        document = await loadTextFile(blob);
        break;
      }

      case "application/rtf": {
        document = await loadRtf(blob);
        break;
      }

      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      case "application/pptx": {
        document = await loadPptx(blob);
        break;
      }

      default: {
        // Try to load as text for unknown types
        if (metadata.mimetype.startsWith("text/")) {
          document = await loadTextFile(blob);
        } else {
          logger.warn(`Unsupported file type: ${metadata.mimetype}`);
          return { text: null };
        }
      }
    }
  } catch (error) {
    logger.error("Error loading document:", error);
    return { text: null };
  }

  return {
    text: document ? cleanText(document) : null,
    pageCount,
  };
}

/**
 * Load PDF document with OCR fallback
 */
async function loadPdf(blob: Blob): Promise<{ text: string | null; pageCount?: number }> {
  const arrayBuffer = await blob.arrayBuffer();

  try {
    const pdf = await getDocumentProxy(arrayBuffer);
    const pageCount = pdf.numPages;

    const { text } = await extractText(pdf, {
      mergePages: true,
    });

    // Remove unsupported Unicode escape sequences
    let cleanedText = text.replaceAll("\u0000", "");

    // If text extraction failed (scanned PDF), try OCR
    if (cleanedText.trim().length === 0 && mistralClient) {
      logger.info("PDF text extraction failed, attempting OCR...");
      cleanedText = await performOcr(arrayBuffer);
    }

    return { text: cleanedText, pageCount };
  } catch (error) {
    logger.error("PDF loading error:", error);

    // Try OCR as last resort
    if (mistralClient) {
      const ocrText = await performOcr(arrayBuffer);
      return { text: ocrText };
    }

    return { text: null };
  }
}

/**
 * Perform OCR using Mistral AI
 */
async function performOcr(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!mistralClient) {
    throw new Error("Mistral client not configured for OCR");
  }

  try {
    const base64Content = Buffer.from(arrayBuffer).toString("base64");

    const ocrResponse = await mistralClient.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: `data:application/pdf;base64,${base64Content}`,
      },
      includeImageBase64: false,
    });

    // Combine text from all pages
    const text = ocrResponse.pages?.map((page) => page.markdown || "").join("\n\n");

    return text || "";
  } catch (error) {
    logger.error("OCR failed:", error);
    return "";
  }
}

/**
 * Load CSV file
 */
async function loadCsv(blob: Blob): Promise<string> {
  const text = await blob.text();

  // Parse CSV and format as readable text
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim()) {
      // Simple CSV parsing - handle quoted values
      const values = parseCSVLine(line);
      result.push(values.join(" | "));
    }
  }

  return result.join("\n");
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Load Office documents (DOCX, XLSX, etc.) using officeparser
 */
async function loadOfficeDocument(blob: Blob): Promise<string> {
  try {
    // Dynamic import to avoid bundling issues
    const { parseOfficeAsync } = await import("officeparser");
    const arrayBuffer = await blob.arrayBuffer();
    const result = await parseOfficeAsync(Buffer.from(arrayBuffer));
    return result || "";
  } catch (error) {
    logger.error("Office document loading error:", error);
    return "";
  }
}

/**
 * Load plain text or markdown file
 */
async function loadTextFile(blob: Blob): Promise<string> {
  return blob.text();
}

/**
 * Load RTF file
 */
async function loadRtf(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return extractTextFromRtf(Buffer.from(arrayBuffer));
}

/**
 * Load PowerPoint presentation
 */
async function loadPptx(blob: Blob): Promise<string> {
  // Use officeparser for PPTX as well
  return loadOfficeDocument(blob);
}

/**
 * Check if file type is supported
 */
export function isFileTypeSupported(mimetype: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/x-pdf",
    "text/csv",
    "text/plain",
    "text/markdown",
    "application/rtf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/docx",
    "application/pptx",
  ];

  return supportedTypes.includes(mimetype) || mimetype.startsWith("text/");
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return [
    "pdf",
    "csv",
    "txt",
    "md",
    "rtf",
    "docx",
    "doc",
    "xlsx",
    "xls",
    "pptx",
    "ppt",
    "odt",
    "ods",
    "odp",
  ];
}

// Export a singleton instance for convenience
export class DocumentLoader {
  async load(request: LoadDocumentRequest): Promise<LoadDocumentResult> {
    return loadDocument(request);
  }

  isSupported(mimetype: string): boolean {
    return isFileTypeSupported(mimetype);
  }

  getSupportedExtensions(): string[] {
    return getSupportedExtensions();
  }
}

export const documentLoader = new DocumentLoader();
