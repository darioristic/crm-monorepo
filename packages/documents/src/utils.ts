/**
 * Document processing utilities
 */

import type { Attachments } from "./types";

// Allowed MIME types for document attachments
export const allowedMimeTypes = [
  "image/heic",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "application/octet-stream",
];

// Supported MIME types for document processing
const supportedMimeTypesForProcessing = new Set([
  // PDF
  "application/pdf",
  "application/x-pdf",
  // Office documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
  "application/msword", // DOC
  "application/vnd.ms-excel", // XLS
  "application/docx",
  "application/pptx",
  // OpenDocument formats
  "application/vnd.oasis.opendocument.text", // ODT
  "application/vnd.oasis.opendocument.spreadsheet", // ODS
  "application/vnd.oasis.opendocument.presentation", // ODP
  // Text formats
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/rtf",
  // Images (for OCR)
  "image/heic",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

/**
 * Filter attachments to only include allowed MIME types
 */
export function getAllowedAttachments(attachments?: Attachments) {
  return attachments?.filter((attachment) => allowedMimeTypes.includes(attachment.ContentType));
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
 * Remove protocol (http:// or https://) from domain
 */
export function removeProtocolFromDomain(domain: string | null): string | null {
  if (!domain) return null;
  return domain.replace(/^(https?:\/\/)/, "");
}

/**
 * Determine document type from MIME type
 */
export function getDocumentTypeFromMimeType(mimetype: string): string {
  switch (mimetype) {
    case "application/pdf":
    case "application/octet-stream":
      return "invoice";
    default:
      return "receipt";
  }
}

/**
 * Get a content sample limited by approximate token count
 */
export function getContentSample(text: string, maxTokens = 1200): string {
  const words = text.split(/\s+/);
  const approxWordsPerToken = 0.75;
  const maxWords = Math.floor(maxTokens / approxWordsPerToken);
  return words.slice(0, maxWords).join(" ");
}

/**
 * Check if a MIME type is supported for document processing
 */
export function isMimeTypeSupportedForProcessing(mimetype: string): boolean {
  if (supportedMimeTypesForProcessing.has(mimetype)) {
    return true;
  }

  // Check if it's any image type (handled by classifyImage)
  if (mimetype.startsWith("image/")) {
    return true;
  }

  return false;
}

/**
 * Extract text content from RTF buffer
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
 * Clean text by removing control characters and normalizing whitespace
 */
export function cleanText(text: string): string {
  // Remove control characters (C0 and C1 controls)
  let cleanedText = text.replace(
    new RegExp(["[", "\\u0000-\\u001F", "\\u007F-\\u009F", "]"].join(""), "g"),
    ""
  );

  // Normalize spaces: replace multiple spaces, tabs, or line breaks with a single space
  cleanedText = cleanedText.replace(/\s+/g, " ").trim();

  return cleanedText;
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
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimetype: string): string {
  const mimeToExt: Record<string, string> = {
    "application/pdf": "pdf",
    "application/x-pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "doc",
    "application/vnd.ms-excel": "xls",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.presentation": "odp",
    "text/plain": "txt",
    "text/csv": "csv",
    "text/markdown": "md",
    "application/rtf": "rtf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/heic": "heic",
  };

  return mimeToExt[mimetype] || "bin";
}
