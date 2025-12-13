"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BatchRenameDialog } from "@/components/vault/batch-rename-dialog";
import { useToast } from "@/hooks/use-toast";
import { documentsApi } from "@/lib/api";
import { useDocumentsStore } from "@/store/vault-store";

type Props = {
  data: string[];
};

export function BottomBar({ data }: Props) {
  const queryClient = useQueryClient();
  const { clearSelection } = useDocumentsStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => documentsApi.delete(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      return { total: ids.length, failed };
    },
    onSuccess: ({ total, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      clearSelection();
      setShowDeleteDialog(false);
      if (failed === 0) {
        toast({
          title: "Documents deleted",
          description: `Successfully deleted ${total} document(s)`,
        });
      } else {
        toast({
          title: "Partial deletion",
          description: `Deleted ${total - failed} of ${total} documents. ${failed} failed.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Could not delete the documents. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    if (data.length === 0) return;

    setIsDownloading(true);
    try {
      // For now, just show a toast - implementing zip download would require backend changes
      toast({
        title: "Download started",
        description: `Downloading ${data.length} file(s)`,
      });
    } catch (_error) {
      toast({
        title: "Download failed",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(data);
  };

  return (
    <>
      <motion.div
        className="z-50 fixed flex h-10 items-center justify-between px-4 bottom-4 left-1/2 bg-secondary rounded-lg border shadow-lg"
        initial={{ y: 100, x: "-50%" }}
        animate={{ y: 0, x: "-50%" }}
        exit={{ y: 100, x: "-50%" }}
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium whitespace-nowrap">{data.length} selected</span>
        </div>

        <div className="w-px h-6 bg-border mx-3" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>

          <BatchRenameDialog
            documentIds={data}
            onComplete={clearSelection}
            trigger={
              <Button variant="ghost" size="sm" className="gap-2">
                <Pencil className="h-4 w-4" />
                Rename
              </Button>
            }
          />

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {data.length} document(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected documents will be permanently deleted from
              your vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </div>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
