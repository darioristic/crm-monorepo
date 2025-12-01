"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function VaultUploadButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      onClick={() => document.getElementById("upload-files")?.click()}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
