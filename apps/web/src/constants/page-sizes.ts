/**
 * Page size constants for PDF and document rendering
 */
export const PAGE_SIZES = {
  A4: { width: 595, height: 842 },
  LETTER: { width: 612, height: 792 },
} as const;

export type PageSize = keyof typeof PAGE_SIZES;

