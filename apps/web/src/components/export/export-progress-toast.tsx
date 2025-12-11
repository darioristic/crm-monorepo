"use client";

import { AlertCircle, CheckCircle2, Download, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useExportStore } from "@/store/export-store";

export function ExportProgressToast() {
  const { status, progress, fileName, fileUrl, error, totalItems, processedItems, resetExport } =
    useExportStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status !== "idle") {
      setIsVisible(true);
    }
  }, [status]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(resetExport, 300); // Wait for animation
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName || "export.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    handleClose();
  };

  if (!isVisible || status === "idle") return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[360px] rounded-lg border bg-background shadow-lg transition-all duration-300",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {status === "preparing" && <Loader2 className="size-5 animate-spin text-primary" />}
            {status === "exporting" && <Loader2 className="size-5 animate-spin text-primary" />}
            {status === "completed" && <CheckCircle2 className="size-5 text-green-500" />}
            {status === "failed" && <AlertCircle className="size-5 text-destructive" />}
            <div>
              <p className="font-medium text-sm">
                {status === "preparing" && "Preparing export..."}
                {status === "exporting" && "Exporting data..."}
                {status === "completed" && "Export completed"}
                {status === "failed" && "Export failed"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status === "preparing" && "Gathering data..."}
                {status === "exporting" && `${processedItems} of ${totalItems} items processed`}
                {status === "completed" && `${totalItems} items exported successfully`}
                {status === "failed" && error}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-6 -mr-1 -mt-1" onClick={handleClose}>
            <X className="size-4" />
          </Button>
        </div>

        {(status === "preparing" || status === "exporting") && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1 text-right">{progress}%</p>
          </div>
        )}

        {status === "completed" && fileUrl && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1 gap-2" onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </Button>
          </div>
        )}

        {status === "failed" && (
          <div className="mt-3">
            <Button size="sm" variant="outline" className="w-full" onClick={handleClose}>
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
