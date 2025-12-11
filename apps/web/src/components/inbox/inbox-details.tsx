"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Check,
  Copy,
  Download,
  FileText,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { type InboxItem, inboxApi } from "@/lib/api/inbox";
import { getWebsiteLogo } from "@/lib/logos";
import { cn, formatCurrency } from "@/lib/utils";
import { InboxActions } from "./inbox-actions";

export function InboxDetails() {
  const queryClient = useQueryClient();
  const { params, setParams } = useInboxParams();
  const [isCopied, setIsCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const id = params.inboxId;

  const { data, isLoading } = useQuery({
    queryKey: ["inbox", id],
    queryFn: () => (id ? inboxApi.getById(id) : null),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InboxItem["status"] }) =>
      inboxApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inboxApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Item deleted");
      setParams({ inboxId: null });
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  const retryMatchingMutation = useMutation({
    mutationFn: (id: string) => inboxApi.process(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Processing completed");
    },
    onError: () => {
      toast.error("Failed to process item");
    },
  });

  const handleCopyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/inbox?inboxId=${data.id}`
      );
      setIsCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDelete = () => {
    if (!data) return;
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMutation.mutate(data.id);
    }
  };

  const handleRetryMatching = () => {
    if (data?.id) {
      updateMutation.mutate({
        id: data.id,
        status: "analyzing",
      });
      retryMatchingMutation.mutate(data.id);
    }
  };

  const isProcessing = data?.status === "processing" || data?.status === "new";

  // Reset fallback when data changes
  useEffect(() => {
    setShowFallback(false);
  }, [data]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const fallback = showFallback || (!data?.website && data?.displayName);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-125px)] overflow-hidden flex-col border w-[614px] hidden md:flex shrink-0 -mt-[54px]">
        <div className="flex items-center p-2 h-[52px] w-full" />
        <Separator />
        <div className="flex flex-1 flex-col">
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <Skeleton className="h-[40px] w-[40px] rounded-full" />
              <div className="grid gap-1 space-y-1">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-3 w-[50px]" />
              </div>
            </div>
            <div className="grid gap-1 ml-auto text-right">
              <Skeleton className="h-3 w-[70px] ml-auto" />
            </div>
          </div>
          <Separator />
          <div className="relative h-full">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-125px)] overflow-hidden flex-col border w-[614px] hidden md:flex shrink-0 -mt-[54px]">
      <div className="flex items-center p-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!data}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!data}>
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  data && updateMutation.mutate({
                    id: data.id,
                    status: data.status === "done" ? "pending" : "done",
                  })
                }
              >
                {data?.status === "done" ? (
                  <>
                    <Check className="mr-2 size-4" />
                    <span className="text-xs">Mark as unhandled</span>
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    <span className="text-xs">Mark as done</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleRetryMatching}
                disabled={retryMatchingMutation.isPending}
              >
                {retryMatchingMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    <span className="text-xs">Processing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 size-4" />
                    <span className="text-xs">Retry Matching</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => toast.info("Download coming soon")}
              >
                <Download className="mr-2 size-4" />
                <span className="text-xs">Download</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 size-4" />
                <span className="text-xs">Copy Link</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                <span className="text-xs">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      {data?.id ? (
        <div className="flex flex-col flex-grow min-h-0 relative">
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm relative">
              {isProcessing ? (
                <Skeleton className="h-[40px] w-[40px] rounded-full" />
              ) : (
                <div className="relative">
                  <Avatar>
                    {data.website && (
                      <AvatarImage
                        alt={data.website}
                        className={cn(
                          "rounded-full overflow-hidden",
                          showFallback && "hidden",
                        )}
                        src={getWebsiteLogo(data.website)}
                        onError={() => {
                          setShowFallback(true);
                        }}
                      />
                    )}

                    {fallback && (
                      <AvatarFallback>
                        {getInitials(data?.displayName ?? "")}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}

              <div className="grid gap-1 select-text">
                <div className="font-semibold">
                  {isProcessing ? (
                    <Skeleton className="h-3 w-[120px] mb-1" />
                  ) : (
                    data.displayName
                  )}
                </div>
                <div className="line-clamp-1 text-xs">
                  {isProcessing && !data.currency && (
                    <Skeleton className="h-3 w-[50px]" />
                  )}
                  {data.currency && data.amount != null && (
                    formatCurrency(data.amount, data.currency)
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-1 ml-auto text-right">
              <div className="text-xs text-muted-foreground select-text">
                {isProcessing && !data.date && (
                  <Skeleton className="h-3 w-[50px]" />
                )}
                {data.date && format(new Date(data.date), "MMM d, yyyy")}
              </div>
            </div>
          </div>

          <Separator />

          <div className="absolute bottom-4 left-4 right-4 z-50">
            <InboxActions data={data} key={data.id} />
          </div>

          {data?.filePath && (
            <div className="flex-1 relative min-h-0 overflow-hidden">
              <div className="h-full w-full bg-white dark:bg-[#0d0d0d] overflow-auto">
                <div className="p-4 h-full flex items-center justify-center">
                  <div className="max-w-full max-h-full">
                    {data.contentType?.includes("pdf") ? (
                      <iframe
                        src={`/api/files/${data.filePath}`}
                        className="w-full h-[500px] border-0"
                        title="Document Preview"
                      />
                    ) : data.contentType?.includes("image") ? (
                      <img
                        src={`/api/files/${data.filePath}`}
                        alt={data.fileName || "Document"}
                        className="max-w-full max-h-[500px] object-contain"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">{data.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {data.contentType}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          No attachment selected
        </div>
      )}
    </div>
  );
}
