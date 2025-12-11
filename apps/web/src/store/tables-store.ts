import type { Column, RowSelectionState, Updater } from "@tanstack/react-table";
import { create } from "zustand";

interface TablesState {
  // Invoices table
  invoiceRowSelection: RowSelectionState;
  setInvoiceRowSelection: (updater: Updater<RowSelectionState>) => void;
  invoiceColumns: Column<unknown, unknown>[];
  setInvoiceColumns: (columns?: Column<unknown, unknown>[]) => void;

  // Contacts/Companies table
  contactRowSelection: RowSelectionState;
  setContactRowSelection: (updater: Updater<RowSelectionState>) => void;
  contactColumns: Column<unknown, unknown>[];
  setContactColumns: (columns?: Column<unknown, unknown>[]) => void;

  // Quotes table
  quoteRowSelection: RowSelectionState;
  setQuoteRowSelection: (updater: Updater<RowSelectionState>) => void;
  quoteColumns: Column<unknown, unknown>[];
  setQuoteColumns: (columns?: Column<unknown, unknown>[]) => void;

  // Orders table
  orderRowSelection: RowSelectionState;
  setOrderRowSelection: (updater: Updater<RowSelectionState>) => void;
  orderColumns: Column<unknown, unknown>[];
  setOrderColumns: (columns?: Column<unknown, unknown>[]) => void;

  // Generic clear all selections
  clearAllSelections: () => void;
}

export const useTablesStore = create<TablesState>()((set) => ({
  // Invoices
  invoiceRowSelection: {},
  setInvoiceRowSelection: (updater) =>
    set((state) => ({
      invoiceRowSelection:
        typeof updater === "function" ? updater(state.invoiceRowSelection) : updater,
    })),
  invoiceColumns: [],
  setInvoiceColumns: (columns) => set({ invoiceColumns: columns || [] }),

  // Contacts
  contactRowSelection: {},
  setContactRowSelection: (updater) =>
    set((state) => ({
      contactRowSelection:
        typeof updater === "function" ? updater(state.contactRowSelection) : updater,
    })),
  contactColumns: [],
  setContactColumns: (columns) => set({ contactColumns: columns || [] }),

  // Quotes
  quoteRowSelection: {},
  setQuoteRowSelection: (updater) =>
    set((state) => ({
      quoteRowSelection: typeof updater === "function" ? updater(state.quoteRowSelection) : updater,
    })),
  quoteColumns: [],
  setQuoteColumns: (columns) => set({ quoteColumns: columns || [] }),

  // Orders
  orderRowSelection: {},
  setOrderRowSelection: (updater) =>
    set((state) => ({
      orderRowSelection: typeof updater === "function" ? updater(state.orderRowSelection) : updater,
    })),
  orderColumns: [],
  setOrderColumns: (columns) => set({ orderColumns: columns || [] }),

  // Clear all
  clearAllSelections: () =>
    set({
      invoiceRowSelection: {},
      contactRowSelection: {},
      quoteRowSelection: {},
      orderRowSelection: {},
    }),
}));

// Helper hook for getting selected IDs
export function useSelectedIds(rowSelection: RowSelectionState, data: { id: string }[]): string[] {
  return Object.entries(rowSelection)
    .filter(([_, isSelected]) => isSelected)
    .map(([index]) => data[Number.parseInt(index, 10)]?.id)
    .filter(Boolean) as string[];
}
