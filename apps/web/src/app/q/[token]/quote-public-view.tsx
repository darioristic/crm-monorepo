"use client";

import { motion } from "framer-motion";
import { ArrowRightCircle, Check, Download, Link2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HtmlTemplate } from "@/components/quote/templates/html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import type { EditorDoc, Quote } from "@/types/quote";
import { createEditorDocFromText, DEFAULT_QUOTE_TEMPLATE, formatQuoteNumber } from "@/types/quote";

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
  fromDetails?: unknown;
  customerDetails?: unknown;
  logoUrl?: string | null;
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
}

type QuotePublicViewProps = {
  quote: QuoteApiResponse;
  token: string;
};

// Quote Status Component
function QuoteStatus({ status }: { status?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "accepted":
        return "bg-[#C6F6D5] text-[#22543D]";
      case "rejected":
        return "bg-[#FED7D7] text-[#822727]";
      case "draft":
        return "bg-[#E2E8F0] text-[#4A5568]";
      case "sent":
        return "bg-[#FEEBC8] text-[#744210]";
      case "expired":
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

// Get stored fromDetails from localStorage
function getStoredFromDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("quote_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored paymentDetails from localStorage
function getStoredPaymentDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("quote_payment_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored logo from localStorage or use default
function getStoredLogo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("quote_logo_url");
    return stored || null;
  } catch {
    return null;
  }
}

// Default logo URL - uses /logo.png from public folder
const DEFAULT_LOGO_URL: string | null = "/logo.png";

// Build customer details from company data (Bill to)
function buildCustomerDetails(quote: QuoteApiResponse): EditorDoc | null {
  const lines: string[] = [];

  // Get company name from either direct field or nested object
  const companyName = quote.companyName || quote.company?.name;
  if (companyName) {
    lines.push(companyName);
  }

  // Try to get company details from quote.company if available
  if (quote.company) {
    // Address line 1
    if (quote.company.addressLine1) {
      lines.push(quote.company.addressLine1);
    } else if (quote.company.address) {
      lines.push(quote.company.address);
    }

    // Address line 2
    if (quote.company.addressLine2) {
      lines.push(quote.company.addressLine2);
    }

    // City, Zip/PostalCode, Country
    const cityLine = [
      quote.company.city,
      quote.company.zip || quote.company.postalCode,
      quote.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);

    // Email
    if (quote.company.email || quote.company.billingEmail) {
      const email = quote.company.billingEmail || quote.company.email;
      if (email) lines.push(email);
    }

    // Phone
    if (quote.company.phone) lines.push(quote.company.phone);

    // VAT Number
    if (quote.company.vatNumber) {
      lines.push(`VAT: ${quote.company.vatNumber}`);
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

// Parse fromDetails from API response
function parseFromDetails(apiFromDetails: unknown): EditorDoc | null {
  if (!apiFromDetails) return null;

  let parsed = apiFromDetails;
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

// Build from details (seller info) - uses API data first, then localStorage, then defaults
function buildFromDetails(
  apiFromDetails: unknown,
  storedFromDetails: EditorDoc | null
): EditorDoc | null {
  // First priority: use from API if available
  const fromApi = parseFromDetails(apiFromDetails);
  if (fromApi) return fromApi;

  // Second priority: use from localStorage
  if (storedFromDetails) return storedFromDetails;

  // Default company info (can be configured in settings)
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

function parseDoc(raw: unknown): EditorDoc | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object" && (obj as EditorDoc).type === "doc") {
        return obj as EditorDoc;
      }
    } catch {}
    return createEditorDocFromText(raw);
  }
  if (raw && typeof raw === "object" && (raw as EditorDoc).type === "doc") {
    return raw as EditorDoc;
  }
  return null;
}

export function QuotePublicView({ quote, token }: QuotePublicViewProps) {
  const { isAuthenticated } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDetails, setFromDetails] = useState<EditorDoc | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<EditorDoc | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Load stored details on mount (for fallback only)
  useEffect(() => {
    setFromDetails(getStoredFromDetails());
    setPaymentDetails(getStoredPaymentDetails());
    // Priority: API logoUrl > localStorage > default
    setLogoUrl(quote.logoUrl || getStoredLogo() || DEFAULT_LOGO_URL);
  }, [quote.logoUrl]);

  // Get customer name from company object
  const customerName = quote.companyName || quote.company?.name || "Customer";

  // Transform API data to Quote type
  const quoteData: Quote = {
    id: quote.id,
    quoteNumber: formatQuoteNumber(quote.quoteNumber),
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    amount: quote.total,
    currency: quote.currency || "EUR",
    lineItems:
      quote.items?.map((item) => ({
        name: item.productName || item.description || "",
        description: item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount ?? 0,
        vat: item.vat ?? item.vatRate ?? quote.vatRate ?? 20,
      })) || [],
    paymentDetails: paymentDetails || parseDoc(quote.terms),
    customerDetails: buildCustomerDetails(quote),
    fromDetails: buildFromDetails(quote.fromDetails, fromDetails),
    noteDetails: parseDoc(quote.notes),
    note: quote.notes ?? null,
    internalNote: null,
    vat: quote.vat || null,
    tax: quote.tax || null,
    discount: quote.discount || null,
    subtotal: quote.subtotal,
    status: ["draft", "sent", "accepted", "rejected", "expired"].includes(quote.status)
      ? (quote.status as Quote["status"])
      : "draft",
    template: {
      ...DEFAULT_QUOTE_TEMPLATE,
      logoUrl: logoUrl,
      taxRate: quote.taxRate || 0,
      vatRate: quote.vatRate || 20,
      currency: quote.currency || "EUR",
      includeVat: true,
      includeTax: Boolean(quote.tax),
      includeDiscount: true,
      includeDecimals: true,
    },
    token: token,
    filePath: null,
    sentAt: quote.sentAt ?? null,
    viewedAt: quote.viewedAt ?? null,
    acceptedAt: quote.acceptedAt ?? null,
    rejectedAt: quote.rejectedAt ?? null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: quote.companyId,
    customerName: customerName,
    customer: {
      id: quote.companyId,
      name: customerName,
      website: quote.company?.website || null,
      email: quote.company?.email || null,
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
      window.open(`/api/download/quote?id=${quote.id}`, "_blank");
    } catch {
      toast.error("Failed to download quote");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConvertToOrder = async () => {
    try {
      toast.info("Converting quote to order...");
      const { quotesApi } = await import("@/lib/api");
      const result = await quotesApi.convertToOrder(quote.id);

      const orderId = result?.data?.id;

      if (orderId) {
        toast.success("Quote successfully converted to order!");
        // Navigate to the newly created order
        window.location.href = `/dashboard/sales/orders?type=edit&orderId=${orderId}`;
      } else {
        console.error("No order id in response. Full result:", JSON.stringify(result, null, 2));
        toast.error("Failed to convert quote to order - no order ID returned");
      }
    } catch (error) {
      console.error("Convert to order error:", error);
      toast.error(
        `Failed to convert quote to order: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const handleConvertToInvoice = async () => {
    try {
      toast.info("Converting quote to invoice...");
      const { quotesApi } = await import("@/lib/api");
      const result = await quotesApi.convertToInvoice(quote.id);

      const invoiceId = result?.data?.invoiceId;
      if (invoiceId) {
        toast.success("Quote successfully converted to invoice!");
        // Navigate to the newly created invoice
        window.location.href = `/dashboard/sales/invoices?type=edit&invoiceId=${invoiceId}`;
      } else {
        console.error("No invoiceId in response:", result);
        toast.error("Failed to convert quote to invoice - no invoice ID returned");
      }
    } catch (error) {
      console.error("Convert to invoice error:", error);
      toast.error(
        `Failed to convert quote to invoice: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const width = quoteData.template?.size === "letter" ? 780 : 625;
  const height = quoteData.template?.size === "letter" ? 1056 : 842;

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

          <QuoteStatus status={quoteData.status} />
        </div>

        {/* Quote Template */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={quoteData} width={width} height={height} disableScroll />
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
            <>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full size-8">
                          <ArrowRightCircle className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleConvertToOrder}>
                          Convert to Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleConvertToInvoice}>
                          Convert to Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipTrigger>
                  <TooltipContent
                    sideOffset={15}
                    className="text-[10px] px-2 py-1 rounded-sm font-medium"
                  >
                    <p>Convert</p>
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
                      onClick={() => {
                        window.location.href = `/dashboard/sales/quotes?type=edit&quoteId=${quote.id}`;
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    sideOffset={15}
                    className="text-[10px] px-2 py-1 rounded-sm font-medium"
                  >
                    <p>Edit quote</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
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
