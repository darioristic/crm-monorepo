"use client";

import { useState } from "react";
import { DownloadIcon, FileSpreadsheetIcon, FileIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToCSV, exportToPDF, type ColumnDef } from "@/lib/export";

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  columns: ColumnDef<T>[];
  elementId?: string;
  pdfOptions?: {
    title?: string;
    dateRange?: string;
    filters?: string;
  };
  className?: string;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  elementId,
  pdfOptions,
  className,
  disabled = false,
}: ExportButtonProps<T>) {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const handleExportCSV = () => {
    setExporting("csv");
    try {
      exportToCSV(data, filename, columns);
    } finally {
      setTimeout(() => setExporting(null), 500);
    }
  };

  const handleExportPDF = async () => {
    if (!elementId) return;
    
    setExporting("pdf");
    try {
      await exportToPDF(elementId, filename, pdfOptions);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={disabled || exporting !== null}
        >
          {exporting ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} disabled={data.length === 0}>
          <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        {elementId && (
          <DropdownMenuItem onClick={handleExportPDF}>
            <FileIcon className="mr-2 h-4 w-4" />
            Export as PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

