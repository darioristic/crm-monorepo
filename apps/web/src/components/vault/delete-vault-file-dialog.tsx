"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Check if document has tags (relationships that will be deleted)
  const { data: documentData } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const response = await documentsApi.getById(id);
      return response.data;
    },
    enabled: isOpen,
  });

  const hasTags = (documentData?.documentTagAssignments?.length ?? 0) > 0;
  const tagCount = documentData?.documentTagAssignments?.length ?? 0;

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
      queryClient.invalidateQueries({ queryKey: ["document", id] });
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
          <AlertDialogTitle className="text-sm">Delete File</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {hasTags ? (
              <div className="space-y-3">
                <p>
                  You are about to delete <strong>{fileName}</strong> from your vault.
                </p>
                <div className="my-4 px-3 py-3 bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">
                        This file has {tagCount} tag{tagCount > 1 ? "s" : ""} assigned
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Deleting will remove all tag assignments.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to continue? This action cannot be undone.
                </p>
              </div>
            ) : (
              <div>
                <p>
                  You are about to delete <strong>{fileName}</strong> from your vault.
                </p>
                <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
              </div>
            )}
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
