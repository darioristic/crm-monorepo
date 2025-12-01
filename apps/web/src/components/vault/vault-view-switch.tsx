"use client";

import { useDocumentParams } from "@/hooks/use-document-params";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Grid3X3, List } from "lucide-react";

export function VaultViewSwitch() {
	const { params, setParams } = useDocumentParams();

	return (
		<div className="flex gap-1 text-muted-foreground">
			<Button
				variant="outline"
				size="icon"
				className={cn(
					"h-9 w-9",
					params.view === "grid" && "border-primary text-primary"
				)}
				onClick={() => setParams({ view: "grid" })}
			>
				<Grid3X3 className="h-4 w-4" />
			</Button>

			<Button
				variant="outline"
				size="icon"
				className={cn(
					"h-9 w-9",
					params.view === "list" && "border-primary text-primary"
				)}
				onClick={() => setParams({ view: "list" })}
			>
				<List className="h-4 w-4" />
			</Button>
		</div>
	);
}

