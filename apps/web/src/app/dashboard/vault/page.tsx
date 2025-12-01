import { VaultHeader } from "@/components/vault/vault-header";
import { VaultView } from "@/components/vault/vault-view";
import { VaultSkeleton } from "@/components/vault/vault-skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Vault | CRM",
	description: "Document management and storage",
};

export default function VaultPage() {
	return (
		<div className="container mx-auto px-4 py-6">
			<div className="flex flex-col gap-2 mb-6">
				<h1 className="text-3xl font-bold tracking-tight">Vault</h1>
				<p className="text-muted-foreground">
					Store, organize, and search all your documents in one place.
				</p>
			</div>

			<VaultHeader />

			<Suspense fallback={<VaultSkeleton />}>
				<VaultView />
			</Suspense>
		</div>
	);
}

