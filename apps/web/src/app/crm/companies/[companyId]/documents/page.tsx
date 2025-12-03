"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Document {
	id: string;
	content: string;
	createdAt: string;
}

export default function CompanyDocumentsPage() {
	const params = useParams();
	const companyId = params.companyId as string;
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (companyId) {
			fetchDocuments();
		}
	}, [companyId]);

	const fetchDocuments = async () => {
		try {
			const response = await fetch(
				`/api/crm/companies/${companyId}/documents`,
			);
			if (response.ok) {
				const data = await response.json();
				setDocuments(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching documents:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h2 className="text-3xl font-bold mb-6">Documents</h2>

			{documents.length === 0 ? (
				<p className="text-muted-foreground">No documents found</p>
			) : (
				<div className="grid gap-4">
					{documents.map((doc) => (
						<div key={doc.id} className="border rounded-lg p-4">
							<p className="text-sm text-muted-foreground">
								{new Date(doc.createdAt).toLocaleDateString()}
							</p>
							<p className="mt-2">{doc.content || "No content"}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

