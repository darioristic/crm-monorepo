"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { inboxApi } from "@/lib/api/inbox";
import { useInboxStore } from "@/store/inbox";

export function InboxBulkActions() {
  const { selectedIds, clearSelection } = useInboxStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setParams, params } = useInboxParams();
  const [isOpen, setOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const selectedIdsArray = Object.keys(selectedIds);
  const selectedCount = selectedIdsArray.length;

  useEffect(() => {
    if (selectedCount > 0) {
      setOpen(true);
    } else {
      setOpen(false);
      setIsDialogOpen(false);
    }
  }, [selectedCount]);

  const deleteInboxMutation = useMutation({
    mutationFn: () => inboxApi.deleteMany(selectedIdsArray),
    onMutate: async () => {
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

      return { previousData, allInboxes };
    },
    onSuccess: async (_, __, context) => {
      // Invalidate all related queries
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["inbox"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["inbox-stats"],
        }),
      ]);

      // Check if inbox is empty after deletion
      const remainingInboxes = (context?.allInboxes ?? []).filter(
        (item) => !selectedIdsArray.includes(item.id)
      );

      const hasFilters = Boolean(params.status);

      // Navigate to empty state if inbox is empty and no filters
      if (remainingInboxes.length === 0 && !hasFilters) {
        setParams({ inboxId: null });
        router.push("/dashboard/inbox", { scroll: false });
      }

      clearSelection();
    },
    onError: (_, __, context) => {
      // Restore previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(["inbox"], context.previousData);
      }
    },
  });

  if (selectedCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="h-12 fixed bottom-2 left-0 right-0 pointer-events-none flex justify-center z-50"
        animate={{ y: isOpen ? 0 : 100 }}
        initial={{ y: 100 }}
      >
        <div className="pointer-events-auto backdrop-filter backdrop-blur-lg dark:bg-[#1A1A1A]/80 bg-[#F6F6F3]/80 h-12 justify-between items-center flex px-4 border dark:border-[#2C2C2C] min-w-[400px]">
          <span className="text-sm text-[#878787]">{selectedCount} selected</span>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" onClick={() => clearSelection()}>
              <span>Deselect all</span>
            </Button>
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button>
                  <Trash2 className="mr-2 size-4" />
                  <span>Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete {selectedCount}{" "}
                    {selectedCount === 1 ? "inbox item" : "inbox items"}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteInboxMutation.mutate();
                    }}
                  >
                    {deleteInboxMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
