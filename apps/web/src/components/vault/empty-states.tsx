"use client";

import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export function NoResults() {
	const { setFilter } = useDocumentFilterParams();

	return (
		<div className="h-[calc(100vh-300px)] w-full flex items-center justify-center flex-col">
			<div className="flex flex-col items-center">
				<div className="mb-4 p-3 rounded-full bg-muted">
					<SearchX className="h-8 w-8 text-muted-foreground" />
				</div>
				<div className="text-center mb-6 space-y-2">
					<h2 className="font-medium text-lg">No results</h2>
					<p className="text-muted-foreground text-sm">
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

