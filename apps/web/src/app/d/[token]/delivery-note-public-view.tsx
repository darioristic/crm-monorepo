"use client";

import { useState, useEffect } from "react";
import { Download, Link2, Check, Pencil } from "lucide-react";
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
import { HtmlTemplate } from "@/components/delivery-note/templates/html";
import type { DeliveryNote } from "@crm/types";
import { useAuth } from "@/contexts/auth-context";

type DeliveryNotePublicViewProps = {
  deliveryNote: any;
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

function getStoredFromDetails() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("invoice_from_details");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function buildCustomerDetails(deliveryNote: any): any {
  if (deliveryNote.customerDetails) {
    if (typeof deliveryNote.customerDetails === "string") {
      try {
        return JSON.parse(deliveryNote.customerDetails);
      } catch {
        return null;
      }
    }
    return deliveryNote.customerDetails;
  }

  const lines: string[] = [];
  const companyName = deliveryNote.companyName || deliveryNote.company?.name;
  if (companyName) {
    lines.push(companyName);
  }

  if (deliveryNote.company) {
    if (deliveryNote.company.address) {
      lines.push(deliveryNote.company.address);
    }
    const cityLine = [
      deliveryNote.company.city,
      deliveryNote.company.zip || deliveryNote.company.postalCode,
      deliveryNote.company.country,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) lines.push(cityLine);
    if (deliveryNote.company.email) lines.push(deliveryNote.company.email);
    if (deliveryNote.company.phone) lines.push(deliveryNote.company.phone);
    if (deliveryNote.company.vatNumber) {
      lines.push(`VAT: ${deliveryNote.company.vatNumber}`);
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

export function DeliveryNotePublicView({
  deliveryNote,
  token,
}: DeliveryNotePublicViewProps) {
  const { isAuthenticated } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const customerName =
    deliveryNote.companyName || deliveryNote.company?.name || "Customer";

  const customerDetails = buildCustomerDetails(deliveryNote);
  const fromDetails = getStoredFromDetails();

  const width = 625;
  const height = 842;

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
      window.open(
        `/api/download/delivery-note?id=${deliveryNote.id}`,
        "_blank"
      );
    } catch {
      toast.error("Failed to download delivery note");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4 sm:p-6 md:p-0">
      <div
        className="flex flex-col w-full max-w-full py-6"
        style={{ maxWidth: width }}
      >
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
                deliveryNote,
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
