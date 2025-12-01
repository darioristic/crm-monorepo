"use client";

import { useState, useEffect } from "react";
import { Download, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HtmlTemplate } from "@/components/invoice/templates/html";
import type { Invoice, EditorDoc } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

type InvoicePublicViewProps = {
  invoice: any;
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

// Get stored logo from localStorage
function getStoredLogo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_logo_url");
    return stored || null;
  } catch {
    return null;
  }
}

// Build customer details from company data
function buildCustomerDetails(invoice: any): EditorDoc | null {
  const lines: string[] = [];
  
  if (invoice.companyName) {
    lines.push(invoice.companyName);
  }
  
  // Try to get company details from invoice.company if available
  if (invoice.company) {
    if (invoice.company.address) lines.push(invoice.company.address);
    const cityLine = [invoice.company.city, invoice.company.postalCode, invoice.company.country]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);
    if (invoice.company.email) lines.push(invoice.company.email);
    if (invoice.company.phone) lines.push(invoice.company.phone);
    if (invoice.company.vatNumber) lines.push(`VAT: ${invoice.company.vatNumber}`);
  }
  
  if (lines.length === 0) return null;
  
  return {
    type: "doc",
    content: lines.map(line => ({
      type: "paragraph",
      content: [{ type: "text", text: line }]
    }))
  };
}

export function InvoicePublicView({ invoice, token }: InvoicePublicViewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDetails, setFromDetails] = useState<EditorDoc | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<EditorDoc | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Load stored details on mount
  useEffect(() => {
    setFromDetails(getStoredFromDetails());
    setPaymentDetails(getStoredPaymentDetails());
    setLogoUrl(getStoredLogo());
  }, []);

  // Transform API data to Invoice type
  const invoiceData: Invoice = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    amount: invoice.total,
    currency: invoice.currency || "EUR",
    lineItems: invoice.items?.map((item: any) => ({
      name: item.productName || item.description || "",
      quantity: item.quantity || 1,
      price: item.unitPrice || 0,
      unit: item.unit || "pcs",
    })) || [],
    paymentDetails: paymentDetails || (invoice.terms ? { 
      type: "doc", 
      content: [{ type: "paragraph", content: [{ type: "text", text: invoice.terms }] }] 
    } : null),
    customerDetails: buildCustomerDetails(invoice),
    fromDetails: fromDetails,
    noteDetails: invoice.notes ? { 
      type: "doc", 
      content: [{ type: "paragraph", content: [{ type: "text", text: invoice.notes }] }] 
    } : null,
    note: invoice.notes,
    internalNote: null,
    vat: invoice.vat || null,
    tax: invoice.tax || null,
    discount: invoice.discount || null,
    subtotal: invoice.subtotal,
    status: invoice.status,
    template: {
      ...DEFAULT_INVOICE_TEMPLATE,
      logoUrl: logoUrl,
      taxRate: invoice.taxRate || 0,
      vatRate: invoice.vatRate || 20,
      currency: invoice.currency || "EUR",
      includeVat: Boolean(invoice.vat),
      includeTax: Boolean(invoice.tax),
      includeDiscount: Boolean(invoice.discount),
    },
    token: token,
    filePath: null,
    paidAt: invoice.paidAt,
    sentAt: invoice.sentAt,
    viewedAt: invoice.viewedAt,
    reminderSentAt: null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: invoice.companyId,
    customerName: invoice.companyName,
    customer: invoice.companyName ? {
      id: invoice.companyId,
      name: invoice.companyName,
      website: null,
      email: null,
    } : null,
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
      window.open(`/api/download/invoice?id=${invoice.id}`, "_blank");
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setIsDownloading(false);
    }
  };

  const width = invoiceData.template?.size === "letter" ? 750 : 595;
  const height = invoiceData.template?.size === "letter" ? 1056 : 842;

  return (
    <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4 sm:p-6 md:p-0">
      <div
        className="flex flex-col w-full max-w-full py-6"
        style={{ maxWidth: width }}
      >
        {/* Customer Header - Identical to Midday */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {invoiceData.customerName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{invoiceData.customerName || "Customer"}</span>
          </div>

          <InvoiceStatus status={invoiceData.status} />
        </div>

        {/* Invoice Template */}
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={invoiceData} width={width} height={height} />
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
                  {isCopied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
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
