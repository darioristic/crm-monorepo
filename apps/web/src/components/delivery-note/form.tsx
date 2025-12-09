"use client";

import type { CreateDeliveryNoteRequest, UpdateDeliveryNoteRequest } from "@crm/types";
import { useCallback, useEffect, useRef } from "react";
import { type FieldErrors, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { CustomerDetails } from "@/components/order/customer-details";
import { EditBlock } from "@/components/order/edit-block";
import { createContentFromText, extractTextFromContent } from "@/components/order/editor";
import { FromDetails } from "@/components/order/from-details";
import { LineItems } from "@/components/order/line-items";
import { Logo } from "@/components/order/logo";
import { NoteDetails } from "@/components/order/note-details";
import { PaymentDetails } from "@/components/order/payment-details";
import { SettingsMenu } from "@/components/order/settings-menu";
import { SubmitButton } from "@/components/order/submit-button";
import { Summary } from "@/components/order/summary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/auth-context";
import { useMutation } from "@/hooks/use-api";
import { accountsApi, deliveryNotesApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { FormValues } from "./form-context";
import { DeliveryNoteMeta } from "./meta";

type FormProps = {
  deliveryNoteId?: string;
  onSuccess?: (id: string) => void;
  onDraftSaved?: () => void;
};

export function Form({ deliveryNoteId, onSuccess, onDraftSaved }: FormProps) {
  const form = useFormContext<FormValues>();
  const _customerId = form.watch("customerId");
  const { user } = useAuth();

  // Mutations
  const draftMutation = useMutation((data: UpdateDeliveryNoteRequest) =>
    deliveryNotesApi.update(deliveryNoteId || "", data)
  );
  const createMutation = useMutation((data: CreateDeliveryNoteRequest) =>
    deliveryNotesApi.create(data)
  );

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
      "issueDate",
      "noteDetails",
      "paymentDetails",
      "fromDetails",
      "deliveryNumber",
      "topBlock",
      "bottomBlock",
      "scheduledAt",
    ],
  });

  const isDirty = form.formState.isDirty;
  const deliveryNumberValid = !form.getFieldState("deliveryNumber").error;
  const [debouncedValue] = useDebounceValue(formValues, 500);

  // Transform form values to API format
  const transformFormValuesToDraft = useCallback(
    (values: FormValues) => {
      // Calculate gross total from line items (before discount)
      const _grossTotal = values.lineItems
        .filter((item) => item.name && item.name.trim().length > 0)
        .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

      return {
        createdBy: (user?.id as string) || "",
        customerCompanyId: values.customerId?.trim() ? values.customerId.trim() : undefined,
        deliveryNumber: values.deliveryNumber,
        deliveryDate: values.issueDate,
        status: values.status as "pending" | "in_transit" | "delivered" | "returned",
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
                : (values.noteDetails as any)
            )
          : undefined,
        terms: values.paymentDetails
          ? extractTextFromContent(
              typeof values.paymentDetails === "string"
                ? createContentFromText(values.paymentDetails)
                : (values.paymentDetails as any)
            )
          : undefined,
        // Store fromDetails, customerDetails and logo for PDF generation
        fromDetails: values.fromDetails || null,
        customerDetails: values.customerDetails || null,
        logoUrl: values.template.logoUrl ?? undefined,
        // Build shippingAddress from customerDetails
        shippingAddress: values.customerDetails
          ? extractTextFromContent(
              typeof values.customerDetails === "string"
                ? createContentFromText(values.customerDetails)
                : (values.customerDetails as any)
            ) || "N/A"
          : "N/A",
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
    },
    [user?.id]
  );

  // Auto-save draft - only when EDITING existing delivery note (not for new)
  useEffect(() => {
    // IMPORTANT: Disable auto-save for new delivery notes to prevent duplicate number errors
    if (!deliveryNoteId) {
      return;
    }

    // Skip if already saving or form is not dirty or basic validation fails
    if (isSavingDraftRef.current || !isDirty || !deliveryNumberValid) {
      return;
    }

    const currentFormValues = form.getValues();

    // Check all required fields for a valid delivery note draft
    const customerId = currentFormValues.customerId;
    const hasCustomer = !!(
      customerId &&
      typeof customerId === "string" &&
      customerId.trim().length > 0
    );
    const hasValidUntil = !!currentFormValues.issueDate;

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
      !transformedData.deliveryDate ||
      !transformedData.items ||
      transformedData.items.length === 0
    ) {
      return;
    }

    // Prevent duplicate requests
    isSavingDraftRef.current = true;

    draftMutationRef.current
      .mutate(transformedData as any)
      .then((result) => {
        if (result.success) {
          onDraftSaved?.();
        }
      })
      .finally(() => {
        isSavingDraftRef.current = false;
      });
  }, [
    deliveryNoteId,
    debouncedValue,
    isDirty,
    deliveryNumberValid,
    form,
    onDraftSaved,
    transformFormValuesToDraft,
  ]);

  // Submit the form
  const handleSubmit = async (values: FormValues) => {
    // Validate required fields
    const initialCompanyId = (values.customerId || (values as any).companyId || "").trim();
    let companyIdFinal = initialCompanyId;
    if (!companyIdFinal) {
      const candidateName = (() => {
        const n = (values.customerName || "").trim();
        if (n) return n;
        try {
          const first = (values.customerDetails as any)?.content?.[0]?.content?.[0]?.text;
          return typeof first === "string" ? first.trim() : "";
        } catch {
          return "";
        }
      })();
      if (candidateName) {
        try {
          const res = await accountsApi.search({
            q: candidateName,
            type: "organization",
            limit: 1,
          });
          if (
            (res as any)?.success &&
            Array.isArray((res as any).data) &&
            (res as any).data.length > 0
          ) {
            companyIdFinal = (res as any).data[0].id;
          }
        } catch {}
      }
      if (!companyIdFinal) {
        toast.error("Please select a customer");
        return;
      }
    }

    if (!values.issueDate) {
      toast.error("Please set a date");
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
        customerId: companyIdFinal as any,
      } as any),
      status: "pending" as const,
    };

    // Final validation before sending
    if (
      !transformedData.customerCompanyId ||
      !transformedData.deliveryDate ||
      !transformedData.items ||
      transformedData.items.length === 0
    ) {
      logger.error("Submit validation failed:", {
        customerCompanyId: transformedData.customerCompanyId,
        deliveryDate: transformedData.deliveryDate,
        itemsCount: transformedData.items?.length ?? 0,
      });
      toast.error("Please fill in all required fields");
      return;
    }

    const result = await createMutation.mutate(
      transformedData as unknown as CreateDeliveryNoteRequest
    );

    if (result.success && result.data) {
      const isUpdate = !!deliveryNoteId;
      toast.success(
        isUpdate ? "Delivery note updated successfully" : "Delivery note created successfully"
      );
      onSuccess?.(result.data.id);
    } else {
      toast.error(
        result.error ||
          (deliveryNoteId ? "Failed to update delivery note" : "Failed to create delivery note")
      );
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
            <DeliveryNoteMeta />
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
          isEditMode={!!deliveryNoteId}
        />
      </div>
    </form>
  );
}
