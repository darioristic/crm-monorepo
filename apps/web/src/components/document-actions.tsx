"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Loader2, Trash } from "lucide-react";
import { useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useToast } from "@/hooks/use-toast";
import { documentsApi } from "@/lib/api";

type Props = {
  showDelete?: boolean;
  filePath?: string[] | null;
};

export function DocumentActions({ showDelete = false, filePath }: Props) {
  const [, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setParams, params } = useDocumentParams();

  const filename = filePath?.at(-1);

  const handleDownload = () => {
    if (filePath && filename) {
      const downloadUrl = documentsApi.getDownloadUrl(filePath);
      window.open(downloadUrl, "_blank");
    }
  };

  const handleCopyLink = async () => {
    if (filePath) {
      const downloadUrl = documentsApi.getDownloadUrl(filePath);
      const fullUrl = `${window.location.origin}${downloadUrl}`;
      await copy(fullUrl);
      setIsCopied(true);
      toast({
        title: "Link copied",
        description: "Download link copied to clipboard",
      });
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await documentsApi.delete(params.documentId!);
      if (!response.success) {
        throw new Error(response.error?.message || "Delete failed");
      }
      return response;
    },
    onSuccess: () => {
      setParams({ documentId: null, filePath: null });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been permanently deleted",
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : undefined;
      toast({
        title: "Failed to delete",
        description: message || "Could not delete the document. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-row gap-1">
      <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
        <Download className="size-4" />
      </Button>

      <Button variant="ghost" size="icon" onClick={handleCopyLink} title="Copy link">
        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>

      {showDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteDocumentMutation.mutate()}
          disabled={deleteDocumentMutation.isPending}
          title="Delete"
        >
          {deleteDocumentMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash className="size-4" />
          )}
        </Button>
      )}
    </div>
  );
}
