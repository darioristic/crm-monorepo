"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, ExternalLink, Download } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { toast } from "sonner";

type Props = {
  onClose?: () => void;
};

export function InvoiceSuccess({ onClose }: Props) {
  const { watch } = useFormContext();
  const [, copy] = useCopyToClipboard();

  const token = watch("token");
  const invoiceNumber = watch("invoiceNumber");

  const invoiceUrl = token ? `${window.location.origin}/i/${token}` : "";

  const handleCopyLink = () => {
    if (invoiceUrl) {
      copy(invoiceUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDownload = () => {
    if (token) {
      window.open(`/api/download/invoice?token=${token}`, "_blank");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="mb-6">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">Invoice Created!</h2>
      <p className="text-muted-foreground mb-8">
        Invoice {invoiceNumber} has been created successfully.
      </p>

      {token && (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Invoice Link</p>
            <p className="text-sm font-mono truncate">{invoiceUrl}</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(invoiceUrl, "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}

      <Button onClick={onClose} className="mt-8">
        Close
      </Button>
    </div>
  );
}

