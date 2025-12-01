"use client";

import { VaultItemTags } from "./vault-item-tags";
import { VaultItemActions } from "./vault-item-actions";
import { useDocumentParams } from "@/hooks/use-document-params";
import type { DocumentWithTags } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FilePreview } from "@/components/file-preview";

type Props = {
	data: DocumentWithTags;
	small?: boolean;
};

export function VaultItem({ data, small }: Props) {
	const { setParams } = useDocumentParams();

	const isLoading = data.processingStatus === "pending";

	return (
		<div
			className={cn(
				"h-72 border relative flex text-muted-foreground p-4 flex-col gap-3 hover:bg-muted dark:hover:bg-[#141414] transition-colors duration-200 group cursor-pointer",
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
					"w-[60px] h-[84px] flex items-center justify-center overflow-hidden",
					small && "w-[45px] h-[63px]"
				)}
			>
				{isLoading ? (
					<Skeleton className="w-full h-full" />
				) : (
					<FilePreview
						mimetype={data.metadata?.mimetype}
						name={data.name}
						filePath={data.pathTokens}
						small={small}
					/>
				)}
			</div>

			<div className="flex flex-col text-left flex-1 min-h-0">
				<h2 className="text-sm text-primary line-clamp-1 mb-1 font-medium">
					{isLoading ? (
						<Skeleton className="w-[80%] h-4" />
					) : (
						data?.title ?? data?.name?.split("/").pop() ?? "Untitled"
					)}
				</h2>

				{isLoading ? (
					<Skeleton className="w-[50%] h-3 mt-1" />
				) : (
					<p className="text-xs text-muted-foreground line-clamp-3">
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

