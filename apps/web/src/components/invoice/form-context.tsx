"use client";

import { invoiceFormSchema } from "@crm/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import type {
  InvoiceDefaultSettings,
  InvoiceFormValues,
  InvoiceTemplate,
  LineItem,
} from "@/types/invoice";
import {
  DEFAULT_INVOICE_TEMPLATE,
  generateInvoiceNumber,
  generateInvoiceToken,
} from "@/types/invoice";

export type FormValues = InvoiceFormValues;
export type LineItemFormValues = LineItem;
export type TemplateFormValues = InvoiceTemplate;
export type { InvoiceFormValues } from "@/types/invoice";

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
    customerId: "",
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
    lineItems: [{ name: "", quantity: 1, unit: "pcs", price: 0, discount: 0, vat: 20 }],
    token: generateInvoiceToken(),
    scheduledAt: null,
  };
};

type FormContextProps = {
  children: React.ReactNode;
  data?: Partial<InvoiceFormValues>;
  defaultSettings?: Partial<InvoiceDefaultSettings>;
};

export function FormContext({ children, data, defaultSettings }: FormContextProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<FormValues>,
    defaultValues: getDefaultValues(),
    mode: "onChange",
  });

  useEffect(() => {
    const defaults = getDefaultValues();

    // Only apply specific fields from defaultSettings (fromDetails, paymentDetails, template)
    // Do NOT apply: lineItems, customerDetails, customerId, customerName, amount, etc.
    const safeDefaultSettings = defaultSettings
      ? {
          fromDetails: defaultSettings.fromDetails,
          paymentDetails: defaultSettings.paymentDetails,
          template: defaultSettings.template,
        }
      : {};

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
      ...(data
        ? {
            ...data,
            template: {
              ...defaults.template,
              ...(safeDefaultSettings.template ?? {}),
              ...(data.template ?? {}),
            },
          }
        : {}),
    } as FormValues);
  }, [data, defaultSettings, form]);

  return <FormProvider {...form}>{children}</FormProvider>;
}
