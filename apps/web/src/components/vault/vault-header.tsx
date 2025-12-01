"use client";

import { VaultSearchFilter } from "./vault-search-filter";
import { VaultActions } from "./vault-actions";

export function VaultHeader() {
	return (
		<div className="flex justify-between items-center py-6">
			<VaultSearchFilter />
			<VaultActions />
		</div>
	);
}

