import { create } from "zustand";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportStatus = "idle" | "preparing" | "exporting" | "completed" | "failed";

interface ExportState {
  status: ExportStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  fileName: string | null;
  fileUrl: string | null;
  error: string | null;

  // Actions
  startExport: (totalItems: number, fileName: string) => void;
  updateProgress: (processedItems: number) => void;
  completeExport: (fileUrl: string) => void;
  failExport: (error: string) => void;
  resetExport: () => void;
}

export const useExportStore = create<ExportState>()((set, get) => ({
  status: "idle",
  progress: 0,
  totalItems: 0,
  processedItems: 0,
  fileName: null,
  fileUrl: null,
  error: null,

  startExport: (totalItems, fileName) =>
    set({
      status: "preparing",
      progress: 0,
      totalItems,
      processedItems: 0,
      fileName,
      fileUrl: null,
      error: null,
    }),

  updateProgress: (processedItems) => {
    const { totalItems } = get();
    const progress = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;
    set({
      status: "exporting",
      processedItems,
      progress,
    });
  },

  completeExport: (fileUrl) =>
    set({
      status: "completed",
      progress: 100,
      fileUrl,
    }),

  failExport: (error) =>
    set({
      status: "failed",
      error,
    }),

  resetExport: () =>
    set({
      status: "idle",
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      fileName: null,
      fileUrl: null,
      error: null,
    }),
}));
