import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Get logo as base64 data URL for PDF rendering
// PDF renderer can't fetch from localhost, so we read the file directly
function getLogoDataUrl(): string | null {
	try {
		// Try to read logo from public folder
		const logoPath = join(process.cwd(), "public", "logo.png");

		if (!existsSync(logoPath)) {
			console.warn("Logo file not found at:", logoPath);
			return null;
		}

		const logoBuffer = readFileSync(logoPath);
		const base64 = logoBuffer.toString("base64");
		return `data:image/png;base64,${base64}`;
	} catch (error) {
		console.error("Error reading logo file:", error);
		return null;
	}
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const token = searchParams.get("token");
	const invoiceId = searchParams.get("id");

	if (!token && !invoiceId) {
		return NextResponse.json(
			{ error: "Token or invoice ID is required" },
			{ status: 400 },
		);
	}

	try {
		// Forward authentication cookies to backend
		const cookieHeader = request.headers.get("cookie") || "";
		const fetchOptions: RequestInit = {
			headers: {
				Cookie: cookieHeader,
			},
		};

		// Fetch invoice data
		const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
		let response: Response;

		if (token) {
			response = await fetch(
				`${baseUrl}/api/invoices/token/${token}`,
				fetchOptions,
			);
		} else {
			response = await fetch(
				`${baseUrl}/api/v1/invoices/${invoiceId}`,
				fetchOptions,
			);
		}

		if (!response.ok) {
			return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
		}

		const data = await response.json();
		const apiInvoice = data.data;

		// Build customer details (Bill to)
		let customerDetails = null;
		
		// First check if customerDetails is already stored on the invoice (from database)
		if (apiInvoice.customerDetails) {
			customerDetails = typeof apiInvoice.customerDetails === 'string' 
				? JSON.parse(apiInvoice.customerDetails)
				: apiInvoice.customerDetails;
		} else {
			// Build from company data as fallback
			const customerLines: string[] = [];
			const companyName = apiInvoice.companyName || apiInvoice.company?.name;
			if (companyName) customerLines.push(companyName);
			
			// Address
			if (apiInvoice.company?.addressLine1) customerLines.push(apiInvoice.company.addressLine1);
			else if (apiInvoice.company?.address) customerLines.push(apiInvoice.company.address);
			if (apiInvoice.company?.addressLine2) customerLines.push(apiInvoice.company.addressLine2);
			
			// City, Postal Code, Country
			const cityLine = [
				apiInvoice.company?.city,
				apiInvoice.company?.zip || apiInvoice.company?.postalCode,
				apiInvoice.company?.country,
			]
				.filter(Boolean)
				.join(", ");
			if (cityLine) customerLines.push(cityLine);
			
			// Contact info
			if (apiInvoice.company?.billingEmail) customerLines.push(apiInvoice.company.billingEmail);
			else if (apiInvoice.company?.email) customerLines.push(apiInvoice.company.email);
			if (apiInvoice.company?.phone) customerLines.push(apiInvoice.company.phone);
			
			// VAT Number
			if (apiInvoice.company?.vatNumber) customerLines.push(`PIB: ${apiInvoice.company.vatNumber}`);
			if (apiInvoice.company?.registrationNumber) customerLines.push(`MB: ${apiInvoice.company.registrationNumber}`);

			customerDetails =
				customerLines.length > 0
					? {
							type: "doc" as const,
							content: customerLines.map((line) => ({
								type: "paragraph" as const,
								content: [{ type: "text" as const, text: line }],
							})),
						}
					: null;
		}

		// Build from details (seller info)
		let fromDetails = null;
		
		// First check if fromDetails is already stored on the invoice (from database)
		if (apiInvoice.fromDetails) {
			fromDetails = typeof apiInvoice.fromDetails === 'string'
				? JSON.parse(apiInvoice.fromDetails)
				: apiInvoice.fromDetails;
		} else if (apiInvoice.seller || apiInvoice.team) {
			// Build from seller/team data as fallback
			const seller = apiInvoice.seller || apiInvoice.team;
			const fromLines: string[] = [];
			
			if (seller.name) fromLines.push(seller.name);
			if (seller.addressLine1) fromLines.push(seller.addressLine1);
			else if (seller.address) fromLines.push(seller.address);
			if (seller.addressLine2) fromLines.push(seller.addressLine2);
			
			const sellerCityLine = [seller.city, seller.zip || seller.postalCode, seller.country]
				.filter(Boolean)
				.join(", ");
			if (sellerCityLine) fromLines.push(sellerCityLine);
			
			if (seller.email) fromLines.push(seller.email);
			if (seller.phone) fromLines.push(seller.phone);
			if (seller.vatNumber) fromLines.push(`PIB: ${seller.vatNumber}`);
			if (seller.registrationNumber) fromLines.push(`MB: ${seller.registrationNumber}`);
			if (seller.bankAccount) fromLines.push(`Račun: ${seller.bankAccount}`);
			
			fromDetails = fromLines.length > 0
				? {
						type: "doc" as const,
						content: fromLines.map((line) => ({
							type: "paragraph" as const,
							content: [{ type: "text" as const, text: line }],
						})),
					}
				: null;
		}
		
		// Get logo from invoice or use default
		const logoUrl = apiInvoice.logoUrl || getLogoDataUrl();

		const companyName = apiInvoice.companyName || apiInvoice.company?.name;

		// Transform API data to Invoice type
		const invoice: Invoice = {
			id: apiInvoice.id,
			invoiceNumber: apiInvoice.invoiceNumber,
			issueDate: apiInvoice.issueDate,
			dueDate: apiInvoice.dueDate,
			createdAt: apiInvoice.createdAt,
			updatedAt: apiInvoice.updatedAt,
			amount: apiInvoice.total,
			currency: apiInvoice.currency || "EUR",
			lineItems:
				apiInvoice.items?.map((item: any) => ({
					name: item.productName || item.description || "",
					quantity: item.quantity || 1,
					price: item.unitPrice || 0,
					unit: item.unit || "pcs",
					discount: item.discount || 0,
					vat: item.vat ?? item.vatRate ?? apiInvoice.vatRate ?? 20,
				})) || [],
			paymentDetails: apiInvoice.terms
				? {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: apiInvoice.terms }],
							},
						],
					}
				: null,
			customerDetails,
			fromDetails,
			noteDetails: apiInvoice.notes
				? {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: apiInvoice.notes }],
							},
						],
					}
				: null,
			note: apiInvoice.notes,
			internalNote: null,
			vat: apiInvoice.vat || null,
			tax: apiInvoice.tax || null,
			discount: apiInvoice.discount || null,
			subtotal: apiInvoice.subtotal,
			status: apiInvoice.status,
			template: {
				...DEFAULT_INVOICE_TEMPLATE,
				...(apiInvoice.templateSettings || {}),
				logoUrl: logoUrl,
				taxRate: apiInvoice.taxRate || 0,
				vatRate: apiInvoice.vatRate || 20,
				currency: apiInvoice.currency || "EUR",
				includeVat: true,
				includeTax: Boolean(apiInvoice.tax),
				includeDiscount: true,
				includeDecimals: true,
			},
			token: token || apiInvoice.token || "",
			filePath: null,
			paidAt: apiInvoice.paidAt,
			sentAt: apiInvoice.sentAt,
			viewedAt: apiInvoice.viewedAt,
			reminderSentAt: null,
			sentTo: null,
			topBlock: null,
			bottomBlock: null,
			customerId: apiInvoice.companyId,
			customerName: companyName || "Customer",
			customer: {
				id: apiInvoice.companyId,
				name: companyName || "Customer",
				website: apiInvoice.company?.website || null,
				email: apiInvoice.company?.email || null,
			},
			team: null,
			scheduledAt: null,
		};

		// Debug: Log invoice data
		console.log(
			"Generating PDF for invoice:",
			invoice.invoiceNumber,
			"with",
			invoice.lineItems?.length || 0,
			"items",
		);

		// Dynamically import PDF components to avoid client/server issues
		const { renderToStream } = await import("@react-pdf/renderer");
		const { PdfTemplate } = await import(
			"@/components/invoice/templates/pdf-template"
		);

		// Generate PDF - await the async PdfTemplate like Midday does
		const pdfDocument = await PdfTemplate({ invoice });
		const stream = await renderToStream(pdfDocument as any);

		// Convert stream to blob - matching Midday's approach
		// @ts-expect-error - stream is not assignable to BodyInit
		const blob = await new Response(stream).blob();

		const headers: Record<string, string> = {
			"Content-Type": "application/pdf",
			"Cache-Control": "no-store, max-age=0",
			"Content-Disposition": `attachment; filename="${invoice.invoiceNumber || token || invoiceId}.pdf"`,
		};

		return new Response(blob, { headers });
	} catch (error) {
		console.error("Error generating PDF:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ error: "Failed to generate PDF", details: errorMessage },
			{ status: 500 },
		);
	}
}
