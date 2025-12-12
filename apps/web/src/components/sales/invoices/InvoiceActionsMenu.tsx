"use client";

import type { Invoice } from "@crm/types";
import { MoreHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invoicesApi } from "@/lib/api";

export type InvoiceWithCompany = Invoice & {
  companyName?: string;
};

interface InvoiceActionsMenuProps {
  invoice: InvoiceWithCompany;
  onRefresh?: () => void;
  onDelete?: (invoice: InvoiceWithCompany) => void;
  onOpenSheet?: (invoiceId: string) => void;
}

export function InvoiceActionsMenu({
  invoice,
  onRefresh,
  onDelete,
  onOpenSheet,
}: InvoiceActionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, copy] = useCopyToClipboard();
  const [isLoading, setIsLoading] = useState(false);

  const status = invoice.status?.toLowerCase() || "";

  // Get the public invoice URL
  const getInvoiceUrl = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/i/${invoice.token}`;
  };

  // Handle copy link
  const handleCopyLink = async () => {
    const url = getInvoiceUrl();
    await copy(url);
    toast.success("Copied link to clipboard");
  };

  // Handle open invoice in new tab
  const handleOpenInvoice = () => {
    window.open(getInvoiceUrl(), "_blank", "noopener,noreferrer");
  };

  // Handle edit invoice
  const handleEdit = () => {
    if (onOpenSheet) {
      onOpenSheet(invoice.id);
    } else {
      router.push(`${pathname}?type=edit&invoiceId=${invoice.id}`);
    }
  };

  // Handle download invoice PDF
  const handleDownload = async () => {
    // Open the public invoice URL which should have PDF download option
    window.open(`/i/id/${invoice.id}`, "_blank", "noopener,noreferrer");
  };

  // Handle duplicate invoice
  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      const result = await invoicesApi.duplicate(invoice.id);
      if (result.success && result.data) {
        toast.success("Invoice duplicated successfully");
        // Open the duplicated invoice for editing
        if (onOpenSheet) {
          onOpenSheet(result.data.id);
        }
        onRefresh?.();
      } else {
        toast.error("Failed to duplicate invoice");
      }
    } catch (error) {
      console.error("Failed to duplicate invoice:", error);
      toast.error("Failed to duplicate invoice");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mark as paid with date
  const handleMarkAsPaid = async (date?: Date) => {
    setIsLoading(true);
    try {
      const paidDate = date || new Date();
      const result = await invoicesApi.update(invoice.id, {
        status: "paid",
        paidAt: paidDate.toISOString(),
      });
      if (result.success) {
        toast.success("Invoice marked as paid");
        onRefresh?.();
      } else {
        toast.error("Failed to update invoice");
      }
    } catch (error) {
      console.error("Failed to mark as paid:", error);
      toast.error("Failed to update invoice");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle mark as unpaid (revert to sent status)
  const handleMarkAsUnpaid = async () => {
    setIsLoading(true);
    try {
      const result = await invoicesApi.update(invoice.id, {
        status: "sent",
        paidAt: undefined,
      });
      if (result.success) {
        toast.success("Invoice marked as unpaid");
        onRefresh?.();
      } else {
        toast.error("Failed to update invoice");
      }
    } catch (error) {
      console.error("Failed to mark as unpaid:", error);
      toast.error("Failed to update invoice");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle send reminder
  const handleSendReminder = async () => {
    setIsLoading(true);
    try {
      // Use the workflow API endpoint for sending reminders
      const response = await fetch(`/api/v1/invoices/${invoice.id}/send-reminder`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Reminder sent successfully");
        onRefresh?.();
      } else {
        toast.error(result.error?.message || "Failed to send reminder");
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error("Failed to send reminder");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel invoice
  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const result = await invoicesApi.update(invoice.id, {
        status: "cancelled",
      });
      if (result.success) {
        toast.success("Invoice cancelled");
        onRefresh?.();
      } else {
        toast.error("Failed to cancel invoice");
      }
    } catch (error) {
      console.error("Failed to cancel invoice:", error);
      toast.error("Failed to cancel invoice");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel schedule (revert to draft)
  const handleCancelSchedule = async () => {
    setIsLoading(true);
    try {
      const result = await invoicesApi.cancelSchedule(invoice.id);
      if (result.success) {
        toast.success("Schedule cancelled");
        onRefresh?.();
      } else {
        toast.error("Failed to cancel schedule");
      }
    } catch (error) {
      console.error("Failed to cancel schedule:", error);
      toast.error("Failed to cancel schedule");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (onDelete) {
      onDelete(invoice);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {/* Edit - only if not paid or canceled */}
        {status !== "paid" && status !== "cancelled" && status !== "canceled" && (
          <DropdownMenuItem onClick={handleEdit}>Edit invoice</DropdownMenuItem>
        )}

        {/* Open invoice in new tab */}
        <DropdownMenuItem onClick={handleOpenInvoice}>Open invoice</DropdownMenuItem>

        {/* Copy link */}
        <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>

        {/* Download - only if not draft */}
        {status !== "draft" && (
          <DropdownMenuItem onClick={handleDownload}>Download</DropdownMenuItem>
        )}

        {/* Duplicate */}
        <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>

        {/* Send reminder - only for overdue/sent */}
        {(status === "overdue" || status === "sent") && (
          <DropdownMenuItem onClick={handleSendReminder}>Send reminder</DropdownMenuItem>
        )}

        {/* Mark as paid - for draft/scheduled/overdue/partial/sent (not paid or cancelled) */}
        {status !== "paid" && status !== "cancelled" && status !== "canceled" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mark as paid</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <Calendar
                mode="single"
                toDate={new Date()}
                selected={new Date()}
                onSelect={(date) => handleMarkAsPaid(date || undefined)}
                initialFocus
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Mark as unpaid - only for paid */}
        {status === "paid" && (
          <DropdownMenuItem onClick={handleMarkAsUnpaid}>Mark as unpaid</DropdownMenuItem>
        )}

        {/* Cancel invoice - for sent/overdue/partial */}
        {(status === "overdue" || status === "partial" || status === "sent") && (
          <DropdownMenuItem onClick={handleCancel} className="text-[#FF3638]">
            Cancel
          </DropdownMenuItem>
        )}

        {/* Cancel schedule - only for scheduled */}
        {status === "scheduled" && (
          <DropdownMenuItem onClick={handleCancelSchedule} className="text-[#FF3638]">
            Cancel schedule
          </DropdownMenuItem>
        )}

        {/* Delete - only for cancelled or draft */}
        {(status === "cancelled" || status === "canceled" || status === "draft") && (
          <DropdownMenuItem onClick={handleDelete} className="text-[#FF3638]">
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
