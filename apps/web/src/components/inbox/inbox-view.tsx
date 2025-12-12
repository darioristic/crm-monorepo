"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { inboxApi } from "@/lib/api/inbox";
import { InboxDetails } from "./inbox-details";
import { InboxEmpty, InboxNoResults } from "./inbox-empty";
import { InboxHeader } from "./inbox-header";
import { InboxItem } from "./inbox-item";
import { InboxUploadZone } from "./inbox-upload-zone";

export function InboxView() {
  const queryClient = useQueryClient();
  const { params, setParams } = useInboxParams();
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollAreaViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(false);
  const allSeenIdsRef = useRef(new Set<string>());

  // Fetch inbox items
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["inbox", params.sort, params.order, params.status],
    queryFn: () =>
      inboxApi.getAll({
        pageSize: 50,
        status: params.status || undefined,
      }),
  });

  const items = useMemo(() => {
    const itemsList = data?.data || [];
    return [...itemsList].sort((a, b) => {
      let comparison = 0;
      if (params.sort === "date") {
        comparison = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      } else {
        comparison = (a.displayName || a.fileName || "").localeCompare(
          b.displayName || b.fileName || ""
        );
      }
      return params.order === "asc" ? comparison : -comparison;
    });
  }, [data, params.sort, params.order]);

  const newItemIds = useMemo(() => {
    const newIds = new Set<string>();

    for (const item of items) {
      if (!allSeenIdsRef.current.has(item.id)) {
        newIds.add(item.id);
        allSeenIdsRef.current.add(item.id);
      }
    }

    return newIds;
  }, [items]);

  useEffect(() => {
    if (!params.inboxId && items.length > 0) {
      setParams({ inboxId: items[0]?.id ?? null });
    }
  }, [items, params.inboxId, setParams]);

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = items.findIndex((item) => item.id === params.inboxId);
        if (currentIndex > 0) {
          const prevItem = items[currentIndex - 1];
          shouldScrollRef.current = true;
          setParams({ inboxId: prevItem?.id });
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const currentIndex = items.findIndex((item) => item.id === params.inboxId);
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1];
          shouldScrollRef.current = true;
          setParams({ inboxId: nextItem?.id });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, params.inboxId, setParams]);

  // Scroll selected item to center
  useEffect(() => {
    const inboxId = params.inboxId;
    if (!inboxId) return;
    if (!shouldScrollRef.current) return;

    requestAnimationFrame(() => {
      const itemElement = itemRefs.current.get(inboxId);
      const viewport = scrollAreaViewportRef.current;
      if (!itemElement || !viewport) {
        shouldScrollRef.current = false;
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const itemRect = itemElement.getBoundingClientRect();
      const itemTop = itemRect.top - viewportRect.top + viewport.scrollTop;
      const itemHeight = itemRect.height;
      const viewportHeight = viewport.clientHeight;
      const scrollPosition = itemTop - viewportHeight / 2 + itemHeight / 2;

      viewport.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: "smooth",
      });

      shouldScrollRef.current = false;
    });
  }, [params.inboxId, items]);

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
  }, [refetch, queryClient]);

  const handleUpload = useCallback(() => {
    const input = document.getElementById("upload-inbox-files");
    if (input) {
      input.click();
    }
  }, []);

  const handleConnectEmail = useCallback(() => {
    toast.info("Gmail connection will be available soon");
  }, []);

  const isEmptyInbox = !isLoading && !error && data?.data?.length === 0;
  const hasFilter = Boolean(params.status);

  if (isEmptyInbox && !hasFilter) {
    return (
      <InboxUploadZone onUploadComplete={handleRefresh}>
        <InboxEmpty onUpload={handleUpload} onConnectEmail={handleConnectEmail} />
      </InboxUploadZone>
    );
  }

  if (hasFilter && items.length === 0) {
    return (
      <InboxUploadZone onUploadComplete={handleRefresh}>
        <InboxHeader />
        <InboxNoResults />
      </InboxUploadZone>
    );
  }

  return (
    <InboxUploadZone onUploadComplete={handleRefresh}>
      <InboxHeader />

      <div className="flex flex-row space-x-8 mt-4">
        <div className="w-full h-full">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex flex-col items-start gap-2 border p-4 text-left text-sm transition-all h-[82px]"
                >
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center mb-4">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">
                          <Skeleton className="h-3 w-[140px]" />
                        </div>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        <Skeleton className="h-3 w-[40px]" />
                      </div>
                    </div>
                    <div className="flex">
                      <div className="text-xs font-medium">
                        <Skeleton className="h-2 w-[110px]" />
                      </div>
                      <div className="ml-auto text-xs font-medium">
                        <Skeleton className="h-2 w-[60px]" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-muted-foreground">Failed to load inbox</p>
              <button type="button" onClick={handleRefresh} className="mt-4 text-sm text-primary hover:underline">
                Try Again
              </button>
            </div>
          ) : (
            <ScrollArea
              ref={(node) => {
                scrollAreaViewportRef.current = node as HTMLDivElement | null;
              }}
              className="relative w-full h-[calc(100vh-180px)] overflow-hidden"
            >
              <AnimatePresence initial={false}>
                <div className="m-0 h-full space-y-4">
                  {items.map((item, index) => {
                    const isNewItem = newItemIds.has(item.id);

                    return (
                      <motion.div
                        key={item.id}
                        initial={isNewItem ? { opacity: 0, y: -30, scale: 0.95 } : false}
                        animate={isNewItem ? { opacity: 1, y: 0, scale: 1 } : "visible"}
                        transition={
                          isNewItem
                            ? {
                                duration: 0.4,
                                ease: [0.23, 1, 0.32, 1],
                                delay: index < 5 ? index * 0.05 : 0,
                              }
                            : undefined
                        }
                        exit={{ opacity: 0 }}
                      >
                        <InboxItem
                          ref={(el) => {
                            if (el) {
                              itemRefs.current.set(item.id, el);
                            } else {
                              itemRefs.current.delete(item.id);
                            }
                          }}
                          item={item}
                          index={index}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            </ScrollArea>
          )}
        </div>

        <InboxDetails />
      </div>
    </InboxUploadZone>
  );
}
