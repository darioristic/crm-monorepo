"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Company {
	id: string;
	name: string;
	industry: string;
}

export default function CRMPage() {
	const searchParams = useSearchParams();
	const companyId = searchParams.get("companyId") || localStorage.getItem("selectedCompanyId");
	const [companies, setCompanies] = useState<Company[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchCompanies();
	}, []);

	const fetchCompanies = async () => {
		try {
			const response = await fetch("/api/crm/companies");
			if (response.ok) {
				const data = await response.json();
				setCompanies(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching companies:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	if (!companyId) {
		return (
			<div>
				<h2 className="text-3xl font-bold mb-6">Select a Company</h2>
				<div className="grid gap-4">
					{companies.map((company) => (
						<Link
							key={company.id}
							href={`/crm?companyId=${company.id}`}
							className="border rounded-lg p-4 hover:bg-accent transition-colors"
						>
							<h3 className="font-semibold">{company.name}</h3>
							<p className="text-sm text-muted-foreground">{company.industry}</p>
						</Link>
					))}
				</div>
			</div>
		);
	}

	return (
		<div>
			<h2 className="text-3xl font-bold mb-6">CRM Dashboard</h2>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Link
					href={`/crm/companies/${companyId}/documents`}
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Documents</h3>
					<p className="text-sm text-muted-foreground">
						View and manage company documents
					</p>
				</Link>

				<Link
					href={`/crm/companies/${companyId}/contacts`}
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Contacts</h3>
					<p className="text-sm text-muted-foreground">
						Manage company contacts
					</p>
				</Link>

				<Link
					href={`/crm/companies/${companyId}/activities`}
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Activities</h3>
					<p className="text-sm text-muted-foreground">
						View company activities
					</p>
				</Link>
			</div>
		</div>
	);
}

