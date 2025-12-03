import type { EditorDoc } from "@/types/invoice";
import type { DeliveryNote } from "@crm/types";

/**
 * Builds customer details as EditorDoc from delivery note data.
 * Handles both JSON string and object formats for customerDetails,
 * and falls back to building from company fields if needed.
 */
export function buildCustomerDetails(
  deliveryNote:
    | DeliveryNote
    | {
        company?: {
          name?: string;
          address?: string;
          city?: string;
          zip?: string;
          postalCode?: string;
          country?: string;
          email?: string;
          phone?: string;
          vatNumber?: string;
        };
        companyName?: string;
        customerDetails?: unknown;
      }
): EditorDoc | null {
  // If customerDetails already exists, return it (handle both string and object formats)
  if (deliveryNote.customerDetails) {
    if (typeof deliveryNote.customerDetails === "string") {
      try {
        const parsed = JSON.parse(deliveryNote.customerDetails);
        // Validate it has the EditorDoc structure
        if (parsed && typeof parsed === "object" && parsed.type === "doc") {
          return parsed as EditorDoc;
        }
        return null;
      } catch {
        return null;
      }
    }
    // If it's already an object, validate and return
    if (
      typeof deliveryNote.customerDetails === "object" &&
      deliveryNote.customerDetails !== null &&
      "type" in deliveryNote.customerDetails &&
      deliveryNote.customerDetails.type === "doc"
    ) {
      return deliveryNote.customerDetails as EditorDoc;
    }
    return null;
  }

  // Build from company fields
  const lines: string[] = [];
  const companyName =
    deliveryNote.companyName || deliveryNote.company?.name;
  if (companyName) {
    lines.push(companyName);
  }

  if (deliveryNote.company) {
    if (deliveryNote.company.address) {
      lines.push(deliveryNote.company.address);
    }
    const cityLine = [
      deliveryNote.company.city,
      deliveryNote.company.zip || deliveryNote.company.postalCode,
      deliveryNote.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);
    if (deliveryNote.company.email) lines.push(deliveryNote.company.email);
    if (deliveryNote.company.phone) lines.push(deliveryNote.company.phone);
    if (deliveryNote.company.vatNumber) {
      lines.push(`VAT: ${deliveryNote.company.vatNumber}`);
    }
  }

  if (lines.length === 0) return null;

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

