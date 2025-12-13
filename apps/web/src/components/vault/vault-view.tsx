"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DocumentSheet } from "@/components/sheets/document-sheet";
import { DataTable } from "@/components/tables/vault";
import { Button } from "@/components/ui/button";
import { useDocumentParams } from "@/hooks/use-document-params";
import { cn } from "@/lib/utils";
import { DroppableTagList } from "./droppable-tag-list";
import { VaultGrid } from "./vault-grid";
import { VaultUploadZone } from "./vault-upload-zone";

export function VaultView() {
  const { params } = useDocumentParams();
  const [showTagSidebar, setShowTagSidebar] = useState(false);

  return (
    <VaultUploadZone>
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {params.view === "grid" ? <VaultGrid /> : <DataTable />}
        </div>

        {/* Tag Sidebar Toggle */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "absolute -left-3 top-4 z-10 h-8 w-8 p-0 rounded-full shadow-md",
              showTagSidebar && "left-0"
            )}
            onClick={() => setShowTagSidebar(!showTagSidebar)}
            title={showTagSidebar ? "Hide tag panel" : "Show tag panel for drag & drop"}
          >
            {showTagSidebar ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Tag Sidebar */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden",
              showTagSidebar ? "w-56 opacity-100" : "w-0 opacity-0"
            )}
          >
            <div className="w-56 border rounded-lg bg-card p-3">
              <DroppableTagList />
            </div>
          </div>
        </div>
      </div>
      <DocumentSheet />
    </VaultUploadZone>
  );
}
