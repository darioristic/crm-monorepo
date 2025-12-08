"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DocumentActions } from "@/components/document-actions";
import { DocumentDetailsSkeleton } from "@/components/document-details-skeleton";
import { DocumentTags } from "@/components/document-tags";
import { FileViewer } from "@/components/file-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { VaultRelatedFiles } from "@/components/vault/vault-related-files";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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
          (d) => d.id === params.documentId || d.pathTokens?.join("/") === params.filePath
        );
      }
      return undefined;
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    if (data) {
      setTitle(data.title ?? data.name?.split("/").at(-1) ?? "");
      setSummary(data.summary ?? "");
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const id = params.documentId!;
      const payload: { title?: string; summary?: string } = {};
      const t = title?.trim();
      const s = summary?.trim();
      if (t) payload.title = t;
      if (s) payload.summary = s;
      const response = await documentsApi.update(id, payload);
      if (!response.success) {
        throw new Error(response.error?.message || "Update failed");
      }
      return response;
    },
    onSuccess: (response) => {
      const updated = response.data;
      if (updated) {
        queryClient.setQueryData(["document", params.documentId], updated);
        const docsCache = queryClient.getQueryData<{
          pages: Array<{ data: DocumentWithTags[] }>;
        }>(["documents"]);
        if (docsCache?.pages) {
          const newPages = docsCache.pages.map((page) => ({
            data: (page.data ?? []).map((d) =>
              d.id === updated.id ? { ...d, title: updated.title, summary: updated.summary } : d
            ),
          }));
          queryClient.setQueryData(["documents"], { pages: newPages });
        }
      }
      toast({
        title: "Dokument sačuvan",
        description: "Izmene su uspešno sačuvane",
      });
      setIsEditing(false);
    },
    onError: (_error: unknown) => {
      toast({
        title: "Greška pri čuvanju",
        description: "Nije moguće sačuvati izmene. Pokušajte ponovo.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !data) {
    return <DocumentDetailsSkeleton />;
  }

  const fileUrl = data.pathTokens ? documentsApi.getDownloadUrl(data.pathTokens) : "";

  const mimetype = data.metadata?.mimetype as string | undefined;
  const size = data.metadata?.size as number | undefined;

  return (
    <div className="flex flex-col flex-grow min-h-0 relative h-full w-full p-6">
      <SheetHeader className="mb-4 flex justify-between items-center flex-row space-y-0">
        <div className="min-w-0 flex-1 max-w-[70%] flex flex-row gap-2 items-baseline">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naziv dokumenta"
            />
          ) : (
            <SheetTitle className="text-lg truncate flex-0">
              {data.title ?? data.name?.split("/").at(-1) ?? "Untitled"}
            </SheetTitle>
          )}
          {size && (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatSize(size)}
            </span>
          )}
        </div>

        <div className="flex flex-row gap-2 items-center">
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Izmeni
            </Button>
          ) : (
            <div className="flex flex-row gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Sačuvaj"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setTitle(data.title ?? data.name?.split("/").at(-1) ?? "");
                  setSummary(data.summary ?? "");
                }}
              >
                Otkaži
              </Button>
            </div>
          )}
          <DocumentActions showDelete={fullView} filePath={data.pathTokens} />
        </div>
      </SheetHeader>

      {/* File preview */}
      <div className="h-full max-h-[500px] p-0 pb-4 overflow-x-auto">
        <div className="flex flex-col flex-grow min-h-0 relative h-full w-full items-center justify-center">
          <FileViewer url={fileUrl} mimeType={mimetype} maxWidth={565} />
        </div>
      </div>

      <div className="mt-4">
        {isEditing ? (
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Kratak opis"
            className="mb-4"
          />
        ) : (
          data.summary && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{data.summary}</p>
          )
        )}

        <DocumentTags tags={data.documentTagAssignments} id={data.id} />

        {fullView && <VaultRelatedFiles />}
      </div>
    </div>
  );
}
