import { ManageSubscription } from "@/components/manage-subscription";
import { Orders } from "@/components/orders";
import { Plans } from "@/components/plans";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Billing",
};

export default async function BillingPage() {
	return (
		<div className="space-y-12">
			<ManageSubscription />
			<Plans />
			<Orders />
		</div>
	);
}
