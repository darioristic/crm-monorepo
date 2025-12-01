"use client";

import { FormContext, type InvoiceFormValues } from "@/components/invoice/form-context";
import { InvoiceContent } from "@/components/invoice/invoice-content";
import { Sheet } from "@/components/ui/sheet";
import { useState } from "react";
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
  const [type, setType] = useState<"create" | "edit" | "success">(
    invoiceId ? "edit" : "create"
  );

  const handleClose = () => {
    onOpenChange(false);
    setType(invoiceId ? "edit" : "create");
    onSuccess?.();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <FormContext defaultSettings={defaultSettings} data={invoiceData}>
        <InvoiceContent
          type={type}
          invoiceId={invoiceId}
          data={invoiceData}
          defaultSettings={defaultSettings}
          onClose={handleClose}
        />
      </FormContext>
    </Sheet>
  );
}
