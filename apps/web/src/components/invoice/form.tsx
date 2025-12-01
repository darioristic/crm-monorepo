"use client";

import { useEffect, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invoicesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import type { FormValues } from "./form-context";
import { Meta } from "./meta";
import { Logo } from "./logo";
import { FromDetails } from "./from-details";
import { CustomerDetails } from "./customer-details";
import { LineItems } from "./line-items";
import { Summary } from "./summary";
import { PaymentDetails } from "./payment-details";
import { NoteDetails } from "./note-details";
import { SubmitButton } from "./submit-button";
import { EditBlock } from "./edit-block";
import { extractTextFromContent } from "./editor";
import { SettingsMenu } from "./settings-menu";

type FormProps = {
  invoiceId?: string;
  onSuccess?: (id: string) => void;
  onDraftSaved?: () => void;
};

export function Form({ invoiceId, onSuccess, onDraftSaved }: FormProps) {
  const form = useFormContext<FormValues>();
  const customerId = form.watch("customerId");

  // Stable mutation function that handles both create and update
  const mutationFn = useCallback(
    (data: any) =>
      invoiceId ? invoicesApi.update(invoiceId, data) : invoicesApi.create(data),
    [invoiceId]
  );

  const draftMutation = useMutation(mutationFn);
  const createMutation = useMutation(mutationFn);

  // Only watch the fields that are used in the draft action
  const formValues = useWatch({
    control: form.control,
    name: [
      "customerDetails",
      "customerId",
      "customerName",
      "template",
      "lineItems",
      "amount",
      "vat",
      "tax",
      "discount",
      "dueDate",
      "issueDate",
      "noteDetails",
      "paymentDetails",
      "fromDetails",
      "invoiceNumber",
      "topBlock",
      "bottomBlock",
      "scheduledAt",
    ],
  });

  const isDirty = form.formState.isDirty;
  const invoiceNumberValid = !form.getFieldState("invoiceNumber").error;
  const [debouncedValue] = useDebounceValue(formValues, 500);

  // Transform form values to API format
  const transformFormValuesToDraft = useCallback((values: FormValues) => {
    // Calculate gross total from line items (before discount)
    const grossTotal = values.lineItems
      .filter((item) => item.name && item.name.trim().length > 0)
      .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

    return {
      companyId: values.customerId || "",
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      status: values.status as any,
      grossTotal: grossTotal,
      subtotal: values.subtotal || 0,
      discount: values.discount || 0,
      tax: values.tax || 0,
      taxRate: values.template.taxRate || 0,
      vatRate: values.template.vatRate || 20,
      currency: values.template.currency || "EUR",
      total: values.amount,
      notes: values.noteDetails
        ? extractTextFromContent(values.noteDetails)
        : undefined,
      terms: values.paymentDetails
        ? extractTextFromContent(values.paymentDetails)
        : undefined,
      // Store fromDetails, customerDetails and logo for PDF generation
      fromDetails: values.fromDetails || null,
      customerDetails: values.customerDetails || null,
      logoUrl: values.template.logoUrl || null,
      templateSettings: {
        title: values.template.title,
        fromLabel: values.template.fromLabel,
        customerLabel: values.template.customerLabel,
        invoiceNoLabel: values.template.invoiceNoLabel,
        issueDateLabel: values.template.issueDateLabel,
        dueDateLabel: values.template.dueDateLabel,
        descriptionLabel: values.template.descriptionLabel,
        quantityLabel: values.template.quantityLabel,
        priceLabel: values.template.priceLabel,
        totalLabel: values.template.totalLabel,
        subtotalLabel: values.template.subtotalLabel,
        vatLabel: values.template.vatLabel,
        taxLabel: values.template.taxLabel,
        discountLabel: values.template.discountLabel,
        totalSummaryLabel: values.template.totalSummaryLabel,
        paymentLabel: values.template.paymentLabel,
        noteLabel: values.template.noteLabel,
        currency: values.template.currency,
        dateFormat: values.template.dateFormat,
        size: values.template.size,
        includeVat: values.template.includeVat,
        includeTax: values.template.includeTax,
        includeDiscount: values.template.includeDiscount,
        includeDecimals: values.template.includeDecimals,
        includeUnits: values.template.includeUnits,
        includeQr: values.template.includeQr,
        locale: values.template.locale,
        timezone: values.template.timezone,
      },
      items: values.lineItems
        .filter((item) => item.name && item.name.trim().length > 0)
        .map((item) => {
          const baseAmount = (item.price || 0) * (item.quantity || 1);
          const discountAmount = baseAmount * ((item.discount || 0) / 100);
          const total = baseAmount - discountAmount;
          return {
            productName: item.name,
            description: "",
            quantity: item.quantity || 1,
            unit: item.unit || "pcs",
            unitPrice: item.price || 0,
            discount: item.discount || 0,
            vatRate: item.vat || values.template.vatRate || 20,
            total: total,
          };
        }),
    };
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (isDirty && customerId && invoiceNumberValid) {
      const currentFormValues = form.getValues();

      draftMutation
        .mutate(transformFormValuesToDraft(currentFormValues))
        .then((result) => {
          if (result.success) {
            onDraftSaved?.();
          }
        });
    }
  }, [debouncedValue, isDirty, invoiceNumberValid, customerId]);

  // Submit the form
  const handleSubmit = async (values: FormValues) => {
    // Validate required fields
    if (!values.customerId) {
      toast.error("Please select a customer");
      return;
    }

    // Check if at least one line item has a name
    const hasValidLineItem = values.lineItems.some(
      (item) => item.name && item.name.trim().length > 0
    );
    if (!hasValidLineItem) {
      toast.error("Please add at least one item");
      return;
    }

    const result = await createMutation.mutate({
      ...transformFormValuesToDraft(values),
      status: values.template.deliveryType === "create" ? "draft" : "sent",
    });

    if (result.success && result.data) {
      const isUpdate = !!invoiceId;
      toast.success(
        values.template.deliveryType === "create_and_send"
          ? isUpdate ? "Invoice updated and sent" : "Invoice created and sent"
          : isUpdate ? "Invoice updated successfully" : "Invoice created successfully"
      );
      onSuccess?.(result.data.id);
    } else {
      toast.error(result.error || (invoiceId ? "Failed to update invoice" : "Failed to create invoice"));
    }
  };

  // Handle form errors
  const handleError = (errors: any) => {
    // Skip if no actual errors
    if (!errors) return;
    
    // Deep check for actual error messages
    const hasActualError = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      if (obj.message && typeof obj.message === 'string') return true;
      return Object.values(obj).some(val => hasActualError(val));
    };
    
    if (!hasActualError(errors)) return;
    
    console.error("Form validation errors:", errors);
    
    // Get nested errors (react-hook-form can have nested error objects)
    const getFirstErrorMessage = (errorObj: any): string | undefined => {
      if (!errorObj) return undefined;
      if (errorObj.message) return errorObj.message;
      for (const key of Object.keys(errorObj)) {
        const nested = getFirstErrorMessage(errorObj[key]);
        if (nested) return nested;
      }
      return undefined;
    };
    
    const errorMessage = getFirstErrorMessage(errors);
    if (errorMessage) {
      toast.error(errorMessage);
    } else {
      toast.error("Please check the form for errors");
    }
  };

  // Prevent form from submitting when pressing enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit as any, handleError)}
      className="relative h-full"
      onKeyDown={handleKeyDown}
    >
      <ScrollArea className="h-full bg-[#fcfcfc] dark:bg-[#121212]">
        <div className="p-8 pb-20 h-full flex flex-col relative">
          <div className="absolute top-0 right-0 z-10">
            <SettingsMenu />
          </div>
          <div className="flex justify-between items-start">
            <Meta />
            <Logo />
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8 mb-4">
            <div>
              <FromDetails />
            </div>
            <div>
              <CustomerDetails />
            </div>
          </div>

          <EditBlock name="topBlock" />

          <div className="mt-4">
            <LineItems />
          </div>

          <div className="mt-12 flex justify-end mb-8">
            <Summary />
          </div>

          <div className="flex flex-col mt-auto">
            <div className="mb-4">
              <NoteDetails />
            </div>

            <div className="mb-4">
              <PaymentDetails />
            </div>

            <EditBlock name="bottomBlock" />
          </div>
        </div>
      </ScrollArea>

      <div className="absolute bottom-[15px] right-0 px-8">
        <SubmitButton
          isSubmitting={createMutation.isLoading}
          disabled={createMutation.isLoading || draftMutation.isLoading}
          isEditMode={!!invoiceId}
        />
      </div>
    </form>
  );
}
