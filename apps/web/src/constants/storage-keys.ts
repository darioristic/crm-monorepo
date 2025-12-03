/**
 * LocalStorage keys used throughout the application
 */
export const STORAGE_KEYS = {
  INVOICE_FROM_DETAILS: "invoice_from_details",
  INVOICE_FROM_LABEL: "invoice_from_label",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

