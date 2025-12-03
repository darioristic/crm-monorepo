"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ordersApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { HtmlTemplate } from "@/components/order/templates/html";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Download, Copy, Pencil, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Order as OrderType, OrderTemplate } from "@/types/order";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Order Status Component
function OrderStatus({ status }: { status?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-[#C6F6D5] text-[#22543D]";
      case "cancelled":
        return "bg-[#FED7D7] text-[#822727]";
      case "pending":
        return "bg-[#E2E8F0] text-[#4A5568]";
      case "processing":
        return "bg-[#FEEBC8] text-[#744210]";
      case "refunded":
        return "bg-[#E2E8F0] text-[#4A5568]";
      default:
        return "bg-[#E2E8F0] text-[#4A5568]";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${getStatusColor()}`}
    >
      {status || "pending"}
    </span>
  );
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const { data: order, isLoading, error } = useApi<any>(
    () => ordersApi.getById(id),
    { autoFetch: true }
  );

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
      window.open(`/api/download/order?id=${id}`, "_blank");
    } catch {
      toast.error("Failed to download order");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/sales/orders?type=edit&orderId=${id}`);
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

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <h2 className="text-xl font-semibold mb-2">Order not found</h2>
        <p className="text-muted-foreground mb-4">
          The order you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/dashboard/sales/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>
    );
  }

  // Transform API data to template format
  const templateData = transformOrderToTemplateData(order);
  const width = templateData.template?.size === "letter" ? 750 : 595;
  const height = templateData.template?.size === "letter" ? 1056 : 842;

  return (
    <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] dotted-bg p-4 sm:p-6 md:p-0">
      <div
        className="flex flex-col w-full max-w-full py-6"
        style={{ maxWidth: width }}
      >
        {/* Customer Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild className="mr-2">
              <Link href="/dashboard/sales/orders">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {order.companyName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{order.companyName || "Unknown"}</span>
          </div>

          <OrderStatus status={order.status} />
        </div>

        {/* Order Template with shadow */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={templateData} width={width} height={height} />
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
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
                  {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
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
                <p>Edit order</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>
    </div>
  );
}

// Transform API order to Order type
function transformOrderToTemplateData(order: any): OrderType {
  // Default template
  const defaultTemplate: OrderTemplate = {
    title: "Order",
    customerLabel: "Bill to",
    fromLabel: "From",
    orderNoLabel: "Order No",
    issueDateLabel: "Issue Date",
    descriptionLabel: "Description",
    priceLabel: "Price",
    quantityLabel: "Quantity",
    totalLabel: "Total",
    totalSummaryLabel: "Total",
    vatLabel: "VAT",
    subtotalLabel: "Subtotal",
    taxLabel: "Tax",
    discountLabel: "Discount",
    paymentLabel: "Payment Details",
    noteLabel: "Note",
    logoUrl: null,
    currency: order.currency || "EUR",
    paymentDetails: null,
    fromDetails: null,
    noteDetails: null,
    dateFormat: "dd.MM.yyyy",
    includeVat: Boolean(order.vat),
    includeTax: Boolean(order.tax),
    includeDiscount: Boolean(order.discount),
    includeDecimals: true,
    includeUnits: false,
    includeQr: false,
    includePdf: true,
    taxRate: order.taxRate || 0,
    vatRate: 20,
    size: "a4",
    deliveryType: "create",
    locale: "sr-RS",
    timezone: "Europe/Belgrade",
  };

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    issueDate: order.issueDate,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    amount: order.total || 0,
    currency: order.currency || "EUR",
    discount: order.discount || null,
    vat: order.vat || null,
    tax: order.tax || null,
    subtotal: order.subtotal || null,
    status: order.status || "pending",
    template: defaultTemplate,
    token: order.token || "",
    filePath: null,
    completedAt: order.completedAt || null,
    viewedAt: null,
    cancelledAt: order.cancelledAt || null,
    refundedAt: order.refundedAt || null,
    sentTo: null,
    note: order.notes || null,
    internalNote: null,
    topBlock: null,
    bottomBlock: null,
    customerId: order.companyId || null,
    customerName: order.companyName || null,
    quoteId: order.quoteId || null,
    invoiceId: order.invoiceId || null,
    customer: order.companyName ? {
      id: order.companyId,
      name: order.companyName,
      website: null,
      email: null,
    } : null,
    team: null,
    scheduledAt: null,
    lineItems: (order.items || []).map((item: any) => ({
      name: item.productName || item.description || "",
      quantity: Number(item.quantity) || 1,
      price: Number(item.unitPrice) || 0,
      unit: item.unit || undefined,
      discount: item.discount || 0,
    })),
    fromDetails: getStoredFromDetails(),
    customerDetails: order.companyName ? {
      type: "doc" as const,
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: order.companyName }]
      }]
    } : null,
    paymentDetails: getStoredPaymentDetails(),
    noteDetails: order.notes ? {
      type: "doc" as const,
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: order.notes }]
      }]
    } : null,
  };
}

// Get stored fromDetails from localStorage
function getStoredFromDetails() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("order_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored paymentDetails from localStorage
function getStoredPaymentDetails() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("order_payment_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
