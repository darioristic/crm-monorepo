"use client";

import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { Button } from "@/components/ui/button";
import { Transactions2Icon } from "@/components/icons/custom-icons";

export function NoResults() {
	const { setFilter } = useDocumentFilterParams();

	return (
		<div className="h-screen w-full flex items-center justify-center flex-col -mt-[160px]">
			<div className="flex flex-col items-center">
				<Transactions2Icon className="h-12 w-12 text-[#606060] mb-4" />
				<div className="text-center mb-6 space-y-2">
					<h2 className="font-medium text-lg text-[#606060]">No results</h2>
					<p className="text-[#606060] text-sm">
						Try another search term or adjust your filters
					</p>
				</div>

				<Button
					variant="outline"
					onClick={() => setFilter({ q: null, tags: null, start: null, end: null })}
				>
					Clear search
				</Button>
			</div>
		</div>
	);
}

