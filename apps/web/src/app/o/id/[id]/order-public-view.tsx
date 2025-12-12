"use client";

import type { EditorDoc } from "@crm/schemas";
import { motion } from "framer-motion";
import { Check, Download, Link2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HtmlTemplate } from "@/components/order/templates/html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import type { Order } from "@/types/order";
import { DEFAULT_ORDER_TEMPLATE, formatOrderNumber } from "@/types/order";

// API Order Response Type
interface OrderApiResponse {
  id: string;
  orderNumber: string | null;
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
  customerDetails?: EditorDoc | string | null;
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal: number;
  status: string;
  taxRate?: number;
  vatRate?: number;
  completedAt?: string | null;
  viewedAt?: string | null;
  cancelledAt?: string | null;
  refundedAt?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  fromDetails?: EditorDoc | string | null;
  logoUrl?: string | null;
}

type OrderPublicViewProps = {
  order: OrderApiResponse;
};

// Order Status Component
function OrderStatus({ status }: { status?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-[#C6F6D5] text-[#22543D]";
      case "cancelled":
        return "bg-[#FED7D7] text-[#822727]";
      case "pending":
        return "bg-[#FEEBC8] text-[#744210]";
      case "processing":
        return "bg-[#BEE3F8] text-[#2C5282]";
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

// Get stored fromDetails from localStorage
function getStoredFromDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("order_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored paymentDetails from localStorage
function getStoredPaymentDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("order_payment_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored logo from localStorage or use default
function getStoredLogo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("order_logo_url");
    return stored || null;
  } catch {
    return null;
  }
}

// Default logo URL
const DEFAULT_LOGO_URL: string | null = "/logo.png";

// Build customer details from company data
function buildCustomerDetails(order: OrderApiResponse): EditorDoc | null {
  const lines: string[] = [];

  const companyName = order.companyName || order.company?.name;
  if (companyName) {
    lines.push(companyName);
  }

  if (order.company) {
    if (order.company.addressLine1) {
      lines.push(order.company.addressLine1);
    } else if (order.company.address) {
      lines.push(order.company.address);
    }

    if (order.company.addressLine2) {
      lines.push(order.company.addressLine2);
    }

    const cityLine = [
      order.company.city,
      order.company.zip || order.company.postalCode,
      order.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);

    if (order.company.email || order.company.billingEmail) {
      const email = order.company.billingEmail || order.company.email;
      if (email) lines.push(email);
    }

    if (order.company.phone) lines.push(order.company.phone);

    if (order.company.vatNumber) {
      lines.push(`VAT: ${order.company.vatNumber}`);
    }
  }

  if (lines.length === 0) return null;

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

// Parse fromDetails from API response (may be string or object)
function parseFromDetails(apiFromDetails: EditorDoc | string | null | undefined): EditorDoc | null {
  if (!apiFromDetails) return null;

  let parsed: unknown = apiFromDetails;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (parsed && typeof parsed === "object" && (parsed as EditorDoc).type === "doc") {
    return parsed as EditorDoc;
  }

  return null;
}

// Build from details (seller info) with fallback chain: API -> localStorage -> default
function buildFromDetails(
  apiFromDetails: EditorDoc | string | null | undefined,
  storedFromDetails: EditorDoc | null
): EditorDoc | null {
  // First try API response
  const fromApi = parseFromDetails(apiFromDetails);
  if (fromApi) return fromApi;

  // Then try localStorage
  if (storedFromDetails) return storedFromDetails;

  // Return default placeholder
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Your Company Name" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Your Address" }] },
      { type: "paragraph", content: [{ type: "text", text: "City, Country" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "email@company.com" }],
      },
    ],
  };
}

export function OrderPublicView({ order }: OrderPublicViewProps) {
  const { isAuthenticated } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDetails, setFromDetails] = useState<EditorDoc | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<EditorDoc | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Load stored details on mount - API data takes priority
  useEffect(() => {
    setFromDetails(getStoredFromDetails());
    setPaymentDetails(getStoredPaymentDetails());
    // Use API logoUrl first, then localStorage, then default
    setLogoUrl(order.logoUrl || getStoredLogo() || DEFAULT_LOGO_URL);
  }, [order.logoUrl]);

  const customerName = order.companyName || order.company?.name || "Customer";

  // Transform API data to Order type
  // Prefer stored customerDetails from API; fallback to built from company fields
  let customerDoc: EditorDoc | null = null;
  const rawCustomer = order.customerDetails;
  if (rawCustomer) {
    let parsed: unknown = rawCustomer;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    if (parsed && typeof parsed === "object" && (parsed as EditorDoc).type === "doc") {
      customerDoc = parsed as EditorDoc;
    }
  }

  const orderData: Order = {
    id: order.id,
    orderNumber: formatOrderNumber(order.orderNumber),
    issueDate: order.createdAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    amount: order.total,
    currency: order.currency || "EUR",
    lineItems:
      order.items?.map((item) => ({
        name: item.productName || item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount ?? 0,
        vat: item.vat ?? item.vatRate ?? order.vatRate ?? 20,
      })) || [],
    paymentDetails:
      paymentDetails ||
      (order.terms
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: order.terms }],
              },
            ],
          }
        : null),
    customerDetails: customerDoc || buildCustomerDetails(order),
    fromDetails: buildFromDetails(order.fromDetails, fromDetails),
    noteDetails: order.notes
      ? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: order.notes }],
            },
          ],
        }
      : null,
    note: order.notes ?? null,
    internalNote: null,
    vat: order.vat || null,
    tax: order.tax || null,
    discount: order.discount || null,
    subtotal: order.subtotal,
    status: ["pending", "processing", "completed", "cancelled", "refunded"].includes(order.status)
      ? (order.status as Order["status"])
      : "pending",
    template: {
      ...DEFAULT_ORDER_TEMPLATE,
      logoUrl: logoUrl,
      taxRate: order.taxRate || 0,
      vatRate: order.vatRate || 20,
      currency: order.currency || "EUR",
      includeVat: true,
      includeTax: Boolean(order.tax),
      includeDiscount: true,
      includeDecimals: true,
    },
    token: order.id,
    filePath: null,
    completedAt: order.completedAt ?? null,
    viewedAt: order.viewedAt ?? null,
    cancelledAt: order.cancelledAt ?? null,
    refundedAt: order.refundedAt ?? null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: order.companyId,
    customerName: customerName,
    quoteId: order.quoteId ?? null,
    invoiceId: order.invoiceId ?? null,
    customer: {
      id: order.companyId,
      name: customerName,
      website: order.company?.website || null,
      email: order.company?.email || null,
    },
    team: null,
    scheduledAt: null,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      window.open(`/api/download/order?id=${order.id}`, "_blank");
    } catch {
      toast.error("Failed to download order");
    } finally {
      setIsDownloading(false);
    }
  };

  const width = orderData.template?.size === "letter" ? 780 : 625;
  const height = orderData.template?.size === "letter" ? 1056 : 842;

  return (
    <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4 sm:p-6 md:p-0">
      <div className="flex flex-col w-full max-w-full py-6" style={{ maxWidth: width }}>
        {/* Customer Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {customerName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{customerName}</span>
          </div>

          <OrderStatus status={orderData.status} />
        </div>

        {/* Order Template */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={orderData} width={width} height={height} disableScroll />
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
                  disabled={isDownloading}
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
                  {isCopied ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Link2 className="size-4" />
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

          {isAuthenticated && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-8"
                    onClick={() => {
                      window.location.href = `/dashboard/sales/orders?type=edit&orderId=${order.id}`;
                    }}
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
          )}
        </div>
      </motion.div>

      {/* Powered by badge */}
      <div className="fixed bottom-4 right-4 hidden md:block">
        <span className="text-[9px] text-[#878787]">
          Powered by <span className="text-primary">CRM</span>
        </span>
      </div>
    </div>
  );
}
