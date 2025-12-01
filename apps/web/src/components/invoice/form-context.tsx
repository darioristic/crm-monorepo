"use client";

import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  InvoiceFormValues,
  InvoiceDefaultSettings,
} from "@/types/invoice";
import {
  DEFAULT_INVOICE_TEMPLATE,
  generateInvoiceToken,
  generateInvoiceNumber,
} from "@/types/invoice";

// Template schema
export const invoiceTemplateSchema = z.object({
  title: z.string().optional().default("Invoice"),
  customerLabel: z.string().default("Bill to"),
  fromLabel: z.string().default("From"),
  invoiceNoLabel: z.string().default("Invoice No"),
  issueDateLabel: z.string().default("Issue Date"),
  dueDateLabel: z.string().default("Due Date"),
  descriptionLabel: z.string().default("Description"),
  priceLabel: z.string().default("Price"),
  quantityLabel: z.string().default("Quantity"),
  totalLabel: z.string().default("Total"),
  totalSummaryLabel: z.string().optional().default("Total"),
  vatLabel: z.string().optional().default("VAT"),
  subtotalLabel: z.string().optional().default("Subtotal"),
  taxLabel: z.string().optional().default("Tax"),
  discountLabel: z.string().optional().default("Discount"),
  paymentLabel: z.string().default("Payment Details"),
  noteLabel: z.string().default("Note"),
  logoUrl: z.string().optional().nullable(),
  currency: z.string().default("EUR"),
  paymentDetails: z.any().nullable().optional(),
  fromDetails: z.any().nullable().optional(),
  noteDetails: z.any().nullable().optional(),
  size: z.enum(["a4", "letter"]).default("a4"),
  includeVat: z.boolean().optional().default(true),
  includeTax: z.boolean().optional().default(false),
  includeDiscount: z.boolean().optional().default(true),
  includeDecimals: z.boolean().optional().default(true),
  includePdf: z.boolean().optional().default(true),
  includeUnits: z.boolean().optional().default(false),
  includeQr: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(100).optional().default(0),
  vatRate: z.number().min(0).max(100).optional().default(20),
  dateFormat: z
    .enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"])
    .default("dd.MM.yyyy"),
  deliveryType: z
    .enum(["create", "create_and_send", "scheduled"])
    .default("create"),
  locale: z.string().optional().default("sr-RS"),
  timezone: z.string().optional().default("Europe/Belgrade"),
});

// Line item schema
export const lineItemSchema = z.object({
  name: z.string().default(""),
  quantity: z.number().min(0, "Quantity must be at least 0").default(1),
  unit: z.string().optional().default("pcs"),
  price: z.number().default(0),
  productId: z.string().optional(),
  /** Discount percentage for this line item (0-100) */
  discount: z.number().min(0).max(100).optional().default(0),
  /** VAT percentage for this line item */
  vat: z.number().min(0).max(100).optional().default(20),
});

// Main invoice form schema
export const invoiceFormSchema = z.object({
  id: z.string().uuid(),
  status: z.string().default("draft"),
  template: invoiceTemplateSchema,
  fromDetails: z.any().optional(),
  customerDetails: z.any().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  paymentDetails: z.any().optional(),
  noteDetails: z.any().optional(),
  dueDate: z.string(),
  issueDate: z.string(),
  invoiceNumber: z.string(),
  logoUrl: z.string().nullable().optional(),
  vat: z.number().nullable().optional().default(0),
  tax: z.number().nullable().optional().default(0),
  discount: z.number().nullable().optional().default(0),
  subtotal: z.number().nullable().optional().default(0),
  topBlock: z.any().nullable().optional(),
  bottomBlock: z.any().nullable().optional(),
  amount: z.number().default(0),
  lineItems: z.array(lineItemSchema).min(1),
  token: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

export type FormValues = z.infer<typeof invoiceFormSchema>;
export type LineItemFormValues = z.infer<typeof lineItemSchema>;
export type TemplateFormValues = z.infer<typeof invoiceTemplateSchema>;

// Generate default values for new invoice
const getDefaultValues = (): FormValues => {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setMonth(dueDate.getMonth() + 1);

  return {
    id: crypto.randomUUID(),
    status: "draft",
    template: DEFAULT_INVOICE_TEMPLATE,
    fromDetails: null,
    customerDetails: null,
    customerId: undefined,
    customerName: undefined,
    paymentDetails: null,
    noteDetails: null,
    dueDate: dueDate.toISOString(),
    issueDate: today.toISOString(),
    invoiceNumber: generateInvoiceNumber(),
    logoUrl: null,
    vat: 0,
    tax: 0,
    discount: 0,
    subtotal: 0,
    topBlock: null,
    bottomBlock: null,
    amount: 0,
    lineItems: [
      { name: "", quantity: 1, unit: "pcs", price: 0, discount: 0, vat: 20 },
    ],
    token: generateInvoiceToken(),
    scheduledAt: null,
  };
};

type FormContextProps = {
  children: React.ReactNode;
  data?: Partial<InvoiceFormValues>;
  defaultSettings?: Partial<InvoiceDefaultSettings>;
};

export function FormContext({
  children,
  data,
  defaultSettings,
}: FormContextProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: getDefaultValues(),
    mode: "onChange",
  });

  useEffect(() => {
    const defaults = getDefaultValues();

    // Only apply specific fields from defaultSettings (fromDetails, paymentDetails, template)
    // Do NOT apply: lineItems, customerDetails, customerId, customerName, amount, etc.
    const safeDefaultSettings = defaultSettings ? {
      fromDetails: defaultSettings.fromDetails,
      paymentDetails: defaultSettings.paymentDetails,
      template: defaultSettings.template,
    } : {};

    form.reset({
      ...defaults,
      // Apply only safe default settings (fromDetails, paymentDetails, template)
      fromDetails: safeDefaultSettings.fromDetails ?? defaults.fromDetails,
      paymentDetails: safeDefaultSettings.paymentDetails ?? defaults.paymentDetails,
      template: {
        ...defaults.template,
        ...(safeDefaultSettings.template ?? {}),
        ...(data?.template ?? {}),
      },
      // Apply full data if editing existing invoice
      ...(data ? {
        ...data,
        template: {
          ...defaults.template,
          ...(safeDefaultSettings.template ?? {}),
          ...(data.template ?? {}),
        },
      } : {}),
    } as FormValues);
  }, [data, defaultSettings, form]);

  return <FormProvider {...form}>{children}</FormProvider>;
}

// Re-export types
export type { InvoiceFormValues, LineItemFormValues as LineItem };
