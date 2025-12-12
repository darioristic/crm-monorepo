"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  targetFields: { key: string; label: string; required?: boolean }[];
  onImport: (data: Record<string, unknown>[], mappings: FieldMapping[]) => Promise<void>;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  parseFile?: (file: File) => Promise<{ headers: string[]; rows: Record<string, unknown>[] }>;
}

export function ImportModal({
  open,
  onOpenChange,
  title = "Import Data",
  description = "Upload a CSV or Excel file to import data",
  targetFields,
  onImport,
  acceptedFileTypes = [".csv", ".xlsx", ".xls"],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  parseFile,
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setSourceHeaders([]);
    setParsedData([]);
    setMappings([]);
    setError(null);
    setProgress(0);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const defaultParseCSV = async (
    file: File
  ): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> => {
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("File is empty");
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });

    return { headers, rows };
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;

      if (selectedFile.size > maxFileSize) {
        setError(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
        return;
      }

      setFile(selectedFile);
      setError(null);

      try {
        const parser = parseFile || defaultParseCSV;
        const { headers, rows } = await parser(selectedFile);

        setSourceHeaders(headers);
        setParsedData(rows);

        // Auto-map fields with matching names
        const autoMappings: FieldMapping[] = targetFields
          .map((target) => {
            const matchingSource = headers.find(
              (h) =>
                h.toLowerCase() === target.key.toLowerCase() ||
                h.toLowerCase() === target.label.toLowerCase()
            );
            return {
              sourceField: matchingSource || "",
              targetField: target.key,
            };
          })
          .filter((m) => m.sourceField);

        setMappings(autoMappings);
        setStep("mapping");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      }
    },
    [maxFileSize, parseFile, targetFields]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: 1,
  });

  const updateMapping = (targetField: string, sourceField: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.targetField === targetField);
      if (existing) {
        return prev.map((m) => (m.targetField === targetField ? { ...m, sourceField } : m));
      }
      return [...prev, { targetField, sourceField }];
    });
  };

  const getMappedValue = (targetField: string) => {
    return mappings.find((m) => m.targetField === targetField)?.sourceField || "";
  };

  const validateMappings = () => {
    const requiredFields = targetFields.filter((f) => f.required);
    const missingRequired = requiredFields.filter((f) => !getMappedValue(f.key));
    return missingRequired.length === 0;
  };

  const handleImport = async () => {
    if (!validateMappings()) {
      setError("Please map all required fields");
      return;
    }

    setStep("importing");
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await onImport(parsedData, mappings);

      clearInterval(progressInterval);
      setProgress(100);
      setImportResult({ success: parsedData.length, failed: 0 });
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("mapping");
    }
  };

  const renderStep = () => {
    switch (step) {
      case "upload":
        return (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                "flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <div className="rounded-full bg-muted p-4">
                <Upload className="size-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">
                  {isDragActive ? "Drop the file here" : "Drag & drop a file here"}
                </p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Accepted formats: {acceptedFileTypes.join(", ")} (max {maxFileSize / 1024 / 1024}MB)
              </p>
            </div>
          </div>
        );

      case "mapping":
        return (
          <div className="space-y-4">
            {file && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <FileSpreadsheet className="size-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{parsedData.length} rows found</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setStep("upload");
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              <p className="text-sm font-medium">Map your columns</p>
              {targetFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <Label className="flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </Label>
                  </div>
                  <ArrowLeft className="size-4 text-muted-foreground" />
                  <Select
                    value={getMappedValue(field.key)}
                    onValueChange={(value) => updateMapping(field.key, value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {sourceHeaders.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );

      case "importing":
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Importing data...</p>
              <p className="text-sm text-muted-foreground">
                Please wait while we process your file
              </p>
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
              <p className="font-medium">Import Complete</p>
              {importResult && (
                <p className="text-sm text-muted-foreground">
                  Successfully imported {importResult.success} records
                  {importResult.failed > 0 && ` (${importResult.failed} failed)`}
                </p>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
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
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setStep("upload");
                }}
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={!validateMappings()}>
                Import {parsedData.length} rows
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </>
          )}

          {step === "complete" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
