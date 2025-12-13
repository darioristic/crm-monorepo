"use client";

import type { InvoiceWithRelations } from "@crm/types";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Copy, Download, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { HtmlTemplate } from "@/components/invoice/templates/html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useApi } from "@/hooks/use-api";
import { invoicesApi } from "@/lib/api";
import type { InvoiceTemplate, Invoice as InvoiceType } from "@/types/invoice";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Invoice Status Component - copied from Midday
function InvoiceStatus({ status }: { status?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "paid":
        return "bg-[#C6F6D5] text-[#22543D]";
      case "overdue":
        return "bg-[#FED7D7] text-[#822727]";
      case "draft":
        return "bg-[#E2E8F0] text-[#4A5568]";
      case "unpaid":
      case "sent":
        return "bg-[#FEEBC8] text-[#744210]";
      case "canceled":
        return "bg-[#E2E8F0] text-[#4A5568]";
      default:
        return "bg-[#E2E8F0] text-[#4A5568]";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${getStatusColor()}`}
    >
      {status || "draft"}
    </span>
  );
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const {
    data: invoice,
    isLoading,
    error,
  } = useApi<InvoiceWithRelations>(() => invoicesApi.getById(id), { autoFetch: true });

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      toast.info("Preparing PDF download...");
      window.open(`/api/download/invoice?id=${id}`, "_blank");
    } catch {
      toast.error("Failed to download invoice");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/sales/invoices?type=edit&invoiceId=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] dotted-bg p-4">
        <div className="flex flex-col w-full max-w-[595px] py-6">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-[842px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
        <p className="text-muted-foreground mb-4">
          The invoice you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/dashboard/sales/invoices">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
      </div>
    );
  }

  // Transform API data to template format
  const templateData = transformInvoiceToTemplateData(invoice);
  const width = templateData.template?.size === "letter" ? 750 : 595;
  const height = templateData.template?.size === "letter" ? 1056 : 842;

  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] dotted-bg p-4 sm:p-6 md:p-0">
      <div className="flex flex-col w-full max-w-full py-6" style={{ maxWidth: width }}>
        {/* Customer Header - Identical to Midday */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild className="mr-2">
              <Link href="/dashboard/sales/invoices">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {(invoice.company?.name || "")?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{invoice.company?.name || "Unknown"}</span>
          </div>

          <InvoiceStatus status={invoice.status} />
        </div>

        {/* Invoice Template with shadow - Identical to Midday */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={templateData} width={width} height={height} />
          </div>
        </div>
      </div>

      {/* Floating Toolbar - Identical to Midday */}
      <motion.div
        className="fixed inset-x-0 -bottom-1 flex justify-center"
        initial={{ opacity: 0, filter: "blur(8px)", y: 0 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: -24 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="backdrop-filter backdrop-blur-lg dark:bg-[#1A1A1A]/80 bg-[#F6F6F3]/80 rounded-full pl-2 pr-4 py-3 h-10 flex items-center justify-center border-[0.5px] border-border">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full size-8"
                  onClick={handleDownload}
                >
                  <Download className="size-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={15}
                className="text-[10px] px-2 py-1 rounded-sm font-medium"
              >
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full size-8"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={15}
                className="text-[10px] px-2 py-1 rounded-sm font-medium"
              >
                <p>Copy link</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full size-8"
                  onClick={handleEdit}
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={15}
                className="text-[10px] px-2 py-1 rounded-sm font-medium"
              >
                <p>Edit invoice</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>
    </div>
  );
}

// Transform API invoice to Midday Invoice type
function transformInvoiceToTemplateData(invoice: InvoiceWithRelations): InvoiceType {
  // Default template - identical to Midday
  const defaultTemplate: InvoiceTemplate = {
    title: "Invoice",
    customerLabel: "To Customer",
    fromLabel: "From",
    invoiceNoLabel: "Invoice No",
    issueDateLabel: "Issue Date",
    dueDateLabel: "Due Date",
    descriptionLabel: "Description",
    priceLabel: "Price",
    quantityLabel: "Quantity",
    unitLabel: "Unit",
    totalLabel: "Total",
    totalSummaryLabel: "Total",
    vatLabel: "VAT",
    subtotalLabel: "Subtotal",
    taxLabel: "Tax",
    discountLabel: "Discount",
    paymentLabel: "Payment Details",
    noteLabel: "Note",
    logoUrl: null,
    currency: invoice.currency || "EUR",
    paymentDetails: null,
    fromDetails: null,
    noteDetails: null,
    dateFormat: "dd.MM.yyyy",
    // biome-ignore lint/suspicious/noExplicitAny: vatRate may exist on invoice
    includeVat: Boolean((invoice as any).vatRate),
    includeTax: Boolean(invoice.tax),
    includeDiscount: Boolean(invoice.discount),
    includeDecimals: true,
    includeUnits: true,
    includeQr: false,
    includePdf: true,
    taxRate: invoice.taxRate || 0,
    vatRate: 20,
    size: "a4",
    deliveryType: "create",
    locale: "sr-RS",
    timezone: "Europe/Belgrade",
  };

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    amount: invoice.total || 0,
    currency: invoice.currency || "EUR",
    discount: invoice.discount || null,
    // biome-ignore lint/suspicious/noExplicitAny: vat may exist on invoice
    vat: (invoice as any).vat ?? null,
    tax: invoice.tax || null,
    subtotal: invoice.subtotal || null,
    status: mapInvoiceStatus(invoice.status),
    template: defaultTemplate,
    token: invoice.token || "",
    filePath: null,
    paidAt: invoice.paidAt || null,
    sentAt: invoice.sentAt || null,
    viewedAt: null,
    reminderSentAt: null,
    sentTo: null,
    note: invoice.notes || null,
    internalNote: null,
    topBlock: null,
    bottomBlock: null,
    customerId: invoice.companyId || null,
    customerName: invoice.company?.name || null,
    customer: invoice.company?.name
      ? {
          id: invoice.companyId,
          name: invoice.company?.name || null,
          website: null,
          email: null,
        }
      : null,
    team: null,
    scheduledAt: null,
    lineItems: (invoice.items || []).map((item: InvoiceWithRelations["items"][number]) => ({
      name: item.productName || item.description || "",
      description: item.description || "",
      quantity: Number(item.quantity) || 1,
      price: Number(item.unitPrice) || 0,
      unit: item.unit || "pcs",
      // biome-ignore lint/suspicious/noExplicitAny: item fields may vary
      discount: (item as any).discount ?? 0,
      // biome-ignore lint/suspicious/noExplicitAny: vatRate may exist on item/invoice
      vat: (item as any).vatRate ?? (invoice as any).vatRate ?? 0,
    })),
    fromDetails: getStoredFromDetails(),
    customerDetails: invoice.company?.name
      ? {
          type: "doc" as const,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: invoice.company?.name as string,
                },
              ],
            },
          ],
        }
      : null,
    paymentDetails:
      getStoredPaymentDetails() ||
      (invoice.terms
        ? {
            type: "doc" as const,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: invoice.terms }],
              },
            ],
          }
        : null),
    noteDetails: invoice.notes
      ? {
          type: "doc" as const,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: invoice.notes }],
            },
          ],
        }
      : null,
  };
}

function mapInvoiceStatus(s?: string): InvoiceType["status"] {
  switch (s) {
    case "paid":
      return "paid";
    case "overdue":
      return "overdue";
    case "scheduled":
      return "scheduled";
    case "cancelled":
      return "canceled";
    case "partial":
    case "sent":
      return "unpaid";
    default:
      return "draft";
  }
}

// Get stored fromDetails from localStorage
function getStoredFromDetails() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored paymentDetails from localStorage
function getStoredPaymentDetails() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_payment_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
