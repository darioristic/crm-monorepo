"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SheetHeader } from "@/components/ui/sheet";

export function DocumentDetailsSkeleton() {
	return (
		<div className="flex flex-col flex-grow min-h-0 relative h-full w-full p-6">
			<SheetHeader className="mb-4 flex justify-between items-center flex-row">
				<div className="min-w-0 flex-1 max-w-[70%] flex flex-row gap-2 items-end">
					<Skeleton className="h-6 w-[200px]" />
					<Skeleton className="h-4 w-[60px]" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-8 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-md" />
				</div>
			</SheetHeader>

			{/* File preview skeleton */}
			<div className="h-full max-h-[500px] p-0 pb-4">
				<div className="flex flex-col flex-grow min-h-0 relative h-full w-full items-center justify-center">
					<Skeleton className="w-full h-full rounded-lg" />
				</div>
			</div>

			{/* Summary skeleton */}
			<div className="mt-4">
				<Skeleton className="h-4 w-full mb-2" />
				<Skeleton className="h-4 w-3/4 mb-4" />
			</div>

			{/* Tags skeleton */}
			<div className="flex gap-2 mt-4">
				<Skeleton className="h-8 w-[100px]" />
				<Skeleton className="h-8 w-[80px]" />
				<Skeleton className="h-8 w-[120px]" />
			</div>
		</div>
	);
}

