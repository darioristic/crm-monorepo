"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function VaultSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center py-6">
        <Skeleton className="h-10 w-[350px]" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Grid skeleton */}
      <VaultGridSkeleton />
    </div>
  );
}

export function VaultGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {[...Array(10)].map((_, index) => (
        <VaultItemSkeleton key={index.toString()} />
      ))}
    </div>
  );
}

export function VaultItemSkeleton() {
  return (
    <div className="h-64 border rounded-lg p-4 flex flex-col gap-3">
      <Skeleton className="w-14 h-20 rounded" />
      <div className="flex flex-col gap-2 flex-1">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-3 w-[60%]" />
        <Skeleton className="h-3 w-[70%]" />
      </div>
      <div className="flex gap-2 mt-auto">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}
