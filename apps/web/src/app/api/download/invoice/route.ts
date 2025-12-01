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
		const customerLines: string[] = [];
		const companyName = apiInvoice.companyName || apiInvoice.company?.name;
		if (companyName) customerLines.push(companyName);
		if (apiInvoice.company?.address)
			customerLines.push(apiInvoice.company.address);
		const cityLine = [
			apiInvoice.company?.city,
			apiInvoice.company?.postalCode,
			apiInvoice.company?.country,
		]
			.filter(Boolean)
			.join(", ");
		if (cityLine) customerLines.push(cityLine);
		if (apiInvoice.company?.email) customerLines.push(apiInvoice.company.email);
		if (apiInvoice.company?.phone) customerLines.push(apiInvoice.company.phone);
		if (apiInvoice.company?.vatNumber)
			customerLines.push(`VAT: ${apiInvoice.company.vatNumber}`);

		const customerDetails =
			customerLines.length > 0
				? {
						type: "doc" as const,
						content: customerLines.map((line) => ({
							type: "paragraph" as const,
							content: [{ type: "text" as const, text: line }],
						})),
					}
				: null;

		// Build from details (seller info) - default values for now
		// TODO: Get from settings/team configuration
		const fromDetails = {
			type: "doc" as const,
			content: [
				{
					type: "paragraph" as const,
					content: [{ type: "text" as const, text: "Your Company Name" }],
				},
				{
					type: "paragraph" as const,
					content: [{ type: "text" as const, text: "Your Address" }],
				},
				{
					type: "paragraph" as const,
					content: [{ type: "text" as const, text: "City, Country" }],
				},
				{
					type: "paragraph" as const,
					content: [{ type: "text" as const, text: "email@company.com" }],
				},
			],
		};

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
				logoUrl: getLogoDataUrl(),
				taxRate: apiInvoice.taxRate || 0,
				vatRate: apiInvoice.vatRate || 20,
				currency: apiInvoice.currency || "EUR",
				includeVat: Boolean(apiInvoice.vat),
				includeTax: Boolean(apiInvoice.tax),
				includeDiscount: Boolean(apiInvoice.discount),
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
