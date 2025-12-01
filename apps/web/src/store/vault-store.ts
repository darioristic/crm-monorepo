"use client";

import { create } from "zustand";
import type { RowSelectionState, Updater } from "@tanstack/react-table";

// ============================================
// Documents Selection Store
// ============================================

interface DocumentsState {
	rowSelection: Record<string, boolean>;
	setRowSelection: (updater: Updater<RowSelectionState>) => void;
	clearSelection: () => void;
}

export const useDocumentsStore = create<DocumentsState>()((set) => ({
	rowSelection: {},

	setRowSelection: (updater: Updater<RowSelectionState>) =>
		set((state) => ({
			rowSelection:
				typeof updater === "function" ? updater(state.rowSelection) : updater,
		})),

	clearSelection: () => set({ rowSelection: {} }),
}));

// ============================================
// Document Details Sheet Store
// ============================================

interface DocumentDetailsState {
	isOpen: boolean;
	documentId: string | null;
	open: (documentId: string) => void;
	close: () => void;
}

export const useDocumentDetailsStore = create<DocumentDetailsState>((set) => ({
	isOpen: false,
	documentId: null,

	open: (documentId: string) =>
		set({
			isOpen: true,
			documentId,
		}),

	close: () =>
		set({
			isOpen: false,
			documentId: null,
		}),
}));

// ============================================
// Upload Progress Store
// ============================================

interface UploadProgressState {
	isUploading: boolean;
	progress: number;
	fileCount: number;
	startUpload: (fileCount: number) => void;
	updateProgress: (progress: number) => void;
	finishUpload: () => void;
	reset: () => void;
}

export const useUploadProgressStore = create<UploadProgressState>((set) => ({
	isUploading: false,
	progress: 0,
	fileCount: 0,

	startUpload: (fileCount: number) =>
		set({
			isUploading: true,
			progress: 0,
			fileCount,
		}),

	updateProgress: (progress: number) =>
		set({
			progress: Math.min(100, Math.max(0, progress)),
		}),

	finishUpload: () =>
		set({
			isUploading: false,
			progress: 100,
		}),

	reset: () =>
		set({
			isUploading: false,
			progress: 0,
			fileCount: 0,
		}),
}));

