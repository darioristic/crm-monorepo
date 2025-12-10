"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VaultUploadButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      onClick={() => document.getElementById("vault-upload-input")?.click()}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
