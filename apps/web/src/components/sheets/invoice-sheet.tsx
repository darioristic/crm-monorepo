"use client";

import { useState } from "react";
import { FormContext, type InvoiceFormValues } from "@/components/invoice/form-context";
import { InvoiceContent } from "@/components/invoice/invoice-content";
import { Sheet } from "@/components/ui/sheet";
import type { InvoiceDefaultSettings } from "@/types/invoice";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  invoiceData?: Partial<InvoiceFormValues>;
  defaultSettings?: Partial<InvoiceDefaultSettings>;
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
  const [type, setType] = useState<"create" | "edit" | "success">(invoiceId ? "edit" : "create");

  const handleClose = () => {
    onOpenChange(false);
    setType(invoiceId ? "edit" : "create");
    onSuccess?.();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <FormContext
        defaultSettings={defaultSettings}
        data={type === "edit" ? invoiceData : undefined}
      >
        <InvoiceContent
          type={type}
          invoiceId={invoiceId}
          data={type === "edit" ? invoiceData : undefined}
          defaultSettings={defaultSettings}
          onClose={handleClose}
        />
      </FormContext>
    </Sheet>
  );
}
