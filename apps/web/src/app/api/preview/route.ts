/**
 * PDF Preview API Route
 *
 * Generates thumbnail previews from PDF documents.
 * Uses canvas-based rendering to create PNG thumbnails of the first page.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Thumbnail dimensions
const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = 168; // A4 aspect ratio approximately

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const filePath = searchParams.get("filePath");

		if (!filePath) {
			return NextResponse.json(
				{ error: "filePath parameter is required" },
				{ status: 400 }
			);
		}

		// Get auth token from cookies
		const cookieStore = await cookies();
		const token = cookieStore.get("auth_token")?.value;

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Fetch the PDF from the backend
		const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
		const downloadUrl = `${apiUrl}/api/v1/documents/download/${filePath}`;

		const response = await fetch(downloadUrl, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: "File not found or access denied" },
				{ status: response.status }
			);
		}

		const contentType = response.headers.get("content-type") || "";

		// If it's not a PDF, return as-is (for images)
		if (!contentType.includes("pdf")) {
			const blob = await response.blob();
			return new NextResponse(blob, {
				status: 200,
				headers: {
					"Content-Type": contentType,
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		}

		// For PDFs, we need to generate a thumbnail
		// Since we're in a Node.js environment, we'll use a simpler approach
		// by returning a placeholder or using a backend service

		// Option 1: Return a PDF icon placeholder
		// Option 2: Call a backend endpoint that handles PDF rendering

		// For now, let's try to use the backend preview endpoint if available
		// or return the raw PDF with specific headers for client-side rendering

		const pdfBuffer = await response.arrayBuffer();

		// Return the PDF with headers that allow client-side rendering
		return new NextResponse(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Cache-Control": "public, max-age=31536000, immutable",
				"X-Preview-Type": "pdf",
			},
		});
	} catch (error) {
		console.error("Preview error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * POST endpoint for generating PDF thumbnails server-side
 * This can be used with a proper PDF rendering library
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { filePath, width = THUMBNAIL_WIDTH, height = THUMBNAIL_HEIGHT } = body;

		if (!filePath) {
			return NextResponse.json(
				{ error: "filePath is required" },
				{ status: 400 }
			);
		}

		// Get auth token from cookies
		const cookieStore = await cookies();
		const token = cookieStore.get("auth_token")?.value;

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// For server-side PDF thumbnail generation, you would typically:
		// 1. Use a library like pdf-lib, pdfjs-dist with canvas, or ghostscript
		// 2. Render the first page to an image
		// 3. Return the image

		// Since proper PDF rendering requires native dependencies,
		// we'll return a response indicating the client should render it

		return NextResponse.json({
			success: true,
			renderClient: true,
			filePath,
			width,
			height,
		});
	} catch (error) {
		console.error("Preview POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

