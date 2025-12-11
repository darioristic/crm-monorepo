"use client";

import { Plus } from "lucide-react";
import { InboxOrdering } from "@/components/inbox/inbox-ordering";
import { InboxSearch } from "@/components/inbox/inbox-search";
import { Button } from "@/components/ui/button";

export function InboxHeader() {
  return (
    <div className="flex justify-center items-center space-x-4 mb-4 mt-6 w-full pr-[647px]">
      <InboxSearch />

      <div className="flex space-x-2">
        <InboxOrdering />

        <Button
          variant="outline"
          size="icon"
          onClick={() => document.getElementById("upload-inbox-files")?.click()}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
