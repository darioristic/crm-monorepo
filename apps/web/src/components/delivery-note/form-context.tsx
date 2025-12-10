"use client";

import { useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { useZodForm } from "@/hooks/use-zod-form";
import type {
  DeliveryNoteDefaultSettings,
  DeliveryNoteFormValues,
  DeliveryNoteTemplate,
  LineItem,
} from "@/types/delivery-note";
import {
  DEFAULT_DELIVERY_NOTE_TEMPLATE,
  generateDeliveryNoteNumber,
  generateDeliveryNoteToken,
} from "@/types/delivery-note";

export type FormValues = DeliveryNoteFormValues;
export type LineItemFormValues = LineItem;
export type TemplateFormValues = DeliveryNoteTemplate;

// Create zod schema for delivery note form
const deliveryNoteFormSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_transit", "delivered", "returned"]).default("pending"),
  template: z.any(), // Use any for template to avoid complex schema
  fromDetails: z.any().optional(),
  customerDetails: z.any().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  paymentDetails: z.any().optional(),
  noteDetails: z.any().optional(),
  issueDate: z.string(),
  deliveryNumber: z.string(),
  logoUrl: z.string().nullable().optional(),
  vat: z.number().nullable().optional().default(0),
  tax: z.number().nullable().optional().default(0),
  discount: z.number().nullable().optional().default(0),
  subtotal: z.number().nullable().optional().default(0),
  topBlock: z.any().nullable().optional(),
  bottomBlock: z.any().nullable().optional(),
  amount: z.number().default(0),
  lineItems: z.array(z.any()).min(1),
  token: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

// Generate default values for new delivery note
const getDefaultValues = (): FormValues => {
  const today = new Date();

  return {
    id: crypto.randomUUID(),
    status: "pending",
    template: DEFAULT_DELIVERY_NOTE_TEMPLATE,
    fromDetails: null,
    customerDetails: null,
    customerId: "",
    customerName: undefined,
    paymentDetails: null,
    noteDetails: null,
    issueDate: today.toISOString(),
    deliveryNumber: generateDeliveryNoteNumber(),
    logoUrl: null,
    vat: 0,
    tax: 0,
    discount: 0,
    subtotal: 0,
    topBlock: null,
    bottomBlock: null,
    amount: 0,
    lineItems: [{ name: "", quantity: 1, unit: "pcs", price: 0, discount: 0, vat: 20 }],
    token: generateDeliveryNoteToken(),
    scheduledAt: null,
  };
};

type FormContextProps = {
  children: React.ReactNode;
  data?: Partial<DeliveryNoteFormValues>;
  defaultSettings?: Partial<DeliveryNoteDefaultSettings>;
};

export function FormContext({ children, data, defaultSettings }: FormContextProps) {
  const form = useZodForm(deliveryNoteFormSchema, {
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
      // Apply full data if editing existing delivery note
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
