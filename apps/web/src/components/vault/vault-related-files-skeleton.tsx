"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function VaultRelatedFilesSkeleton() {
	return (
		<div className="mt-2">
			<Skeleton className="h-10 w-full mb-2" />
			<div className="flex gap-2 overflow-hidden">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-48 w-40 flex-shrink-0 rounded-lg" />
				))}
			</div>
		</div>
	);
}

