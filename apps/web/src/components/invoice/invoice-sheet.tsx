"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Form } from "./form";
import { FormContext } from "./form-context";
import { ProductEditProvider } from "./product-edit-context";
import { ProductEditSheet } from "./product-edit-sheet";
import { Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InvoiceFormValues,
  InvoiceDefaultSettings,
} from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";
import { invoicesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

// API Invoice Response Type
interface InvoiceApiResponse {
  id: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  total: number;
  currency?: string | null;
  items?: Array<{
    productName?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    unit?: string;
    discount?: number;
    vat?: number;
    vatRate?: number;
  }>;
  terms?: string;
  notes?: string;
  companyId: string;
  companyName?: string;
  company?: {
    name?: string;
    addressLine1?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    zip?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    billingEmail?: string;
    phone?: string;
    vatNumber?: string;
    website?: string;
  };
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal: number;
  status: string;
  taxRate?: number;
  vatRate?: number;
  paidAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  token?: string;
}

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

  // Fetch invoice data when editing or showing success
  const { data: invoiceData, isLoading: isLoadingInvoice } = useApi(
    () => invoicesApi.getById(invoiceId!),
    { autoFetch: !!invoiceId && (type === "edit" || type === "success") }
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
              invoiceData={invoiceData}
              onSuccess={handleSuccess}
              onClose={() => handleOpenChange(false)}
              isLoading={isLoadingInvoice && (type === "edit" || type === "success")}
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
  invoiceData?: InvoiceApiResponse;
  onSuccess: (id: string) => void;
  onClose: () => void;
  isLoading?: boolean;
};

function InvoiceSheetContent({
  type,
  invoiceId,
  invoiceData,
  onSuccess,
  onClose,
  isLoading,
}: InvoiceSheetContentProps) {
  const [size] = useState(700);

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
          invoice={invoiceData}
          onViewInvoice={() => {
            window.open(`/i/id/${invoiceId}`, "_blank", "noopener,noreferrer");
          }}
          onCreateAnother={() => window.location.reload()}
        />
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
  invoice?: InvoiceApiResponse;
  onViewInvoice: () => void;
  onCreateAnother: () => void;
};

function SuccessContent({
  invoiceId,
  invoice,
  onViewInvoice,
  onCreateAnother,
}: SuccessContentProps) {
  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/i/id/${invoiceId}` 
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleDownload = () => {
    window.open(`/api/download/invoice?id=${invoiceId}`, "_blank");
  };

  // Get company data
  const company = invoice?.company;
  const companyName = company?.name || invoice?.companyName;

  // Build address line (zip + city) or use full address
  const addressLine = [company?.zip, company?.city].filter(Boolean).join(" ") || company?.address;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-8 pb-0">
        <h1 className="text-2xl font-semibold mb-1">Created</h1>
        <p className="text-muted-foreground">
          Your invoice was created successfully
        </p>
      </div>

      {/* Invoice Preview Card */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="bg-[#FAFAFA] dark:bg-muted/30 rounded-lg p-6 relative">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-xs text-muted-foreground">Invoice No:</span>
              <span className="text-sm font-medium ml-1">
                {invoice?.invoiceNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Due Date:</span>
              <span className="text-sm font-medium ml-1">
                {invoice?.dueDate ? formatDate(invoice.dueDate) : "—"}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <p className="text-xs font-medium text-foreground mb-2">To</p>
            <div className="space-y-0.5">
              {companyName && (
                <p className="text-sm text-muted-foreground">{companyName}</p>
              )}
              {addressLine && (
                <p className="text-sm text-muted-foreground">{addressLine}</p>
              )}
              {company?.country && (
                <p className="text-sm text-muted-foreground">{company.country}</p>
              )}
              {company?.vatNumber && (
                <p className="text-sm text-muted-foreground">PIB: {company.vatNumber}</p>
              )}
              {company?.phone && (
                <p className="text-sm text-muted-foreground">Tel: {company.phone}</p>
              )}
              {(company?.email || company?.billingEmail) && (
                <p className="text-sm text-muted-foreground">
                  E-mail:{" "}
                  <a href={`mailto:${company.email || company.billingEmail}`} className="underline">
                    {company.email || company.billingEmail}
                  </a>
                </p>
              )}
              {!companyName && !company && (
                <p className="text-sm text-muted-foreground">Customer</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold">
              {formatCurrency(invoice?.total || 0, invoice?.currency || "EUR")}
            </span>
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-border my-6" />

          {/* Details Section */}
          <div>
            <h3 className="text-base font-medium mb-4">Details</h3>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Share link</p>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="bg-background text-sm font-mono"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleDownload}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Decorative bottom wave */}
          <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
            <svg
              viewBox="0 0 400 20"
              className="w-full h-full text-background"
              preserveAspectRatio="none"
            >
              <path
                d="M0,20 Q10,0 20,20 T40,20 T60,20 T80,20 T100,20 T120,20 T140,20 T160,20 T180,20 T200,20 T220,20 T240,20 T260,20 T280,20 T300,20 T320,20 T340,20 T360,20 T380,20 T400,20 L400,20 L0,20 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-8 pt-0 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onViewInvoice}>
          View invoice
        </Button>
        <Button className="flex-1" onClick={onCreateAnother}>
          Create another
        </Button>
      </div>
    </div>
  );
}

// Transform API invoice to form values
function transformInvoiceToFormValues(
  invoice: InvoiceApiResponse
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
    lineItems: (invoice.items || []).map((item) => ({
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
