"use client";

import { VaultItemTags } from "./vault-item-tags";
import { VaultItemActions } from "./vault-item-actions";
import { useDocumentParams } from "@/hooks/use-document-params";
import type { DocumentWithTags } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FileImage, FileSpreadsheet, File } from "lucide-react";

type Props = {
	data: DocumentWithTags;
	small?: boolean;
};

function getFileIcon(mimetype?: string) {
	if (!mimetype) return File;
	if (mimetype.startsWith("image/")) return FileImage;
	if (mimetype === "application/pdf") return FileText;
	if (
		mimetype.includes("spreadsheet") ||
		mimetype.includes("excel") ||
		mimetype === "text/csv"
	)
		return FileSpreadsheet;
	return FileText;
}

export function VaultItem({ data, small }: Props) {
	const { setParams } = useDocumentParams();

	const isLoading = data.processingStatus === "pending";
	const Icon = getFileIcon(data.metadata?.mimetype);

	return (
		<div
			className={cn(
				"h-64 border rounded-lg relative flex text-muted-foreground p-4 flex-col gap-3 hover:bg-muted/50 transition-colors duration-200 group cursor-pointer",
				small && "h-48"
			)}
			onClick={() => setParams({ documentId: data.id })}
		>
			<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
				<VaultItemActions
					id={data.id}
					filePath={data.pathTokens ?? []}
					hideDelete={small}
				/>
			</div>

			<div
				className={cn(
					"w-14 h-20 flex items-center justify-center bg-muted rounded",
					small && "w-10 h-14"
				)}
			>
				{isLoading ? (
					<Skeleton className="w-full h-full" />
				) : (
					<Icon className="h-8 w-8 text-muted-foreground" />
				)}
			</div>

			<div className="flex flex-col text-left flex-1 min-h-0">
				<h2 className="text-sm text-foreground line-clamp-1 mb-1 font-medium">
					{isLoading ? (
						<Skeleton className="w-[80%] h-4" />
					) : (
						data?.title ?? data?.name?.split("/").pop() ?? "Untitled"
					)}
				</h2>

				{isLoading ? (
					<Skeleton className="w-[50%] h-3 mt-1" />
				) : (
					<p className="text-xs text-muted-foreground line-clamp-2">
						{data?.summary ?? "No description"}
					</p>
				)}
			</div>

			{!small && (
				<VaultItemTags
					tags={data?.documentTagAssignments ?? []}
					isLoading={isLoading}
				/>
			)}
		</div>
	);
}

