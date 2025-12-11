"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentActions } from "@/components/document-actions";
import { DocumentDetailsSkeleton } from "@/components/document-details-skeleton";
import { DocumentTags } from "@/components/document-tags";
import { FileViewer } from "@/components/file-viewer";
import { SheetHeader } from "@/components/ui/sheet";
import { VaultRelatedFiles } from "@/components/vault/vault-related-files";
import { useDocumentParams } from "@/hooks/use-document-params";
import { type DocumentWithTags, documentsApi } from "@/lib/api";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
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
      return response.data ?? null;
    },
    enabled: isOpen && !!params.documentId,
    staleTime: 0,
    placeholderData: () => {
      // Try to get placeholder data from the documents list cache
      const documentsData = queryClient.getQueryData<{
        pages: Array<{ data: DocumentWithTags[] }>;
      }>(["documents"]);

      if (documentsData?.pages) {
        const allDocs = documentsData.pages.flatMap((page) => page.data ?? []);
        return allDocs.find(
          (d) => d.id === params.documentId || d.pathTokens?.join("/") === params.filePath
        );
      }
      return undefined;
    },
  });

  if (isLoading) {
    return <DocumentDetailsSkeleton />;
  }

  return (
    <div className="flex flex-col flex-grow min-h-0 relative h-full w-full">
      <SheetHeader className="mb-4 flex justify-between items-center flex-row">
        <div className="min-w-0 flex-1 max-w-[70%] flex flex-row gap-2 items-baseline">
          <h2 className="text-lg font-semibold truncate">
            {data?.title ||
              (data?.metadata?.originalName as string) ||
              data?.pathTokens?.at(-1) ||
              data?.name ||
              "Untitled Document"}
          </h2>
          <span className="text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">
            {data?.metadata?.size && formatSize(data.metadata.size as number)}
          </span>
        </div>

        <DocumentActions showDelete={fullView} filePath={data?.pathTokens} />
      </SheetHeader>

      <div className="h-full max-h-[763px] p-0 pb-4 overflow-auto scrollbar-hide">
        <div className="flex flex-col flex-grow min-h-0 relative w-full items-center justify-center">
          <FileViewer
            url={`/api/v1/documents/view/${data?.pathTokens?.join("/")}`}
            mimeType={data?.metadata?.mimetype as string | undefined}
            maxWidth={565}
          />
        </div>
      </div>

      <div>
        {data?.summary && (
          <p className="text-sm text-[#878787] mb-4 line-clamp-2">{data?.summary}</p>
        )}

        {data?.id && <DocumentTags tags={data?.documentTagAssignments} id={data.id} />}

        {fullView && <VaultRelatedFiles />}
      </div>
    </div>
  );
}
