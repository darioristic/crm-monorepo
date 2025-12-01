"use client";

import { VaultViewSwitch } from "./vault-view-switch";
import { VaultUploadButton } from "./vault-upload-button";

export function VaultActions() {
	return (
		<div className="flex items-center gap-2">
			<VaultViewSwitch />
			<VaultUploadButton />
		</div>
	);
}

