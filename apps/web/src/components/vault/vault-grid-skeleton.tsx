"use client";

import { VaultItemSkeleton } from "./vault-skeleton";

export function VaultGridSkeleton() {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
			{[...Array(10)].map((_, index) => (
				<VaultItemSkeleton key={index.toString()} />
			))}
		</div>
	);
}

