import { redirect } from "next/navigation";

export default function SuperadminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// TODO: Add superadmin auth check
	// For now, just render children
	return (
		<div className="min-h-screen bg-background">
			<nav className="border-b">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold">Superadmin Dashboard</h1>
						<div className="flex gap-4">
							<a href="/superadmin/tenants" className="text-sm">
								Tenants
							</a>
							<a href="/superadmin/provision" className="text-sm">
								Provision
							</a>
						</div>
					</div>
				</div>
			</nav>
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}

