import type { DeliveryNote } from "@crm/types";
import type { EditorDoc } from "@/types/invoice";

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
  const companyName = deliveryNote.companyName || deliveryNote.company?.name;
  if (companyName) lines.push(companyName);

  if (deliveryNote.company) {
    const street =
      (deliveryNote.company as any).addressLine1 || deliveryNote.company.address || null;
    const zipCity = [
      deliveryNote.company.zip || deliveryNote.company.postalCode,
      deliveryNote.company.city,
    ]
      .filter(Boolean)
      .join(" ");
    const addressLine = [street, zipCity].filter(Boolean).join(", ");
    const country = deliveryNote.company.country || null;
    const email = (deliveryNote.company as any).billingEmail || deliveryNote.company.email || null;
    const pib = deliveryNote.company.vatNumber ? `PIB: ${deliveryNote.company.vatNumber}` : null;
    const mbSource =
      (deliveryNote.company as any).companyNumber ||
      (deliveryNote.company as any).registrationNumber;
    const mb = mbSource ? `MB: ${String(mbSource)}` : null;

    if (addressLine) lines.push(addressLine);
    if (country) lines.push(country);
    if (email) lines.push(email);
    if (pib) lines.push(pib);
    if (mb) lines.push(mb);
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
