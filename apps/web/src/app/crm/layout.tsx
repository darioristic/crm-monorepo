"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Company {
	id: string;
	name: string;
}

export default function CRMLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [companies, setCompanies] = useState<Company[]>([]);
	const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
		null,
	);

	useEffect(() => {
		fetchCompanies();
		const stored = localStorage.getItem("selectedCompanyId");
		if (stored) {
			setSelectedCompanyId(stored);
		}
	}, []);

	const fetchCompanies = async () => {
		try {
			const response = await fetch("/api/crm/companies");
			if (response.ok) {
				const data = await response.json();
				setCompanies(data.data || []);
				if (data.data?.length > 0 && !selectedCompanyId) {
					setSelectedCompanyId(data.data[0].id);
					localStorage.setItem("selectedCompanyId", data.data[0].id);
				}
			}
		} catch (error) {
			console.error("Error fetching companies:", error);
		}
	};

	const handleCompanyChange = (companyId: string) => {
		setSelectedCompanyId(companyId);
		localStorage.setItem("selectedCompanyId", companyId);
	};

	return (
		<div className="min-h-screen bg-background">
			<nav className="border-b">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold">CRM Dashboard</h1>
						<div className="flex items-center gap-4">
							{companies.length > 0 && (
								<select
									value={selectedCompanyId || ""}
									onChange={(e) => handleCompanyChange(e.target.value)}
									className="px-3 py-2 border rounded-md"
								>
									{companies.map((company) => (
										<option key={company.id} value={company.id}>
											{company.name}
										</option>
									))}
								</select>
							)}
							<div className="flex gap-4">
								<Link
									href={`/crm/companies/${selectedCompanyId}/documents`}
									className="text-sm"
								>
									Documents
								</Link>
								<Link
									href={`/crm/companies/${selectedCompanyId}/contacts`}
									className="text-sm"
								>
									Contacts
								</Link>
								<Link
									href={`/crm/companies/${selectedCompanyId}/activities`}
									className="text-sm"
								>
									Activities
								</Link>
							</div>
						</div>
					</div>
				</div>
			</nav>
			<main className="container mx-auto px-4 py-8">
				{selectedCompanyId ? (
					children
				) : (
					<div className="text-center py-12">
						<p className="text-muted-foreground">
							Please select a company to continue
						</p>
					</div>
				)}
			</main>
		</div>
	);
}

