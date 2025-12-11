"use client";

import type { QuoteFormValues } from "@crm/schemas";
import { formatCurrency, formatDateDMY } from "@crm/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Copy, Download, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { documentsApi, quotesApi } from "@/lib/api";
import type { QuoteDefaultSettings } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE } from "@/types/quote";
import { Form } from "./form";
import { FormContext } from "./form-context";
import { ProductEditProvider } from "./product-edit-context";
import { ProductEditSheet } from "./product-edit-sheet";

// API Quote Response Type
interface QuoteApiResponse {
  id: string;
  quoteNumber: string | null;
  issueDate: string | null;
  validUntil: string | null;
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
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  token?: string;
  fromDetails?: any;
  customerDetails?: any;
}

type QuoteSheetProps = {
  defaultSettings?: Partial<QuoteDefaultSettings>;
  onQuoteCreated?: (id: string) => void;
};

export function QuoteSheet({ defaultSettings, onQuoteCreated }: QuoteSheetProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | "success" | null;
  const quoteId = searchParams.get("quoteId");

  const isOpen = type === "create" || type === "edit" || type === "success";

  // Fetch quote data when editing or showing success
  const { data: quoteData, isLoading: isLoadingQuote } = useApi(() => quotesApi.getById(quoteId!), {
    autoFetch: !!quoteId && (type === "edit" || type === "success"),
  });

  // Transform API quote to form values
  const formData = quoteData ? transformQuoteToFormValues(quoteData) : undefined;

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
    async (id: string) => {
      if (type === "create") {
        onQuoteCreated?.(id);
      }
      const params = new URLSearchParams(searchParams);
      params.set("type", "success");
      params.set("quoteId", id);
      router.push(`${pathname}?${params.toString()}`);

      // Store the quote PDF in vault (server-side for reliability)
      try {
        const response = await fetch("/api/vault/store-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId: id }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn("Failed to store quote PDF in vault:", errorData);
        }
      } catch (error) {
        console.warn("Failed to store quote PDF in vault:", error);
      }
    },
    [router, pathname, searchParams, type, onQuoteCreated]
  );

  return (
    <ProductEditProvider>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        {isOpen && (
          <FormContext
            key={`${type}-${quoteId || "new"}`}
            defaultSettings={defaultSettings}
            data={formData}
          >
            <QuoteSheetContent
              type={type!}
              quoteId={quoteId}
              quoteData={quoteData}
              onSuccess={handleSuccess}
              onClose={() => handleOpenChange(false)}
              isLoading={isLoadingQuote && (type === "edit" || type === "success")}
            />
          </FormContext>
        )}
      </Sheet>
      <ProductEditSheet />
    </ProductEditProvider>
  );
}

type QuoteSheetContentProps = {
  type: "create" | "edit" | "success";
  quoteId?: string | null;
  quoteData?: QuoteApiResponse;
  onSuccess: (id: string) => void;
  onClose: () => void;
  isLoading?: boolean;
};

function QuoteSheetContent({
  type,
  quoteId,
  quoteData,
  onSuccess,
  onClose,
  isLoading,
}: QuoteSheetContentProps) {
  const [size] = useState(700);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleCreateAnother = () => {
    const params = new URLSearchParams(searchParams);
    params.set("type", "create");
    params.delete("quoteId");
    router.push(`${pathname}?${params.toString()}`);
  };

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
          <SheetTitle>Loading Quote...</SheetTitle>
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
          <SheetTitle>Quote Created</SheetTitle>
        </VisuallyHidden>
        {/* Success state with actions */}
        {/* Ensure "Create another" opens fresh create editor without reloading */}
        {/* Use router and current path to set type=create and clear quoteId */}
        <SuccessContent
          quoteId={quoteId!}
          quote={quoteData}
          onViewQuote={() => {
            window.open(`/q/id/${quoteId}`, "_blank", "noopener,noreferrer");
          }}
          onCreateAnother={handleCreateAnother}
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
        <SheetTitle>{type === "edit" ? "Edit Quote" : "New Quote"}</SheetTitle>
      </VisuallyHidden>
      <div className="h-full overflow-y-auto">
        <Form quoteId={quoteId || undefined} onSuccess={onSuccess} />
      </div>
    </SheetContent>
  );
}

type SuccessContentProps = {
  quoteId: string;
  quote?: QuoteApiResponse;
  onViewQuote: () => void;
  onCreateAnother: () => void;
};

function SuccessContent({ quoteId, quote, onViewQuote, onCreateAnother }: SuccessContentProps) {
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/q/id/${quoteId}` : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleDownload = () => {
    window.open(`/api/download/quote?id=${quoteId}`, "_blank");
  };

  // Get company data
  const company = quote?.company;
  const companyName = company?.name || quote?.companyName;

  // Build address line (zip + city) or use full address
  const addressLine = [company?.zip, company?.city].filter(Boolean).join(" ") || company?.address;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-8 pb-0">
        <h1 className="text-2xl font-semibold mb-1">Created</h1>
        <p className="text-muted-foreground">Your quote was created successfully</p>
      </div>

      {/* Quote Preview Card */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="bg-[#FAFAFA] dark:bg-muted/30 rounded-lg p-6 relative">
          {/* Quote Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-xs text-muted-foreground">Quote No:</span>
              <span className="text-sm font-medium ml-1">{quote?.quoteNumber || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Valid Until:</span>
              <span className="text-sm font-medium ml-1">
                {quote?.validUntil ? formatDateDMY(quote.validUntil) : "—"}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <p className="text-xs font-medium text-foreground mb-2">To</p>
            <div className="space-y-0.5">
              {companyName && <p className="text-sm text-muted-foreground">{companyName}</p>}
              {addressLine && <p className="text-sm text-muted-foreground">{addressLine}</p>}
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
              {formatCurrency(quote?.total || 0, quote?.currency || "EUR", "sr-RS")}
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
                <Input value={shareUrl} readOnly className="bg-background text-sm font-mono" />
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
              <title>Decorative wave separator</title>
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
        <Button variant="outline" className="flex-1" onClick={onViewQuote}>
          View quote
        </Button>
        <Button className="flex-1" onClick={onCreateAnother}>
          Create another
        </Button>
      </div>
    </div>
  );
}

// Transform API quote to form values
function transformQuoteToFormValues(quote: QuoteApiResponse): Partial<QuoteFormValues> {
  const allowed: QuoteFormValues["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];
  const status = allowed.includes(quote.status as any)
    ? (quote.status as QuoteFormValues["status"])
    : ("draft" as QuoteFormValues["status"]);
  return {
    id: quote.id,
    status,
    quoteNumber: quote.quoteNumber ?? "",
    issueDate: (quote.issueDate ?? "") as string,
    validUntil: (quote.validUntil ?? "") as string,
    customerId: quote.companyId,
    customerName: quote.companyName,
    amount: quote.total || 0,
    subtotal: quote.subtotal || 0,
    vat: quote.vat || 0,
    tax: quote.tax || 0,
    discount: quote.discount || 0,
    noteDetails: quote.notes
      ? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: quote.notes }],
            },
          ],
        }
      : null,
    paymentDetails: quote.terms
      ? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: quote.terms }],
            },
          ],
        }
      : null,
    fromDetails: quote.fromDetails || null,
    customerDetails: quote.customerDetails || null,
    lineItems: (quote.items || []).map((item) => ({
      name: item.productName || "",
      description: item.description || "",
      quantity: item.quantity ?? 1,
      price: item.unitPrice ?? 0,
      unit: item.unit ?? "pcs",
      discount: item.discount ?? 0,
      vat: item.vat ?? item.vatRate ?? 0,
      productId: undefined,
    })),
    template: {
      ...DEFAULT_QUOTE_TEMPLATE,
      currency: quote.currency || "EUR",
      taxRate: quote.taxRate || 0,
    },
    token: quote.token,
  };
}
