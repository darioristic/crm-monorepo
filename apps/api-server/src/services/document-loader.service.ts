/**
 * Document Loader Service
 *
 * Extracts text content from various document formats (PDF, Office docs, etc.)
 * for AI classification and search indexing.
 */

import { parseOfficeAsync } from "officeparser";
import { PDFParse } from "pdf-parse";
import { logger } from "../lib/logger";

// ============================================
// Utility Functions
// ============================================

/**
 * Clean extracted text by removing control characters and normalizing whitespace
 */
function cleanText(text: string): string {
  // Remove control characters (C0 and C1 controls)
  let cleanedText = text.replace(
    new RegExp(
      [
        "[",
        "\\u0000-\\u001F", // C0 controls
        "\\u007F-\\u009F", // C1 controls
        "]",
      ].join(""),
      "g"
    ),
    ""
  );

  // Normalize spaces: replace multiple spaces, tabs, or line breaks with a single space
  cleanedText = cleanedText.replace(/\s+/g, " ").trim();

  return cleanedText;
}

/**
 * Extract domain from email address
 */
export function getDomainFromEmail(email?: string | null): string | null {
  const emailPattern = /^[^\s@]+@([^\s@]+)$/;
  const match = email?.match(emailPattern);
  const domain = match?.at(1);

  if (!domain) return null;

  const domainParts = domain.split(".");

  if (domainParts.length > 2) {
    return domainParts.slice(-2).join(".");
  }

  return domain;
}

/**
 * Remove protocol (http://, https://) from domain
 */
export function removeProtocolFromDomain(domain: string | null): string | null {
  if (!domain) return null;
  return domain.replace(/^(https?:\/\/)/, "");
}

/**
 * Determine document type from mimetype
 */
export function getDocumentTypeFromMimeType(mimetype: string): "invoice" | "receipt" | "document" {
  switch (mimetype) {
    case "application/pdf":
    case "application/x-pdf":
      return "invoice";
    case "image/jpeg":
    case "image/jpg":
    case "image/png":
    case "image/heic":
      return "receipt";
    default:
      return "document";
  }
}

/**
 * Limit text to a maximum number of words
 */
export function limitWords(text: string, maxWords: number): string {
  if (!text) return "";

  const words = text.split(/\s+/);

  if (words.length <= maxWords) {
    return text;
  }

  return words.slice(0, maxWords).join(" ");
}

/**
 * Extract text from RTF format (robust version)
 */
export function extractTextFromRtf(buffer: Buffer): string {
  let rtfContent = buffer.toString("utf-8");

  // Remove font tables, color tables, and other metadata groups
  rtfContent = rtfContent.replace(/{\\(?:fonttbl|colortbl|stylesheet)[^}]*}/gi, "");

  // Remove RTF header
  rtfContent = rtfContent.replace(/^{\\rtf1[^}]*}/i, "");

  // Remove embedded pictures, objects
  rtfContent = rtfContent.replace(/{\\\*\\shppict[^}]*}/gi, "");
  rtfContent = rtfContent.replace(/{\\object[^}]*}/gi, "");
  rtfContent = rtfContent.replace(/{\\pict[^}]*}/gi, "");

  // Remove Unicode characters like \u1234? (keep the fallback '?')
  rtfContent = rtfContent.replace(/\\u-?\d+\??/g, "");

  // Remove all other RTF control words
  rtfContent = rtfContent.replace(/\\[a-z]+\d* ?/gi, "");

  // Remove escaped hex like \'ab
  rtfContent = rtfContent.replace(/\\'[0-9a-f]{2}/gi, "");

  // Remove any leftover braces
  rtfContent = rtfContent.replace(/[{}]/g, "");

  // Replace known RTF newline/tab symbols
  rtfContent = rtfContent
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\line/gi, "\n");

  // Collapse multiple spaces and newlines
  rtfContent = rtfContent.replace(/\r?\n\s*\r?\n/g, "\n");
  rtfContent = rtfContent.replace(/[ \t]{2,}/g, " ");

  return rtfContent.trim();
}

/**
 * Allowed MIME types for document processing
 */
export const allowedMimeTypes = [
  "image/heic",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "application/octet-stream",
];

/**
 * Supported MIME types for text extraction processing
 */
const supportedMimeTypesForProcessing = new Set([
  "application/pdf",
  "application/x-pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/docx",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pptx",
  "application/rtf",
  "text/markdown",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/msword",
  "application/vnd.ms-excel",
  "image/heic", // Handled via conversion
]);

/**
 * Check if a MIME type is supported for document or image processing
 */
export function isMimeTypeSupportedForProcessing(mimetype: string): boolean {
  // Check exact matches first
  if (supportedMimeTypesForProcessing.has(mimetype)) {
    return true;
  }

  // Check if it's any other image type (handled by image classifier)
  if (mimetype.startsWith("image/")) {
    return true;
  }

  return false;
}

/**
 * Filter allowed attachments from a list
 */
export function getAllowedAttachments<T extends { ContentType: string }>(
  attachments?: T[]
): T[] | undefined {
  return attachments?.filter((attachment) => allowedMimeTypes.includes(attachment.ContentType));
}

/**
 * Get a sample of the content (first N characters) for AI processing
 */
export function getContentSample(content: string, maxLength: number = 5000): string {
  if (content.length <= maxLength) {
    return content;
  }
  // Try to cut at a sentence or paragraph boundary
  const sample = content.slice(0, maxLength);
  const lastPeriod = sample.lastIndexOf(".");
  const lastNewline = sample.lastIndexOf("\n");
  const cutPoint = Math.max(lastPeriod, lastNewline);
  return cutPoint > maxLength * 0.7 ? sample.slice(0, cutPoint + 1) : sample;
}

/**
 * Check if a mimetype is supported for text extraction
 */
export function isSupportedForExtraction(mimetype: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/x-pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "application/msword", // .doc
    "application/vnd.ms-excel", // .xls
    "application/vnd.oasis.opendocument.text", // .odt
    "application/vnd.oasis.opendocument.spreadsheet", // .ods
    "application/rtf",
  ];
  return supportedTypes.includes(mimetype);
}

/**
 * Extract text content from a document buffer
 */
export async function loadDocument(params: {
  content: Buffer;
  mimetype: string;
}): Promise<string | null> {
  const { content, mimetype } = params;
  let document: string | null = null;

  try {
    switch (mimetype) {
      case "application/pdf":
      case "application/x-pdf": {
        const pdfParser = new PDFParse(content);
        const pdfData = await pdfParser.getText();
        document = pdfData.text.split("\u0000").join("");
        break;
      }

      case "text/plain":
      case "text/markdown":
      case "text/csv": {
        document = content.toString("utf-8");
        break;
      }

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      case "application/vnd.oasis.opendocument.text":
      case "application/vnd.oasis.opendocument.spreadsheet":
      case "application/msword":
      case "application/vnd.ms-excel":
      case "application/docx": {
        document = await parseOfficeAsync(content);
        break;
      }

      case "application/rtf": {
        document = extractTextFromRtf(content);
        break;
      }

      default: {
        logger.warn({ mimetype }, "Unsupported document type for text extraction");
        return null;
      }
    }

    return document ? cleanText(document) : null;
  } catch (error) {
    logger.error({ error, mimetype }, "Failed to extract text from document");
    return null;
  }
}

export const documentLoader = {
  loadDocument,
  getContentSample,
  isSupportedForExtraction,
  isMimeTypeSupportedForProcessing,
  cleanText,
  limitWords,
  getDomainFromEmail,
  removeProtocolFromDomain,
  getDocumentTypeFromMimeType,
  extractTextFromRtf,
  getAllowedAttachments,
  allowedMimeTypes,
};

export default documentLoader;
