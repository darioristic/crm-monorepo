"use client";

import type { CreateQuoteRequest, Quote, UpdateQuoteRequest } from "@crm/types";
import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { type FieldErrors, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { useMutation } from "@/hooks/use-api";
import { quotesApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { CustomerDetails } from "./customer-details";
import { EditBlock } from "./edit-block";
import { createContentFromText, extractTextFromContent } from "./editor";
import type { FormValues } from "./form-context";
import { FromDetails } from "./from-details";
import { LineItems } from "./line-items";
import { Logo } from "./logo";
import { Meta } from "./meta";
import { NoteDetails } from "./note-details";
import { PaymentDetails } from "./payment-details";
import { SettingsMenu } from "./settings-menu";
import { SubmitButton } from "./submit-button";
import { Summary } from "./summary";

type FormProps = {
  quoteId?: string;
  onSuccess?: (id: string) => void;
  onDraftSaved?: () => void;
};

export function Form({ quoteId, onSuccess, onDraftSaved }: FormProps) {
  const form = useFormContext<FormValues>();
  const { user } = useAuth();
  const _customerId = form.watch("customerId");

  // Stable mutation function that handles both create and update
  const mutationFn = useCallback(
    (data: CreateQuoteRequest | UpdateQuoteRequest) =>
      quoteId
        ? quotesApi.update(quoteId, data as UpdateQuoteRequest)
        : quotesApi.create(data as CreateQuoteRequest),
    [quoteId]
  );

  const draftMutation = useMutation<Quote, CreateQuoteRequest | UpdateQuoteRequest>(mutationFn);
  const createMutation = useMutation<Quote, CreateQuoteRequest | UpdateQuoteRequest>(mutationFn);

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
      "validUntil",
      "issueDate",
      "noteDetails",
      "paymentDetails",
      "fromDetails",
      "topBlock",
      "bottomBlock",
      "scheduledAt",
    ],
  });

  const isDirty = form.formState.isDirty;
  const [debouncedValue] = useDebounceValue(formValues, 500);

  // Transform form values to API format
  const transformFormValuesToDraft = useCallback(
    (values: FormValues) => {
      // Calculate gross total from line items (before discount)
      const grossTotal = values.lineItems
        .filter((item) => item.name && item.name.trim().length > 0)
        .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

      const selectedCompanyId = (values.customerId || "").trim();
      return {
        customerCompanyId: selectedCompanyId ? selectedCompanyId : undefined,
        sellerCompanyId: user?.companyId,
        issueDate: values.issueDate,
        validUntil: values.validUntil,
        status: values.status as "draft" | "sent" | "accepted" | "rejected" | "expired",
        grossTotal: grossTotal,
        subtotal: values.subtotal || 0,
        discount: values.discount || 0,
        tax: values.tax || 0,
        taxRate: values.template.taxRate || 0,
        vatRate: values.template.vatRate || 20,
        currency: values.template.currency || "EUR",
        total: values.amount,
        notes: values.noteDetails
          ? extractTextFromContent(
            typeof values.noteDetails === "string"
              ? createContentFromText(values.noteDetails)
              : (values.noteDetails as JSONContent | null | undefined)
            )
          : undefined,
        terms: values.paymentDetails
          ? extractTextFromContent(
            typeof values.paymentDetails === "string"
              ? createContentFromText(values.paymentDetails)
              : (values.paymentDetails as JSONContent | null | undefined)
            )
          : undefined,
        // Store fromDetails, customerDetails and logo for PDF generation
        fromDetails: values.fromDetails || null,
        customerDetails: values.customerDetails || null,
        logoUrl: values.template.logoUrl ?? undefined,
        templateSettings: {
          title: values.template.title,
          fromLabel: values.template.fromLabel,
          customerLabel: values.template.customerLabel,
          quoteNoLabel: values.template.quoteNoLabel,
          issueDateLabel: values.template.issueDateLabel,
          validUntilLabel: values.template.validUntilLabel,
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
              description: item.description || "",
              quantity: item.quantity || 1,
              unit: item.unit || "pcs",
              unitPrice: item.price || 0,
              discount: item.discount || 0,
              vatRate: item.vat || values.template.vatRate || 20,
              total: total,
            };
          }),
      };
    },
    [user?.companyId]
  );

  // Auto-save draft - only when EDITING existing quote (not for new quotes)
  useEffect(() => {
    // IMPORTANT: Disable auto-save for new quotes to prevent duplicate quote_number errors
    // Auto-save should only work when editing an existing quote
    if (!quoteId) {
      return;
    }

    // Skip if already saving or form is not dirty or basic validation fails
    if (isSavingDraftRef.current || !isDirty) {
      return;
    }

    const currentFormValues = form.getValues();

    // Check all required fields for a valid quote draft
    const customerId = currentFormValues.customerId;
    const hasCustomer = !!(
      customerId &&
      typeof customerId === "string" &&
      customerId.trim().length > 0
    );
    const hasValidUntil = !!currentFormValues.validUntil;

    // Check for valid line items with both name and price > 0
    const validLineItems =
      currentFormValues.lineItems?.filter(
        (item) => item.name && item.name.trim().length > 0 && (item.price ?? 0) > 0
      ) ?? [];
    const hasValidLineItem = validLineItems.length > 0;

    // Only save draft if ALL required fields are present
    if (!hasCustomer || !hasValidUntil || !hasValidLineItem) {
      return;
    }

    // Double-check the transformed data before sending
    const transformedData = transformFormValuesToDraft(currentFormValues);
    if (
      !transformedData.customerCompanyId ||
      !transformedData.validUntil ||
      !transformedData.items ||
      transformedData.items.length === 0
    ) {
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
  }, [
    quoteId,
    debouncedValue,
    isDirty,
    form,
    onDraftSaved,
    transformFormValuesToDraft,
  ]);

  // Submit the form
  const handleSubmit = async (values: FormValues) => {
    // Validate required fields
    const selectedCompanyId = (values.customerId || "").trim();
    const companyIdFinal = selectedCompanyId;
    if (!companyIdFinal) {
      toast.error("Please select a customer");
      return;
    }

    if (!values.validUntil) {
      toast.error("Please set a valid until date");
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
      ...transformFormValuesToDraft({
        ...values,
        customerId: companyIdFinal,
      }),
      status: values.template.deliveryType === "create" ? "draft" : "sent",
    } as CreateQuoteRequest;

    // Final validation before sending
    if (
      !transformedData.customerCompanyId ||
      !transformedData.validUntil ||
      !transformedData.items ||
      transformedData.items.length === 0
    ) {
      logger.error("Submit validation failed:", {
        customerCompanyId: transformedData.customerCompanyId,
        validUntil: transformedData.validUntil,
        itemsCount: transformedData.items?.length ?? 0,
      });
      toast.error("Please fill in all required fields");
      return;
    }

    const result = await createMutation.mutate(transformedData);

    if (result.success && result.data) {
      const isUpdate = !!quoteId;
      toast.success(
        values.template.deliveryType === "create_and_send"
          ? isUpdate
            ? "Quote updated and sent"
            : "Quote created and sent"
          : isUpdate
            ? "Quote updated successfully"
            : "Quote created successfully"
      );
      try {
        if (typeof window !== "undefined" && result.data.companyId) {
          window.localStorage?.setItem("selectedCompanyId", String(result.data.companyId));
        }
      } catch {}
      onSuccess?.(result.data.id);
    } else {
      toast.error(result.error || (quoteId ? "Failed to update quote" : "Failed to create quote"));
    }
  };

  // Handle form errors
  const handleError = (errors: FieldErrors<FormValues>) => {
    // Skip if no actual errors
    if (!errors) return;

    // Deep check for actual error messages
    const hasActualError = (obj: unknown): boolean => {
      if (!obj || typeof obj !== "object") return false;
      if ("message" in obj && typeof obj.message === "string") return true;
      return Object.values(obj).some((val) => hasActualError(val));
    };

    if (!hasActualError(errors)) return;

    logger.error("Form validation errors", undefined, { errors });

    // Get nested errors (react-hook-form can have nested error objects)
    const getFirstErrorMessage = (errorObj: unknown): string | undefined => {
      if (!errorObj) return undefined;
      if (typeof errorObj === "object" && errorObj !== null && "message" in errorObj) {
        return errorObj.message as string;
      }
      if (typeof errorObj === "object" && errorObj !== null) {
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
          isEditMode={!!quoteId}
        />
      </div>
    </form>
  );
}
