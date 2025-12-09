"use client";

import { quoteFormSchema } from "@crm/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { Resolver } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import type { LineItem, QuoteDefaultSettings, QuoteFormValues, QuoteTemplate } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE, generateQuoteNumber, generateQuoteToken } from "@/types/quote";

export type FormValues = QuoteFormValues;
export type LineItemFormValues = LineItem;
export type TemplateFormValues = QuoteTemplate;

// Generate default values for new quote
const getDefaultValues = (): FormValues => {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setMonth(validUntil.getMonth() + 1);

  return {
    id: crypto.randomUUID(),
    status: "draft",
    template: DEFAULT_QUOTE_TEMPLATE,
    fromDetails: null,
    customerDetails: null,
    customerId: "",
    customerName: undefined,
    paymentDetails: null,
    noteDetails: null,
    validUntil: validUntil.toISOString(),
    issueDate: today.toISOString(),
    quoteNumber: generateQuoteNumber(),
    logoUrl: null,
    vat: 0,
    tax: 0,
    discount: 0,
    subtotal: 0,
    topBlock: null,
    bottomBlock: null,
    amount: 0,
    lineItems: [],
    token: generateQuoteToken(),
    scheduledAt: null,
  };
};

type FormContextProps = {
  children: React.ReactNode;
  data?: Partial<QuoteFormValues>;
  defaultSettings?: Partial<QuoteDefaultSettings>;
};

export function FormContext({ children, data, defaultSettings }: FormContextProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(quoteFormSchema) as Resolver<FormValues>,
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
      // Apply full data if editing existing quote
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
