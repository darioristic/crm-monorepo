"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invoicesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import { formatRelativeTime } from "@/lib/utils";
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
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
  const [lastEditedText, setLastEditedText] = useState("");

  const form = useFormContext<FormValues>();
  const token = form.watch("token");
  const customerId = form.watch("customerId");

  const draftMutation = useMutation((data: any) =>
    invoiceId ? invoicesApi.update(invoiceId, data) : invoicesApi.create(data)
  );

  const createMutation = useMutation((data: any) =>
    invoiceId ? invoicesApi.update(invoiceId, data) : invoicesApi.create(data)
  );

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
    return {
      companyId: values.customerId || "",
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      status: values.status as any,
      subtotal: values.subtotal || 0,
      tax: values.tax || 0,
      taxRate: values.template.taxRate || 0,
      total: values.amount,
      notes: values.noteDetails
        ? extractTextFromContent(values.noteDetails)
        : undefined,
      terms: values.paymentDetails
        ? extractTextFromContent(values.paymentDetails)
        : undefined,
      items: values.lineItems
        .filter((item) => item.name && item.name.trim().length > 0)
        .map((item) => ({
          productName: item.name,
          description: "",
          quantity: item.quantity || 1,
          unitPrice: item.price || 0,
          discount: 0,
          total: (item.price || 0) * (item.quantity || 1),
        })),
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
            setLastUpdated(new Date());
            onDraftSaved?.();
          }
        });
    }
  }, [debouncedValue, isDirty, invoiceNumberValid, customerId]);

  // Update last edited text
  useEffect(() => {
    const updateLastEditedText = () => {
      if (!lastUpdated) {
        setLastEditedText("");
        return;
      }
      setLastEditedText(`Edited ${formatRelativeTime(lastUpdated)}`);
    };

    updateLastEditedText();
    const intervalId = setInterval(updateLastEditedText, 1000);
    return () => clearInterval(intervalId);
  }, [lastUpdated]);

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
      toast.success(
        values.template.deliveryType === "create_and_send"
          ? "Invoice created and sent"
          : "Invoice created successfully"
      );
      onSuccess?.(result.data.id);
    } else {
      toast.error(result.error || "Failed to create invoice");
    }
  };

  // Handle form errors
  const handleError = (errors: any) => {
    console.error("Form validation errors:", errors);
    const firstError = Object.values(errors)[0] as any;
    if (firstError?.message) {
      toast.error(firstError.message);
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
      <ScrollArea className="h-[calc(100vh-200px)] bg-[#fcfcfc] dark:bg-[#121212]">
        <div className="p-8 pb-4 h-full flex flex-col">
          <div className="flex justify-between">
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
            <div className="grid grid-cols-2 gap-6 mb-4 overflow-hidden">
              <PaymentDetails />
              <NoteDetails />
            </div>

            <EditBlock name="bottomBlock" />

            {/* Invoice Settings */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#878787]">
                  Invoice Settings
                </span>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="absolute bottom-14 w-full h-9">
        <div className="flex justify-between items-center mt-auto px-8">
          <div className="flex space-x-2 items-center text-xs text-[#808080]">
            {/* Preview link only shows for saved invoices */}
            {invoiceId && token && (
              <>
                <a
                  href={`/i/${token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-3" />
                  <span>Preview invoice</span>
                </a>

                {(draftMutation.isLoading || lastEditedText) && <span>-</span>}
              </>
            )}

            {(draftMutation.isLoading || lastEditedText) && (
              <span>{draftMutation.isLoading ? "Saving" : lastEditedText}</span>
            )}
          </div>

          <SubmitButton
            isSubmitting={createMutation.isLoading}
            disabled={createMutation.isLoading || draftMutation.isLoading}
          />
        </div>
      </div>
    </form>
  );
}
