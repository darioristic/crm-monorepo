"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { paymentsApi } from "@/lib/api";

interface BottomBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BottomBar({ selectedIds, onClearSelection }: BottomBarProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => paymentsApi.delete(id)));
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`${selectedIds.length} transaction(s) deleted`);
      onClearSelection();
    } catch {
      toast.error("Failed to delete transactions");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    toast.info("Export feature coming soon");
  };

  const handleBulkTag = () => {
    toast.info("Bulk tagging coming soon");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 bg-background border rounded-lg shadow-lg px-4 py-3">
        <span className="text-sm font-medium mr-2">{selectedIds.length} selected</span>

        <div className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={handleBulkTag} className="gap-2">
          <Tag className="h-4 w-4" />
          Add Tags
        </Button>

        <Button variant="ghost" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDeleteOpen(true)}
          disabled={isDeleting}
          className="gap-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button variant="ghost" size="icon" onClick={onClearSelection} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <DeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete transactions"
        description={`This action cannot be undone. This will permanently delete ${selectedIds.length} transaction(s).`}
        onConfirm={() => {
          setIsDeleteOpen(false);
          handleBulkDelete();
        }}
        isLoading={isDeleting}
      />
    </motion.div>
  );
}
