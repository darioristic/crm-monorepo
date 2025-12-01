import type { Invoice, Template, EditorDoc, defaultTemplate } from "../types";

interface CompanyData {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

interface CustomerData {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Transform company data to EditorDoc format for invoice
 */
export function transformCompanyToEditorDoc(company?: CompanyData | null): EditorDoc | null {
  if (!company) return null;

  const lines: string[] = [];

  if (company.name) lines.push(company.name);
  if (company.address) lines.push(company.address);
  if (company.email) lines.push(company.email);
  if (company.phone) lines.push(company.phone);

  if (lines.length === 0) return null;

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

/**
 * Transform company data to formatted string for invoice (legacy)
 */
export function transformCompanyToContent(company?: CompanyData | null): string {
  if (!company) return "";

  const lines: string[] = [];

  if (company.name) lines.push(company.name);
  if (company.address) lines.push(company.address);
  if (company.email) lines.push(company.email);
  if (company.phone) lines.push(company.phone);

  return lines.join("\n");
}

/**
 * Transform customer data to EditorDoc format for invoice
 */
export function transformCustomerToEditorDoc(customer?: CustomerData | null): EditorDoc | null {
  if (!customer) return null;

  const lines: string[] = [];

  if (customer.name) lines.push(customer.name);
  if (customer.address) lines.push(customer.address);
  if (customer.email) lines.push(customer.email);
  if (customer.phone) lines.push(customer.phone);

  if (lines.length === 0) return null;

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

/**
 * Transform customer data to formatted string for invoice (legacy)
 */
export function transformCustomerToContent(customer?: CustomerData | null): string {
  if (!customer) return "";

  const lines: string[] = [];

  if (customer.name) lines.push(customer.name);
  if (customer.address) lines.push(customer.address);
  if (customer.email) lines.push(customer.email);
  if (customer.phone) lines.push(customer.phone);

  return lines.join("\n");
}

/**
 * Extract text from EditorDoc
 */
export function extractTextFromEditorDoc(doc: EditorDoc | string | null): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;

  return doc.content
    .map((node) => {
      if (!node.content) return "";
      return node.content.map((inline) => inline.text || "").join("");
    })
    .join("\n");
}

/**
 * Create EditorDoc from plain text
 */
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
