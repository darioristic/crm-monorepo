"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { documentsApi } from "@/lib/api";

type Props = {
  id: string;
  filePath: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteVaultFileDialog({ id, filePath, isOpen, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await documentsApi.delete(id);
      if (!response.success) {
        throw new Error(response.error?.message || "Delete failed");
      }
      return response;
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
      toast({
        title: "Document deleted",
        description: "The document has been permanently deleted",
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : undefined;
      toast({
        title: "Failed to delete",
        description: message || "Could not delete the document. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const handleDelete = () => {
    deleteDocumentMutation.mutate();
  };

  const fileName = filePath.at(-1) ?? "this file";

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Delete File
          </AlertDialogTitle>
          <AlertDialogDescription>
            <p>
              You are about to delete <strong>{fileName}</strong> from your vault.
            </p>
            <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </div>
            ) : (
              "Delete File"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
