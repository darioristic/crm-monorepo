import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(
	request: NextRequest,
	{ params }: { params: { companyId: string } },
) {
	const token = request.cookies.get("access_token")?.value;

	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const response = await fetch(
			`${API_URL}/api/crm/companies/${params.companyId}/activities`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		);

		const data = await response.json();
		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch activities" },
			{ status: 500 },
		);
	}
}

