"use client";

import { motion } from "framer-motion";
import { Check, Download, Link2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HtmlTemplate } from "@/components/invoice/templates/html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import type { EditorDoc, Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

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
  paidAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
}

type InvoicePublicViewProps = {
  invoice: InvoiceApiResponse;
  token: string;
};

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
      case "cancelled":
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
    const stored = localStorage.getItem("invoice_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored paymentDetails from localStorage
function getStoredPaymentDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_payment_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Get stored logo from localStorage or use default
function getStoredLogo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_logo_url");
    // Return stored value or a default placeholder logo
    // TODO: Replace with actual company logo from settings
    return stored || null;
  } catch {
    return null;
  }
}

// Default logo URL - uses /logo.png from public folder
// Override by setting: localStorage.setItem('invoice_logo_url', 'https://your-logo-url.com/logo.png')
const DEFAULT_LOGO_URL: string | null = "/logo.png";

// Build customer details from company data (Bill to)
function buildCustomerDetails(invoice: InvoiceApiResponse): EditorDoc | null {
  const lines: string[] = [];

  // Get company name from either direct field or nested object
  const companyName = invoice.companyName || invoice.company?.name;
  if (companyName) {
    lines.push(companyName);
  }

  // Try to get company details from invoice.company if available
  if (invoice.company) {
    // Address line 1
    if (invoice.company.addressLine1) {
      lines.push(invoice.company.addressLine1);
    } else if (invoice.company.address) {
      lines.push(invoice.company.address);
    }

    // Address line 2
    if (invoice.company.addressLine2) {
      lines.push(invoice.company.addressLine2);
    }

    // City, Zip/PostalCode, Country
    const cityLine = [
      invoice.company.city,
      invoice.company.zip || invoice.company.postalCode,
      invoice.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);

    // Email
    if (invoice.company.email || invoice.company.billingEmail) {
      const email = invoice.company.billingEmail || invoice.company.email;
      if (email) lines.push(email);
    }

    // Phone
    if (invoice.company.phone) lines.push(invoice.company.phone);

    // VAT Number
    if (invoice.company.vatNumber) {
      lines.push(`VAT: ${invoice.company.vatNumber}`);
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

export function InvoicePublicView({ invoice, token }: InvoicePublicViewProps) {
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
    setLogoUrl(invoice.logoUrl || getStoredLogo() || DEFAULT_LOGO_URL);
  }, [invoice.logoUrl]);

  // Get customer name from company object
  const customerName = invoice.companyName || invoice.company?.name || "Customer";

  // Transform API data to Invoice type
  // Prefer stored customerDetails from API; fallback to built from company fields
  let customerDoc: any = null;
  if (invoice.customerDetails) {
    customerDoc = invoice.customerDetails as any;
    if (typeof customerDoc === "string") {
      try {
        customerDoc = JSON.parse(customerDoc);
      } catch {
        customerDoc = null;
      }
    }
    if (!customerDoc || typeof customerDoc !== "object" || customerDoc.type !== "doc") {
      customerDoc = null;
    }
  }

  const invoiceData: Invoice = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    amount: invoice.total,
    currency: invoice.currency || "EUR",
    lineItems:
      invoice.items?.map((item) => ({
        name: item.productName || item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount ?? 0,
        vat: item.vat ?? item.vatRate ?? invoice.vatRate ?? 20,
      })) || [],
    paymentDetails:
      paymentDetails ||
      (invoice.terms
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: invoice.terms }],
              },
            ],
          }
        : null),
    customerDetails: customerDoc || buildCustomerDetails(invoice),
    fromDetails: buildFromDetails(invoice.fromDetails, fromDetails),
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
    note: invoice.notes ?? null,
    internalNote: null,
    vat: invoice.vat || null,
    tax: invoice.tax || null,
    discount: invoice.discount || null,
    subtotal: invoice.subtotal,
    status: ["draft", "sent", "paid", "partial", "overdue", "cancelled"].includes(invoice.status)
      ? (invoice.status as Invoice["status"])
      : "draft",
    template: {
      ...DEFAULT_INVOICE_TEMPLATE,
      logoUrl: logoUrl,
      taxRate: invoice.taxRate || 0,
      vatRate: invoice.vatRate || 20,
      currency: invoice.currency || "EUR",
      includeVat: true,
      includeTax: Boolean(invoice.tax),
      includeDiscount: true,
      includeDecimals: true,
    },
    token: token,
    filePath: null,
    paidAt: invoice.paidAt ?? null,
    sentAt: invoice.sentAt ?? null,
    viewedAt: invoice.viewedAt ?? null,
    reminderSentAt: null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: invoice.companyId,
    customerName: customerName,
    customer: {
      id: invoice.companyId,
      name: customerName,
      website: invoice.company?.website || null,
      email: invoice.company?.email || null,
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
      const resp = await fetch("/api/download/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id, logo: logoUrl }),
      });
      if (!resp.ok) {
        throw new Error("Failed to generate PDF");
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setIsDownloading(false);
    }
  };

  const width = invoiceData.template?.size === "letter" ? 780 : 625;
  const height = invoiceData.template?.size === "letter" ? 1056 : 842;

  return (
    <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4 sm:p-6 md:p-0">
      {!isAuthenticated && (
        <div className="w-full max-w-[780px] mb-4 p-2 bg-muted/50 border border-border rounded-md text-center text-sm text-muted-foreground">
          Viewing in Read-Only Mode
        </div>
      )}

      <div className="flex flex-col w-full max-w-full py-6" style={{ maxWidth: width }}>
        {/* Customer Header - Identical to Midday */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {customerName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{customerName}</span>
          </div>

          <InvoiceStatus status={invoiceData.status} />
        </div>

        {/* Invoice Template */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={invoiceData} width={width} height={height} disableScroll />
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
                      window.location.href = `/dashboard/sales/invoices?type=edit&invoiceId=${invoice.id}`;
                    }}
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
