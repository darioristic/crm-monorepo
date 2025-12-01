"use client";

import { DocumentActions } from "@/components/document-actions";
import { DocumentDetailsSkeleton } from "@/components/document-details-skeleton";
import { DocumentTags } from "@/components/document-tags";
import { FileViewer } from "@/components/file-viewer";
import { VaultRelatedFiles } from "@/components/vault/vault-related-files";
import { useDocumentParams } from "@/hooks/use-document-params";
import { documentsApi, type DocumentWithTags } from "@/lib/api";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function formatSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function DocumentDetails() {
	const queryClient = useQueryClient();
	const { params } = useDocumentParams();

	const isOpen = Boolean(params.filePath || params.documentId);
	const fullView = Boolean(params.documentId);

	const { data, isLoading } = useQuery({
		queryKey: ["document", params.documentId],
		queryFn: async () => {
			if (!params.documentId) return null;
			const response = await documentsApi.getById(params.documentId);
			return response.data;
		},
		enabled: isOpen && !!params.documentId,
		staleTime: 0,
		initialData: () => {
			// Try to get initial data from the documents list cache
			const documentsData = queryClient.getQueryData<{
				pages: Array<{ data: DocumentWithTags[] }>;
			}>(["documents"]);

			if (documentsData?.pages) {
				const allDocs = documentsData.pages.flatMap((page) => page.data ?? []);
				return allDocs.find(
					(d) =>
						d.id === params.documentId ||
						d.pathTokens?.join("/") === params.filePath,
				);
			}
			return undefined;
		},
	});

	if (isLoading || !data) {
		return <DocumentDetailsSkeleton />;
	}

	const fileUrl = data.pathTokens
		? documentsApi.getDownloadUrl(data.pathTokens)
		: "";

	const mimetype = data.metadata?.mimetype as string | undefined;
	const size = data.metadata?.size as number | undefined;

	return (
		<div className="flex flex-col flex-grow min-h-0 relative h-full w-full p-6">
			<SheetHeader className="mb-4 flex justify-between items-center flex-row space-y-0">
				<div className="min-w-0 flex-1 max-w-[70%] flex flex-row gap-2 items-baseline">
					<SheetTitle className="text-lg truncate flex-0">
						{data.title ?? data.name?.split("/").at(-1) ?? "Untitled"}
					</SheetTitle>
					{size && (
						<span className="text-sm text-muted-foreground whitespace-nowrap">
							{formatSize(size)}
						</span>
					)}
				</div>

				<DocumentActions showDelete={fullView} filePath={data.pathTokens} />
			</SheetHeader>

			{/* File preview */}
			<div className="h-full max-h-[500px] p-0 pb-4 overflow-x-auto">
				<div className="flex flex-col flex-grow min-h-0 relative h-full w-full items-center justify-center">
					<FileViewer url={fileUrl} mimeType={mimetype} maxWidth={565} />
				</div>
			</div>

			{/* Summary */}
			<div className="mt-4">
				{data.summary && (
					<p className="text-sm text-muted-foreground mb-4 line-clamp-3">
						{data.summary}
					</p>
				)}

				{/* Tags */}
				<DocumentTags tags={data.documentTagAssignments} id={data.id} />

				{/* Related Files */}
				{fullView && <VaultRelatedFiles />}
			</div>
		</div>
	);
}

