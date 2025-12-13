"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useInboxParams } from "@/hooks/use-inbox-params";
import { inboxApi } from "@/lib/api/inbox";

type Props = {
  id: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteInboxDialog({ id, isOpen, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setParams, params } = useInboxParams();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteInboxMutation = useMutation({
    mutationFn: () => inboxApi.delete(id),
    onMutate: async () => {
      setIsDeleting(true);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["inbox"],
      });

      // Get current data
      const previousData = queryClient.getQueryData(["inbox"]) as
        | {
            data: Array<{ id: string }>;
          }
        | undefined;

      const allInboxes = previousData?.data ?? [];

      const currentIndex = allInboxes.findIndex((item) => item.id === id);
      let nextInboxId: string | null = null;

      if (allInboxes.length > 1) {
        if (currentIndex === allInboxes.length - 1) {
          // If it was the last item, select the previous one
          nextInboxId = allInboxes[currentIndex - 1]?.id ?? null;
        } else if (currentIndex !== -1) {
          // Otherwise, select the next one
          nextInboxId = allInboxes[currentIndex + 1]?.id ?? null;
        }
      }

      // Select the next item
      setParams({
        ...params,
        inboxId: nextInboxId,
      });

      return { previousData, allInboxes };
    },
    onSuccess: async (_, __, context) => {
      queryClient.invalidateQueries({
        queryKey: ["inbox"],
      });

      queryClient.invalidateQueries({
        queryKey: ["inbox-stats"],
      });

      // Check if inbox is now empty after deletion
      const remainingInboxes = (context?.allInboxes ?? []).filter((item) => item.id !== id);

      const hasFilters = Boolean(params.status);

      // If inbox is empty and no filters, navigate to show empty state
      if (remainingInboxes.length === 0 && !hasFilters) {
        setParams({ inboxId: null });
        router.push("/dashboard/inbox", { scroll: false });
      }

      onOpenChange(false);
    },
    onError: (_, __, context) => {
      setIsDeleting(false);
      // Restore previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(["inbox"], context.previousData);
      }
    },
    onSettled: () => {
      setIsDeleting(false);
      // Refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["inbox"],
      });
    },
  });

  const handleDelete = () => {
    deleteInboxMutation.mutate();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-sm">
            Delete File
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>You are about to delete this file from your inbox and vault.</p>
              <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
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
