"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseInfiniteScrollOptions = {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
  threshold?: number;
  rootMargin?: string;
};

export function useInfiniteScroll({
  hasNextPage,
  isFetching,
  fetchNextPage,
  threshold = 0.1,
  rootMargin = "100px",
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadMoreRef, setLoadMoreRef] = useState<HTMLDivElement | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetching, fetchNextPage]
  );

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold,
      rootMargin,
    });

    if (loadMoreRef) {
      observerRef.current.observe(loadMoreRef);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreRef, handleObserver, threshold, rootMargin]);

  return {
    ref: setLoadMoreRef,
    isLoading: isFetching,
  };
}
