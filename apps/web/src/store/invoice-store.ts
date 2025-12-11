import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorDoc, InvoiceDefaultSettings, InvoiceTemplate } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

// Removed unused PersistedInvoiceSettings interface

interface InvoiceSettingsState {
  defaultSettings: InvoiceDefaultSettings;
  recentCustomers: string[];
  setDefaultSettings: (settings: Partial<InvoiceDefaultSettings>) => void;
  setTemplate: (template: Partial<InvoiceTemplate>) => void;
  setFromDetails: (fromDetails: EditorDoc | string | null) => void;
  setPaymentDetails: (paymentDetails: EditorDoc | string | null) => void;
  addRecentCustomer: (customerId: string) => void;
  reset: () => void;
}

const initialState: Omit<
  InvoiceSettingsState,
  | "setDefaultSettings"
  | "setTemplate"
  | "setFromDetails"
  | "setPaymentDetails"
  | "addRecentCustomer"
  | "reset"
> = {
  defaultSettings: {
    template: DEFAULT_INVOICE_TEMPLATE,
  },
  recentCustomers: [],
};

export const useInvoiceSettingsStore = create<InvoiceSettingsState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      setDefaultSettings: (settings) =>
        set((state) => {
          // Only allow persisting specific fields: template, fromDetails, paymentDetails
          const allowedKeys = ["template", "fromDetails", "paymentDetails"];
          const filteredSettings: Partial<InvoiceDefaultSettings> = {};

          for (const key of allowedKeys) {
            if (key in settings) {
              const value = settings[key as keyof InvoiceDefaultSettings];
              if (value !== undefined) {
                (filteredSettings as Record<string, unknown>)[key] = value;
              }
            }
          }

          return {
            defaultSettings: {
              ...state.defaultSettings,
              ...filteredSettings,
              template: {
                ...state.defaultSettings.template,
                ...(settings.template || {}),
              },
            },
          };
        }),

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

      setFromDetails: (fromDetails) =>
        set((state) => ({
          defaultSettings: {
            ...state.defaultSettings,
            fromDetails,
          },
        })),

      setPaymentDetails: (paymentDetails) =>
        set((state) => ({
          defaultSettings: {
            ...state.defaultSettings,
            paymentDetails,
          },
        })),

      addRecentCustomer: (customerId) =>
        set((state) => {
          const filtered = state.recentCustomers.filter((id) => id !== customerId);
          return {
            recentCustomers: [customerId, ...filtered].slice(0, 10),
          };
        }),

      reset: () => set(initialState),
    }),
    {
      name: "invoice-settings",
      // Only persist template and paymentDetails - NOT fromDetails (fetched from tenant)
      // fromDetails should always come fresh from the current tenant's company data
      partialize: (state) => ({
        defaultSettings: {
          template: state.defaultSettings.template,
          // fromDetails is NOT persisted - it's fetched from tenant via useInvoiceSettings hook
          paymentDetails: state.defaultSettings.paymentDetails,
        },
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
