"use client";

import { useExportStore, type ExportFormat } from "@/store/export-store";
import { useCallback } from "react";

type ExportOptions<T> = {
  data: T[];
  fileName: string;
  format?: ExportFormat;
  columns?: { key: keyof T; label: string }[];
  batchSize?: number;
};

export function useExport<T extends Record<string, unknown>>() {
  const { startExport, updateProgress, completeExport, failExport, status } =
    useExportStore();

  const exportToCSV = useCallback(
    async ({
      data,
      fileName,
      columns,
      batchSize = 100,
    }: ExportOptions<T>) => {
      if (data.length === 0) {
        failExport("No data to export");
        return;
      }

      try {
        startExport(data.length, `${fileName}.csv`);

        // Build CSV header
        const headers = columns
          ? columns.map((col) => col.label)
          : Object.keys(data[0] || {});

        const keys = columns
          ? columns.map((col) => col.key)
          : (Object.keys(data[0] || {}) as (keyof T)[]);

        // Process in batches for large datasets
        const csvRows: string[] = [headers.join(",")];
        let processed = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);

          for (const row of batch) {
            const values = keys.map((key) => {
              const value = row[key];
              if (value === null || value === undefined) return "";
              const stringValue = String(value);
              // Escape quotes and wrap in quotes if contains comma, quote, or newline
              if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            });
            csvRows.push(values.join(","));
            processed++;
          }

          updateProgress(processed);

          // Allow UI to update between batches
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        completeExport(url);
      } catch (error) {
        failExport(error instanceof Error ? error.message : "Export failed");
      }
    },
    [startExport, updateProgress, completeExport, failExport]
  );

  const exportToJSON = useCallback(
    async ({ data, fileName }: Omit<ExportOptions<T>, "columns">) => {
      if (data.length === 0) {
        failExport("No data to export");
        return;
      }

      try {
        startExport(data.length, `${fileName}.json`);
        updateProgress(data.length);

        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], {
          type: "application/json;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);

        completeExport(url);
      } catch (error) {
        failExport(error instanceof Error ? error.message : "Export failed");
      }
    },
    [startExport, updateProgress, completeExport, failExport]
  );

  return {
    exportToCSV,
    exportToJSON,
    isExporting: status === "preparing" || status === "exporting",
    status,
  };
}
