"use client";

import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

function ErrorImage() {
	return (
		<div className="w-full h-full flex items-center justify-center bg-muted/50">
			<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
				<ImageOff className="size-8" />
				<span className="text-sm">Failed to load image</span>
			</div>
		</div>
	);
}

export function ImageViewer({ url }: { url: string }) {
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);

	if (!url) return <ErrorImage />;

	return (
		<div className="relative flex h-full w-full items-center justify-center bg-muted/20 rounded-lg overflow-hidden">
			{isLoading && !isError && (
				<Skeleton className="absolute inset-0 h-full w-full" />
			)}

			{isError && <ErrorImage />}

			<img
				src={url}
				alt="Document preview"
				className={cn(
					"max-h-full max-w-full object-contain",
					isLoading ? "opacity-0" : "opacity-100",
				)}
				onLoad={() => setIsLoading(false)}
				onError={() => setIsError(true)}
			/>
		</div>
	);
}

