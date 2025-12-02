import { ConnectedAccounts } from "@/components/connected-accounts";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Bank Connections",
};

export default async function AccountsPage() {
	return (
		<div className="space-y-12">
			<ConnectedAccounts />
		</div>
	);
}

