"use client";

import { VaultUploadButton } from "./vault-upload-button";
import { VaultViewSwitch } from "./vault-view-switch";

export function VaultActions() {
  return (
    <div className="flex items-center gap-2">
      <VaultViewSwitch />
      <VaultUploadButton />
    </div>
  );
}
