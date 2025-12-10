"use client";

import type { LineItem, OrderFormValues, OrderTemplate } from "@crm/schemas";
import { orderFormSchema } from "@crm/schemas";
import { useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { useZodForm } from "@/hooks/use-zod-form";
import { ordersApi } from "@/lib/api";
import type { OrderDefaultSettings } from "@/types/order";
import { DEFAULT_ORDER_TEMPLATE, generateOrderNumber, generateOrderToken } from "@/types/order";

export type FormValues = OrderFormValues;
export type LineItemFormValues = LineItem;
export type TemplateFormValues = OrderTemplate;

// Generate default values for new order
const getDefaultValues = (): FormValues => {
  const today = new Date();

  return {
    id: crypto.randomUUID(),
    status: "pending",
    template: DEFAULT_ORDER_TEMPLATE,
    fromDetails: null,
    customerDetails: null,
    customerId: "",
    customerName: undefined,
    paymentDetails: null,
    noteDetails: null,
    issueDate: today.toISOString(),
    orderNumber: generateOrderNumber(),
    logoUrl: null,
    vat: 0,
    tax: 0,
    discount: 0,
    subtotal: 0,
    topBlock: null,
    bottomBlock: null,
    amount: 0,
    lineItems: [{ name: "", quantity: 1, unit: "pcs", price: 0, discount: 0, vat: 20 }],
    token: generateOrderToken(),
    scheduledAt: null,
  };
};

type FormContextProps = {
  children: React.ReactNode;
  data?: Partial<OrderFormValues>;
  defaultSettings?: Partial<OrderDefaultSettings>;
};

export function FormContext({ children, data, defaultSettings }: FormContextProps) {
  const form = useZodForm(orderFormSchema, {
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
      // Apply full data if editing existing order
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

  // Fetch next order number from API when creating a new order
  useEffect(() => {
    // Only fetch if creating new (no data.id means new order)
    if (data?.id) return;

    const fetchNextNumber = async () => {
      try {
        const result = await ordersApi.getNextNumber();
        if (result?.success && result.data?.orderNumber) {
          form.setValue("orderNumber", result.data.orderNumber);
        }
      } catch (error) {
        // Fallback to client-side generation if API fails
        console.error("Failed to fetch next order number:", error);
      }
    };

    fetchNextNumber();
  }, [data?.id, form]);

  return <FormProvider {...form}>{children}</FormProvider>;
}
