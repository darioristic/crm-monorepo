"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Activity {
	id: string;
	type: string;
	title: string;
	description: string | null;
	createdAt: string;
}

export default function CompanyActivitiesPage() {
	const params = useParams();
	const companyId = params.companyId as string;
	const [activities, setActivities] = useState<Activity[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (companyId) {
			fetchActivities();
		}
	}, [companyId]);

	const fetchActivities = async () => {
		try {
			const response = await fetch(
				`/api/crm/companies/${companyId}/activities`,
			);
			if (response.ok) {
				const data = await response.json();
				setActivities(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching activities:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h2 className="text-3xl font-bold mb-6">Activities</h2>

			{activities.length === 0 ? (
				<p className="text-muted-foreground">No activities found</p>
			) : (
				<div className="grid gap-4">
					{activities.map((activity) => (
						<div key={activity.id} className="border rounded-lg p-4">
							<div className="flex justify-between items-start">
								<div>
									<h3 className="font-semibold">{activity.title}</h3>
									<p className="text-sm text-muted-foreground">
										Type: {activity.type}
									</p>
									{activity.description && (
										<p className="mt-2">{activity.description}</p>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									{new Date(activity.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

