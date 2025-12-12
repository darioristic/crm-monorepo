"use client";

import {
  AlertCircle,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type ExportFormat = "csv" | "xlsx" | "json" | "pdf";
type ExportStep = "configure" | "exporting" | "complete";

interface ExportField {
  key: string;
  label: string;
  defaultSelected?: boolean;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  fields: ExportField[];
  formats?: ExportFormat[];
  defaultFormat?: ExportFormat;
  onExport: (
    format: ExportFormat,
    selectedFields: string[]
  ) => Promise<{ url?: string; blob?: Blob; filename?: string }>;
  totalRecords?: number;
}

const formatConfig: Record<
  ExportFormat,
  { label: string; icon: typeof FileSpreadsheet; extension: string }
> = {
  csv: { label: "CSV", icon: FileSpreadsheet, extension: ".csv" },
  xlsx: { label: "Excel", icon: FileSpreadsheet, extension: ".xlsx" },
  json: { label: "JSON", icon: FileJson, extension: ".json" },
  pdf: { label: "PDF", icon: FileText, extension: ".pdf" },
};

export function ExportModal({
  open,
  onOpenChange,
  title = "Export Data",
  description = "Choose the format and fields to export",
  fields,
  formats = ["csv", "xlsx", "json"],
  defaultFormat = "csv",
  onExport,
  totalRecords,
}: ExportModalProps) {
  const [step, setStep] = useState<ExportStep>("configure");
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    fields.filter((f) => f.defaultSelected !== false).map((f) => f.key)
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("configure");
    setFormat(defaultFormat);
    setSelectedFields(fields.filter((f) => f.defaultSelected !== false).map((f) => f.key));
    setError(null);
    setProgress(0);
    setDownloadUrl(null);
  }, [defaultFormat, fields]);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey]
    );
  };

  const selectAllFields = () => {
    setSelectedFields(fields.map((f) => f.key));
  };

  const deselectAllFields = () => {
    setSelectedFields([]);
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      setError("Please select at least one field to export");
      return;
    }

    setStep("exporting");
    setProgress(0);
    setError(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 85));
      }, 200);

      const result = await onExport(format, selectedFields);

      clearInterval(progressInterval);
      setProgress(100);

      // Handle download
      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        setDownloadUrl(url);

        // Trigger download
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || `export${formatConfig[format].extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (result.url) {
        setDownloadUrl(result.url);
        window.open(result.url, "_blank");
      }

      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setStep("configure");
    }
  };

  const renderStep = () => {
    switch (step) {
      case "configure":
        return (
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label>Export Format</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as ExportFormat)}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {formats.map((fmt) => {
                  const config = formatConfig[fmt];
                  const Icon = config.icon;
                  return (
                    <label
                      key={fmt}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                        format === fmt ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      )}
                    >
                      <RadioGroupItem value={fmt} className="sr-only" />
                      <Icon className="size-6 text-muted-foreground" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Field Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fields to Export</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAllFields} className="text-xs">
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAllFields} className="text-xs">
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto rounded-lg border p-3">
                {fields.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFields.length} of {fields.length} fields selected
              </p>
            </div>

            {totalRecords !== undefined && (
              <p className="text-sm text-muted-foreground">
                {totalRecords.toLocaleString()} records will be exported
              </p>
            )}
          </div>
        );

      case "exporting":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Preparing your export...</p>
              <p className="text-sm text-muted-foreground">This may take a moment</p>
            </div>
            <Progress value={progress} className="w-full max-w-xs" />
          </div>
        );

      case "complete":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="rounded-full bg-green-500/10 p-4">
              <Check className="size-8 text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-medium">Export Complete</p>
              <p className="text-sm text-muted-foreground">Your file has been downloaded</p>
            </div>
            {downloadUrl && (
              <Button variant="outline" asChild>
                <a href={downloadUrl} download>
                  <Download className="mr-2 size-4" />
                  Download Again
                </a>
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {renderStep()}

        <DialogFooter>
          {step === "configure" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={selectedFields.length === 0}>
                <Download className="mr-2 size-4" />
                Export {formatConfig[format].label}
              </Button>
            </>
          )}

          {step === "complete" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing export state
export function useExportModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    isExporting,
    openModal,
    closeModal,
    setIsOpen,
    setIsExporting,
  };
}
