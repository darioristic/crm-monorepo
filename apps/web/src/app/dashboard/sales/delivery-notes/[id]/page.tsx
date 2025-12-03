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
import { PAGE_SIZES } from "@/constants/page-sizes";
import { DeliveryStatusBadge } from "@/components/sales/status/DeliveryStatusBadge";
import { buildCustomerDetails } from "@/utils/customer-details";
import { getStoredFromDetails } from "@/hooks/use-stored-from-details";
import { useCopyLink } from "@/hooks/use-copy-link";

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { copyLink, copied } = useCopyLink();

  const {
    data: deliveryNote,
    isLoading,
    error,
  } = useApi<DeliveryNote>(() => deliveryNotesApi.getById(id), {
    autoFetch: true,
  });

  const handleCopyLink = () => {
    const url = window.location.href;
    copyLink(url);
  };

  const handleDownload = async () => {
    try {
      toast.info("Preparing PDF download...");
      window.open(`/api/download/delivery-note?id=${id}`, "_blank");
    } catch (error) {
      console.error("Failed to download delivery note:", error);
      toast.error("Failed to download delivery note");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/sales/delivery-notes/${id}/edit`);
  };

  if (isLoading) {
    const { width, height } = PAGE_SIZES.A4;
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-4rem)] dotted-bg p-4">
        <div
          className="flex flex-col w-full max-w-full py-6"
          style={{ maxWidth: width }}
        >
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton style={{ height }} className="w-full" />
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
  const { width, height } = PAGE_SIZES.A4;

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

          <DeliveryStatusBadge
            status={deliveryNote.status}
            showTooltip={false}
          />
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
