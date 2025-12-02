"use client";

import { useEffect, useCallback, useRef } from "react";
import { useFormContext, useWatch, type FieldErrors } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invoicesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import type { FormValues } from "./form-context";
import type { CreateInvoiceRequest, UpdateInvoiceRequest, InvoiceStatus } from "@crm/types";
import { logger } from "@/lib/logger";
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
    (data: CreateInvoiceRequest | UpdateInvoiceRequest) =>
      invoiceId ? invoicesApi.update(invoiceId, data) : invoicesApi.create(data),
    [invoiceId]
  );

  const draftMutation = useMutation(mutationFn);
  const createMutation = useMutation(mutationFn);

  // Use refs for mutation functions to prevent infinite loops in useEffect
  const draftMutationRef = useRef(draftMutation);
  draftMutationRef.current = draftMutation;
  
  // Track if a draft save is in progress to prevent duplicate requests
  const isSavingDraftRef = useRef(false);

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
      companyId: values.customerId && values.customerId.trim() ? values.customerId.trim() : undefined,
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      status: values.status as InvoiceStatus,
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

  // Auto-save draft - only when EDITING existing invoice (not for new invoices)
  useEffect(() => {
    // IMPORTANT: Disable auto-save for new invoices to prevent duplicate invoice_number errors
    // Auto-save should only work when editing an existing invoice
    if (!invoiceId) {
      return;
    }

    // Skip if already saving or form is not dirty or basic validation fails
    if (isSavingDraftRef.current || !isDirty || !invoiceNumberValid) {
      return;
    }
    
    const currentFormValues = form.getValues();
    
    // Check all required fields for a valid invoice draft
    const customerId = currentFormValues.customerId;
    const hasCustomer = !!(customerId && typeof customerId === 'string' && customerId.trim().length > 0);
    const hasDueDate = !!currentFormValues.dueDate;
    
    // Check for valid line items with both name and price > 0
    const validLineItems = currentFormValues.lineItems?.filter(
      (item) => item.name && item.name.trim().length > 0 && (item.price ?? 0) > 0
    ) ?? [];
    const hasValidLineItem = validLineItems.length > 0;
    
    // Only save draft if ALL required fields are present
    if (!hasCustomer || !hasDueDate || !hasValidLineItem) {
      return;
    }

    // Double-check the transformed data before sending
    const transformedData = transformFormValuesToDraft(currentFormValues);
    if (!transformedData.companyId || !transformedData.dueDate || !transformedData.items || transformedData.items.length === 0) {
      return;
    }

    // Prevent duplicate requests
    isSavingDraftRef.current = true;

    draftMutationRef.current
      .mutate(transformedData)
      .then((result) => {
        if (result.success) {
          onDraftSaved?.();
        }
      })
      .finally(() => {
        isSavingDraftRef.current = false;
      });
  }, [invoiceId, debouncedValue, isDirty, invoiceNumberValid, form, onDraftSaved, transformFormValuesToDraft]);

  // Submit the form
  const handleSubmit = async (values: FormValues) => {
    // Validate required fields
    if (!values.customerId || !values.customerId.trim()) {
      toast.error("Please select a customer");
      return;
    }

    if (!values.dueDate) {
      toast.error("Please set a due date");
      return;
    }

    // Check if at least one line item has a name and valid price
    const validLineItems = values.lineItems.filter(
      (item) => item.name && item.name.trim().length > 0
    );
    
    if (validLineItems.length === 0) {
      toast.error("Please add at least one item with a name");
      return;
    }

    // Transform the data
    const transformedData = {
      ...transformFormValuesToDraft(values),
      status: values.template.deliveryType === "create" ? "draft" : "sent",
    };

    // Final validation before sending
    if (!transformedData.companyId || !transformedData.dueDate || !transformedData.items || transformedData.items.length === 0) {
      console.error('Submit validation failed:', {
        companyId: transformedData.companyId,
        dueDate: transformedData.dueDate,
        itemsCount: transformedData.items?.length ?? 0
      });
      toast.error("Please fill in all required fields");
      return;
    }

    const result = await createMutation.mutate(transformedData);

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
  const handleError = (errors: FieldErrors<FormValues>) => {
    // Skip if no actual errors
    if (!errors) return;

    // Deep check for actual error messages
    const hasActualError = (obj: unknown): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      if ('message' in obj && typeof obj.message === 'string') return true;
      return Object.values(obj).some(val => hasActualError(val));
    };

    if (!hasActualError(errors)) return;

    logger.error("Form validation errors", undefined, { errors });

    // Get nested errors (react-hook-form can have nested error objects)
    const getFirstErrorMessage = (errorObj: unknown): string | undefined => {
      if (!errorObj) return undefined;
      if (typeof errorObj === 'object' && errorObj !== null && 'message' in errorObj) {
        return errorObj.message as string;
      }
      if (typeof errorObj === 'object' && errorObj !== null) {
        for (const key of Object.keys(errorObj)) {
          const nested = getFirstErrorMessage((errorObj as Record<string, unknown>)[key]);
          if (nested) return nested;
        }
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
      onSubmit={form.handleSubmit(handleSubmit, handleError)}
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
          disabled={createMutation.isLoading}
          isEditMode={!!invoiceId}
        />
      </div>
    </form>
  );
}
