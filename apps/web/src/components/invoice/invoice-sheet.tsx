"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Form } from "./form";
import { FormContext } from "./form-context";
import { ProductEditProvider } from "./product-edit-context";
import { ProductEditSheet } from "./product-edit-sheet";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  InvoiceFormValues,
  InvoiceDefaultSettings,
} from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";
import { invoicesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";

type InvoiceSheetProps = {
  defaultSettings?: Partial<InvoiceDefaultSettings>;
};

export function InvoiceSheet({ defaultSettings }: InvoiceSheetProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | "success" | null;
  const invoiceId = searchParams.get("invoiceId");

  const isOpen = type === "create" || type === "edit" || type === "success";

  // Fetch invoice data when editing
  const { data: invoiceData, isLoading: isLoadingInvoice } = useApi(
    () => invoicesApi.getById(invoiceId!),
    { autoFetch: !!invoiceId && type === "edit" }
  );

  // Transform API invoice to form values
  const formData = invoiceData
    ? transformInvoiceToFormValues(invoiceData)
    : undefined;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Remove query params when closing
        router.push(pathname);
      }
    },
    [router, pathname]
  );

  const handleSuccess = useCallback(
    (id: string) => {
      // Show success state
      const params = new URLSearchParams(searchParams);
      params.set("type", "success");
      params.set("invoiceId", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <ProductEditProvider>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        {isOpen && (
          <FormContext defaultSettings={defaultSettings} data={formData}>
            <InvoiceSheetContent
              type={type!}
              invoiceId={invoiceId}
              onSuccess={handleSuccess}
              onClose={() => handleOpenChange(false)}
              isLoading={isLoadingInvoice && type === "edit"}
            />
          </FormContext>
        )}
      </Sheet>
      <ProductEditSheet />
    </ProductEditProvider>
  );
}

type InvoiceSheetContentProps = {
  type: "create" | "edit" | "success";
  invoiceId?: string | null;
  onSuccess: (id: string) => void;
  onClose: () => void;
  isLoading?: boolean;
};

function InvoiceSheetContent({
  type,
  invoiceId,
  onSuccess,
  onClose,
  isLoading,
}: InvoiceSheetContentProps) {
  const [size] = useState(700);

  if (type === "success") {
    return (
      <SheetContent
        side="right"
        noPadding
        className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0"
      >
        <VisuallyHidden>
          <SheetTitle>Invoice Created</SheetTitle>
        </VisuallyHidden>
        <SuccessContent
          invoiceId={invoiceId!}
          onViewInvoice={() => {
            onClose();
            window.location.href = `/dashboard/sales/invoices/${invoiceId}`;
          }}
          onCreateAnother={() => window.location.reload()}
        />
      </SheetContent>
    );
  }

  if (isLoading) {
    return (
      <SheetContent
        side="right"
        style={{ maxWidth: size }}
        noPadding
        className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0"
        hideCloseButton
      >
        <VisuallyHidden>
          <SheetTitle>Loading Invoice...</SheetTitle>
        </VisuallyHidden>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SheetContent>
    );
  }

  return (
    <SheetContent
      side="right"
      style={{ maxWidth: size }}
      noPadding
      className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0 transition-[max-width] duration-300 ease-in-out"
      hideCloseButton
    >
      <VisuallyHidden>
        <SheetTitle>
          {type === "edit" ? "Edit Invoice" : "New Invoice"}
        </SheetTitle>
      </VisuallyHidden>
      <div className="h-full overflow-y-auto">
        <Form invoiceId={invoiceId || undefined} onSuccess={onSuccess} />
      </div>
    </SheetContent>
  );
}

type SuccessContentProps = {
  invoiceId: string;
  onViewInvoice: () => void;
  onCreateAnother: () => void;
};

function SuccessContent({
  invoiceId,
  onViewInvoice,
  onCreateAnother,
}: SuccessContentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[400px]">
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

// Transform API invoice to form values
function transformInvoiceToFormValues(
  invoice: any
): Partial<InvoiceFormValues> {
  return {
    id: invoice.id,
    status: invoice.status,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    customerId: invoice.companyId,
    customerName: invoice.companyName,
    amount: invoice.total || 0,
    subtotal: invoice.subtotal || 0,
    vat: invoice.vat || 0,
    tax: invoice.tax || 0,
    discount: invoice.discount || 0,
    noteDetails: invoice.notes
      ? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: invoice.notes }],
            },
          ],
        }
      : null,
    paymentDetails: invoice.terms
      ? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: invoice.terms }],
            },
          ],
        }
      : null,
    lineItems: (invoice.items || []).map((item: any) => ({
      name: item.productName || item.description || "",
      quantity: item.quantity || 1,
      price: item.unitPrice || 0,
      unit: item.unit || "pcs",
    })),
    template: {
      ...DEFAULT_INVOICE_TEMPLATE,
      currency: invoice.currency || "EUR",
      taxRate: invoice.taxRate || 0,
    },
    token: invoice.token,
  };
}
