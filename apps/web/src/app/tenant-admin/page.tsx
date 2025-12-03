"use client";

import Link from "next/link";

export default function TenantAdminPage() {
	return (
		<div>
			<h2 className="text-3xl font-bold mb-6">Tenant Administration</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Link
					href="/tenant-admin/users"
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Users</h3>
					<p className="text-sm text-muted-foreground">
						Manage tenant users and permissions
					</p>
				</Link>

				<Link
					href="/tenant-admin/companies"
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Companies</h3>
					<p className="text-sm text-muted-foreground">
						Manage companies in your tenant
					</p>
				</Link>

				<Link
					href="/tenant-admin/locations"
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Locations</h3>
					<p className="text-sm text-muted-foreground">
						Manage locations in your tenant
					</p>
				</Link>

				<Link
					href="/tenant-admin/settings"
					className="border rounded-lg p-6 hover:bg-accent transition-colors"
				>
					<h3 className="font-semibold mb-2">Settings</h3>
					<p className="text-sm text-muted-foreground">
						Configure tenant settings
					</p>
				</Link>
			</div>
		</div>
	);
}

