"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "./form";
import { SettingsMenu } from "./settings-menu";
import { FormContext } from "./form-context";
import type { InvoiceFormValues, InvoiceDefaultSettings } from "@/types/invoice";

type InvoiceContentProps = {
  type: "create" | "edit" | "success";
  invoiceId?: string;
  data?: Partial<InvoiceFormValues>;
  defaultSettings?: Partial<InvoiceDefaultSettings>;
  onClose?: () => void;
};

export function InvoiceContent({
  type,
  invoiceId,
  data,
  defaultSettings,
  onClose,
}: InvoiceContentProps) {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    router.push(`/dashboard/sales/invoices/${id}`);
    onClose?.();
  };

  const handleBack = () => {
    onClose?.();
  };

  if (type === "success") {
    return (
      <SuccessContent
        invoiceId={invoiceId!}
        onViewInvoice={() => router.push(`/dashboard/sales/invoices/${invoiceId}`)}
        onCreateAnother={() => window.location.reload()}
        onClose={onClose}
      />
    );
  }

  return (
    <FormContext data={data} defaultSettings={defaultSettings}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {type === "edit" ? "Edit Invoice" : "Create Invoice"}
            </h2>
          </div>
          <SettingsMenu />
        </div>

        {/* Form */}
        <div className="flex-1 overflow-visible">
          <Form invoiceId={invoiceId} onSuccess={handleSuccess} />
        </div>
      </div>
    </FormContext>
  );
}

type SuccessContentProps = {
  invoiceId: string;
  onViewInvoice: () => void;
  onCreateAnother: () => void;
  onClose?: () => void;
};

function SuccessContent({
  invoiceId,
  onViewInvoice,
  onCreateAnother,
  onClose,
}: SuccessContentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">Invoice Created</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Your invoice has been created successfully. You can now view it, send it
        to your customer, or create another one.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCreateAnother}>
          Create Another
        </Button>
        <Button onClick={onViewInvoice}>View Invoice</Button>
      </div>
    </div>
  );
}
