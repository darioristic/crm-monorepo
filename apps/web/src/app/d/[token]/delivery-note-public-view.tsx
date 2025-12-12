"use client";

import type { DeliveryNote, DeliveryNoteWithRelations } from "@crm/types";
import { motion } from "framer-motion";
import { Check, Download, Link2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HtmlTemplate } from "@/components/delivery-note/templates/html";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import type { EditorDoc as InvoiceEditorDoc } from "@/types/invoice";
import type { EditorDoc as QuoteEditorDoc } from "@/types/quote";

type EditorDoc = QuoteEditorDoc;

type PublicDeliveryNote = Partial<DeliveryNoteWithRelations> & {
  id?: string;
  companyName?: string;
  terms?: string | null;
  notes?: string | null;
  status?: string;
  fromDetails?: unknown;
  logoUrl?: string | null;
};

type DeliveryNotePublicViewProps = {
  deliveryNote: PublicDeliveryNote;
  token: string;
};

function DeliveryNoteStatus({ status }: { status?: string }) {
  const getStatusColor = () => {
    switch (status) {
      case "delivered":
        return "bg-[#C6F6D5] text-[#22543D]";
      case "in_transit":
        return "bg-[#FEEBC8] text-[#744210]";
      case "pending":
        return "bg-[#E2E8F0] text-[#4A5568]";
      case "returned":
        return "bg-[#FED7D7] text-[#822727]";
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

import { getStoredFromDetails } from "@/hooks/use-stored-from-details";

import { buildCustomerDetails } from "@/utils/customer-details";

// Parse fromDetails from API response (may be string or object)
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

// Build fromDetails with fallback chain: API -> localStorage -> default
function buildFromDetails(
  apiFromDetails: unknown,
  storedFromDetails: InvoiceEditorDoc | null
): EditorDoc | null {
  // First try API response
  const fromApi = parseFromDetails(apiFromDetails);
  if (fromApi) return fromApi;

  // Then try localStorage
  if (storedFromDetails) return storedFromDetails as unknown as EditorDoc;

  // Return default placeholder
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Your Company Name" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Your Address" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "City, Country" }],
      },
    ],
  };
}

export function DeliveryNotePublicView({
  deliveryNote,
  token: _token,
}: DeliveryNotePublicViewProps) {
  const { isAuthenticated } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const customerName = deliveryNote.companyName || deliveryNote.company?.name || "Customer";

  const maybeCompany = deliveryNote.company && {
    name: deliveryNote.company.name || undefined,
    address: deliveryNote.company.address || undefined,
    city: deliveryNote.company.city || undefined,
    zip: deliveryNote.company.zip || undefined,
    country: deliveryNote.company.country || undefined,
    email: deliveryNote.company.email || undefined,
    phone: deliveryNote.company.phone || undefined,
    vatNumber: deliveryNote.company.vatNumber || undefined,
    companyNumber: deliveryNote.company.companyNumber || undefined,
  };
  const customerDetails = buildCustomerDetails({
    company: maybeCompany || undefined,
    companyName: deliveryNote.companyName,
    customerDetails: deliveryNote.customerDetails,
  });
  const storedFromDetails = getStoredFromDetails();
  const fromDetails = buildFromDetails(deliveryNote.fromDetails, storedFromDetails);

  const width = 625;
  const height = 842;

  const dnForTemplate: DeliveryNote = {
    id: deliveryNote.id || "",
    createdAt: deliveryNote.createdAt || "",
    updatedAt: deliveryNote.updatedAt || "",
    deliveryNumber: deliveryNote.deliveryNumber || "",
    invoiceId: deliveryNote.invoiceId,
    companyId: deliveryNote.companyId || "",
    contactId: deliveryNote.contactId,
    status: (["pending", "in_transit", "delivered", "returned"] as const).includes(
      // biome-ignore lint/suspicious/noExplicitAny: status type mismatch from API
      (deliveryNote.status || "pending") as any
    )
      ? // biome-ignore lint/suspicious/noExplicitAny: status type mismatch from API
        ((deliveryNote.status || "pending") as any)
      : "pending",
    shipDate: deliveryNote.shipDate,
    deliveryDate: deliveryNote.deliveryDate,
    items: (deliveryNote.items || []).map((item) => ({
      id: item.id || "",
      deliveryNoteId: deliveryNote.id || "",
      productName: item.productName || item.description || "",
      description: item.description || undefined,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "pcs",
      unitPrice: Number(item.unitPrice) || 0,
      discount: Number(item.discount) || 0,
      total: typeof item.total === "number" ? item.total : undefined,
    })),
    shippingAddress: deliveryNote.shippingAddress || "",
    trackingNumber: deliveryNote.trackingNumber,
    carrier: deliveryNote.carrier,
    taxRate: Number(deliveryNote.taxRate) || 0,
    subtotal: Number(deliveryNote.subtotal) || 0,
    tax: Number(deliveryNote.tax) || 0,
    total: Number(deliveryNote.total) || 0,
    notes: deliveryNote.notes || undefined,
    terms: deliveryNote.terms || undefined,
    fromDetails: deliveryNote.fromDetails,
    customerDetails: deliveryNote.customerDetails,
    createdBy: deliveryNote.createdBy || "",
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
      window.open(`/api/download/delivery-note?id=${deliveryNote.id}`, "_blank");
    } catch {
      toast.error("Failed to download delivery note");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4 sm:p-6 md:p-0">
      <div className="flex flex-col w-full max-w-full py-6" style={{ maxWidth: width }}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {customerName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{customerName}</span>
          </div>

          <DeliveryNoteStatus status={deliveryNote.status} />
        </div>

        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate
              data={{
                deliveryNote: dnForTemplate,
                customerDetails,
                fromDetails,
                paymentDetails: deliveryNote.terms
                  ? {
                      type: "doc",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: deliveryNote.terms }],
                        },
                      ],
                    }
                  : null,
                noteDetails: deliveryNote.notes
                  ? {
                      type: "doc",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: deliveryNote.notes }],
                        },
                      ],
                    }
                  : null,
              }}
              width={width}
              height={height}
              disableScroll
            />
          </div>
        </div>
      </div>

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
                      window.location.href = `/dashboard/sales/delivery-notes/${deliveryNote.id}`;
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  sideOffset={15}
                  className="text-[10px] px-2 py-1 rounded-sm font-medium"
                >
                  <p>Edit delivery note</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </motion.div>

      <div className="fixed bottom-4 right-4 hidden md:block">
        <span className="text-[9px] text-[#878787]">
          Powered by <span className="text-primary">CRM</span>
        </span>
      </div>
    </div>
  );
}
