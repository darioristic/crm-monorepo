"use client";

import { Check, Copy, Download, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { documentsApi } from "@/lib/api";
import { DeleteVaultFileDialog } from "./delete-vault-file-dialog";
import { ShareDocumentDialog } from "./share-document-dialog";

type Props = {
  id: string;
  filePath: string[];
  title?: string | null;
  hideDelete?: boolean;
  hideShare?: boolean;
};

export function VaultItemActions({ id, filePath, title, hideDelete, hideShare }: Props) {
  const [copiedText, copy] = useCopyToClipboard();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const downloadUrl = documentsApi.getDownloadUrl(filePath);
  const fileName = filePath.at(-1);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    const fullUrl = window.location.origin + downloadUrl;
    await copy(fullUrl);
  };

  return (
    <div className="flex flex-row gap-1">
      <Button
        variant="outline"
        size="icon"
        className="rounded-full h-7 w-7 bg-background"
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
      >
        <Download className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          await handleCopyLink();
        }}
        className="rounded-full h-7 w-7 bg-background"
      >
        {copiedText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>

      {!hideShare && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
        >
          <ShareDocumentDialog
            documentId={id}
            documentTitle={title}
            trigger={
              <Button variant="outline" size="icon" className="rounded-full h-7 w-7 bg-background">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      )}

      {!hideDelete && (
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-7 w-7 bg-background"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteDialog(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      <DeleteVaultFileDialog
        id={id}
        filePath={filePath}
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
}
