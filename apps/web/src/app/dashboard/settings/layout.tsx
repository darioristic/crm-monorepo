import { Metadata } from "next";
import { generateMeta } from "@/lib/utils";
import { SecondaryMenu } from "@/components/secondary-menu";
import { CompanyCreateSheet } from "@/components/companies/company-create-sheet";

export async function generateMetadata(): Promise<Metadata> {
	return generateMeta({
		title: "Settings",
		description: "Manage your account settings and preferences.",
		canonical: "/dashboard/settings",
	});
}

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="max-w-4xl mx-auto">
			<div className="mb-8">
				<h1 className="text-3xl font-semibold tracking-tight mb-2">Settings</h1>
				<p className="text-muted-foreground">
					Manage your account settings and preferences.
				</p>
			</div>
			
			<SecondaryMenu
				items={[
					{ path: "/dashboard/settings", label: "General" },
					{ path: "/dashboard/settings/companies", label: "Companies" },
					{ path: "/dashboard/settings/users", label: "Users" },
					{ path: "/dashboard/settings/billing", label: "Billing" },
					{ path: "/dashboard/settings/accounts", label: "Bank Connections" },
					{ path: "/dashboard/settings/members", label: "Members" },
					{ path: "/dashboard/settings/notifications", label: "Notifications" },
				]}
			/>

			<main className="mt-8">{children}</main>
			<CompanyCreateSheet />
		</div>
	);
}
