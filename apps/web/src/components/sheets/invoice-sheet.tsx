"use client";

import { FormContext, type InvoiceFormValues } from "@/components/invoice/form-context";
import { InvoiceContent } from "@/components/invoice/invoice-content";
import { invoicesApi } from "@/lib/api";
import { Sheet } from "@/components/ui/sheet";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  invoiceData?: Partial<InvoiceFormValues>;
  defaultSettings?: Partial<InvoiceFormValues>;
  onSuccess?: () => void;
};

export function InvoiceSheet({
  open,
  onOpenChange,
  invoiceId,
  invoiceData,
  defaultSettings,
  onSuccess,
}: Props) {
  const [type, setType] = useState<"create" | "edit" | "success">(
    invoiceId ? "edit" : "create"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();

  const handleSubmit = async (values: InvoiceFormValues) => {
    try {
      setIsSubmitting(true);

      const payload = {
        companyId: values.customerId || "",
        invoiceNumber: values.invoiceNumber,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        status: values.status as "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled",
        subtotal: values.subtotal || 0,
        tax: values.vat || 0,
        taxRate: values.template.vatRate || 0,
        total: values.amount,
        notes: typeof values.noteDetails === "string" ? values.noteDetails : undefined,
        terms: typeof values.paymentDetails === "string" ? values.paymentDetails : undefined,
        items: values.lineItems.map((item) => ({
          productName: item.name,
          description: "",
          quantity: item.quantity ?? 1,
          unitPrice: item.price ?? 0,
          discount: 0,
          total: (item.price ?? 0) * (item.quantity ?? 1),
        })),
        createdBy: "current-user",
      };

      if (invoiceId) {
        await invoicesApi.update(invoiceId, payload);
        toast.success("Invoice updated successfully");
      } else {
        await invoicesApi.create(payload);
        toast.success("Invoice created successfully");
        setType("success");
      }

      setLastUpdated(new Date());
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to save invoice");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setType(invoiceId ? "edit" : "create");
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <FormContext defaultSettings={defaultSettings} data={invoiceData}>
        <InvoiceContent
          type={type}
          onSubmit={handleSubmit}
          onClose={handleClose}
          isSubmitting={isSubmitting}
          lastUpdated={lastUpdated}
        />
      </FormContext>
    </Sheet>
  );
}

