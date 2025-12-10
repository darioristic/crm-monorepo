"use client";

import { motion } from "framer-motion";
import { Download, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDocumentsStore } from "@/store/vault-store";

type Props = {
  data: string[];
};

export function BottomBar({ data }: Props) {
  const { clearSelection } = useDocumentsStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (data.length === 0) return;

    setIsDownloading(true);
    try {
      // For now, just show a toast - implementing zip download would require backend changes
      toast({
        title: "Download started",
        description: `Downloading ${data.length} file(s)`,
      });
    } catch (_error) {
      toast({
        title: "Download failed",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      className="z-50 fixed flex h-10 items-center justify-between px-4 bottom-4 left-1/2 bg-secondary rounded-lg border shadow-lg"
      initial={{ y: 100, x: "-50%" }}
      animate={{ y: 0, x: "-50%" }}
      exit={{ y: 100, x: "-50%" }}
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelection}>
          <X className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium whitespace-nowrap">{data.length} selected</span>
      </div>

      <div className="w-px h-6 bg-border mx-3" />

      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download
      </Button>
    </motion.div>
  );
}
