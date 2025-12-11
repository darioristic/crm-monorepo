"use client";

import { Loader2 } from "lucide-react";
import type { ForwardedRef } from "react";
import { forwardRef } from "react";

type LoadMoreProps = {
  hasNextPage: boolean;
  isFetching?: boolean;
};

export const LoadMore = forwardRef<HTMLDivElement, LoadMoreProps>(
  ({ hasNextPage, isFetching }, ref) => {
    if (!hasNextPage) return null;

    return (
      <div className="flex items-center justify-center mt-6" ref={ref}>
        <div className="flex items-center space-x-2 py-5">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isFetching ? "Loading more..." : "Scroll for more"}
          </span>
        </div>
      </div>
    );
  }
);

LoadMore.displayName = "LoadMore";
