"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DeliveryNote } from "@crm/types";
import { deliveryNotesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { HtmlTemplate } from "@/components/delivery-note/templates/html";
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

function buildCustomerDetails(
  deliveryNote:
    | DeliveryNote
    | {
        company?: {
          name?: string;
          address?: string;
          city?: string;
          zip?: string;
          postalCode?: string;
          country?: string;
          email?: string;
          phone?: string;
          vatNumber?: string;
        };
        companyName?: string;
        customerDetails?: unknown;
      }
): {
  type: string;
  content: Array<{
    type: string;
    content: Array<{ type: string; text: string }>;
  }>;
} | null {
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

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const {
    data: deliveryNote,
    isLoading,
    error,
  } = useApi<DeliveryNote>(() => deliveryNotesApi.getById(id), {
    autoFetch: true,
  });

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
      window.open(`/api/download/delivery-note?id=${id}`, "_blank");
    } catch {
      toast.error("Failed to download delivery note");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/sales/delivery-notes/${id}/edit`);
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

  if (error || !deliveryNote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
        <h2 className="text-xl font-semibold mb-2">Delivery note not found</h2>
        <p className="text-muted-foreground mb-4">
          The delivery note you're looking for doesn't exist or has been
          deleted.
        </p>
        <Button asChild>
          <Link href="/dashboard/sales/delivery-notes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Delivery Notes
          </Link>
        </Button>
      </div>
    );
  }

  const customerName =
    deliveryNote.companyName || deliveryNote.company?.name || "Unknown";
  const customerDetails = buildCustomerDetails(deliveryNote);
  const fromDetails = getStoredFromDetails();
  const width = 595;
  const height = 842;

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
              <Link href="/dashboard/sales/delivery-notes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Avatar className="size-5 object-contain border border-border">
              <AvatarFallback className="text-[9px] font-medium">
                {customerName[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{customerName}</span>
          </div>

          <DeliveryNoteStatus status={deliveryNote.status} />
        </div>

        {/* Delivery Note Template with shadow */}
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
            />
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
                <p>Edit delivery note</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>
    </div>
  );
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
