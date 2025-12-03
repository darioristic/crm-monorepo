"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Contact {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
}

export default function CompanyContactsPage() {
	const params = useParams();
	const companyId = params.companyId as string;
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (companyId) {
			fetchContacts();
		}
	}, [companyId]);

	const fetchContacts = async () => {
		try {
			const response = await fetch(
				`/api/crm/companies/${companyId}/contacts`,
			);
			if (response.ok) {
				const data = await response.json();
				setContacts(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching contacts:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h2 className="text-3xl font-bold mb-6">Contacts</h2>

			{contacts.length === 0 ? (
				<p className="text-muted-foreground">No contacts found</p>
			) : (
				<div className="grid gap-4">
					{contacts.map((contact) => (
						<div key={contact.id} className="border rounded-lg p-4">
							<h3 className="font-semibold">
								{contact.firstName} {contact.lastName}
							</h3>
							<p className="text-sm text-muted-foreground">{contact.email}</p>
							{contact.phone && (
								<p className="text-sm text-muted-foreground">{contact.phone}</p>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

