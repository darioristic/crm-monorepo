import type { EditorDoc } from "@crm/schemas";
import type { DeliveryNote } from "@crm/types";

/**
 * Builds customer details as EditorDoc from delivery note data.
 * Handles both JSON string and object formats for customerDetails,
 * and falls back to building from company fields if needed.
 */
type MaybeCompany = {
  name?: string;
  address?: string;
  city?: string;
  zip?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  billingEmail?: string;
  phone?: string;
  vatNumber?: string;
  companyNumber?: string | number;
  registrationNumber?: string | number;
  addressLine1?: string;
  addressLine2?: string;
};

export function buildCustomerDetails(
  deliveryNote:
    | DeliveryNote
    | { company?: MaybeCompany; companyName?: string; customerDetails?: unknown }
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
  const dnWithCompanyName = deliveryNote as { companyName?: string };
  const dnWithCompany = deliveryNote as { company?: MaybeCompany };
  const companyName = dnWithCompanyName.companyName ?? dnWithCompany.company?.name;
  if (companyName) lines.push(companyName);

  const company = dnWithCompany.company;
  if (company) {
    const street = company.addressLine1 || company.address || null;
    const zipCity = [company.zip || company.postalCode, company.city].filter(Boolean).join(" ");
    const addressLine = [street, zipCity].filter(Boolean).join(", ");
    const country = company.country || null;
    const email = company.billingEmail || company.email || null;
    const pib = company.vatNumber ? `PIB: ${company.vatNumber}` : null;
    const mbSource = company.companyNumber || company.registrationNumber;
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
