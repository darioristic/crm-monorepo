import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InvoiceTemplate, InvoiceDefaultSettings } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

interface InvoiceSettingsState {
  defaultSettings: InvoiceDefaultSettings;
  recentCustomers: string[];
  setDefaultSettings: (settings: Partial<InvoiceDefaultSettings>) => void;
  setTemplate: (template: Partial<InvoiceTemplate>) => void;
  addRecentCustomer: (customerId: string) => void;
  reset: () => void;
}

const initialState: Omit<
  InvoiceSettingsState,
  "setDefaultSettings" | "setTemplate" | "addRecentCustomer" | "reset"
> = {
  defaultSettings: {
    template: DEFAULT_INVOICE_TEMPLATE,
  },
  recentCustomers: [],
};

export const useInvoiceSettingsStore = create<InvoiceSettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDefaultSettings: (settings) =>
        set((state) => ({
          defaultSettings: {
            ...state.defaultSettings,
            ...settings,
            template: {
              ...state.defaultSettings.template,
              ...(settings.template || {}),
            },
          },
        })),

      setTemplate: (template) =>
        set((state) => ({
          defaultSettings: {
            ...state.defaultSettings,
            template: {
              ...state.defaultSettings.template,
              ...template,
            },
          },
        })),

      addRecentCustomer: (customerId) =>
        set((state) => {
          const filtered = state.recentCustomers.filter(
            (id) => id !== customerId
          );
          return {
            recentCustomers: [customerId, ...filtered].slice(0, 10),
          };
        }),

      reset: () => set(initialState),
    }),
    {
      name: "invoice-settings",
      partialize: (state) => ({
        defaultSettings: state.defaultSettings,
        recentCustomers: state.recentCustomers,
      }),
    }
  )
);

// Invoice sheet state store (non-persisted)
interface InvoiceSheetState {
  isOpen: boolean;
  type: "create" | "edit" | "success";
  invoiceId: string | null;
  open: (type?: "create" | "edit", invoiceId?: string) => void;
  close: () => void;
  setSuccess: (invoiceId: string) => void;
}

export const useInvoiceSheetStore = create<InvoiceSheetState>((set) => ({
  isOpen: false,
  type: "create",
  invoiceId: null,

  open: (type = "create", invoiceId) =>
    set({
      isOpen: true,
      type,
      invoiceId: invoiceId || null,
    }),

  close: () =>
    set({
      isOpen: false,
      invoiceId: null,
    }),

  setSuccess: (invoiceId) =>
    set({
      type: "success",
      invoiceId,
    }),
}));

