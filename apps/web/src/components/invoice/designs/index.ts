// Invoice Designs - Migrated to Midday-style Form
// The new Midday-style form is the default and only design

export type InvoiceDesign = "midday";

export const INVOICE_DESIGNS: Record<InvoiceDesign, { name: string; description: string }> = {
  midday: {
    name: "Midday",
    description: "Moderan, profesionalan dizajn inspirisan Midday-em",
  },
};

export const DEFAULT_DESIGN: InvoiceDesign = "midday";
