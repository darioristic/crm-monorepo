"use client";

import * as React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CreditCard,
  ExternalLink,
  Copy,
  Download,
} from "lucide-react";
import type { Invoice } from "@crm/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export type InvoiceWithCompany = Invoice & {
  companyName?: string;
};

interface InvoiceCardProps {
  invoice: InvoiceWithCompany;
  onEdit?: (invoice: InvoiceWithCompany) => void;
  onDelete?: (invoice: InvoiceWithCompany) => void;
  onRecordPayment?: (invoice: InvoiceWithCompany) => void;
}

// Gradient backgrounds for invoice cards
const gradients = [
  "bg-gradient-to-br from-violet-400 via-purple-400 to-fuchsia-400",
  "bg-gradient-to-br from-amber-300 via-orange-400 to-pink-400",
  "bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-400",
  "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400",
  "bg-gradient-to-br from-rose-400 via-pink-400 to-purple-400",
  "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-400",
];

function getGradient(invoiceNumber: string): string {
  const hash = invoiceNumber
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function handleCopyLink(invoiceId: string) {
  const url = `${window.location.origin}/i/${invoiceId}`;
  navigator.clipboard.writeText(url);
  toast.success("Link copied to clipboard");
}

export function InvoiceCard({
  invoice,
  onEdit,
  onDelete,
  onRecordPayment,
}: InvoiceCardProps) {
  const canEdit = invoice.status !== "paid" && invoice.status !== "cancelled";
  const gradient = getGradient(invoice.invoiceNumber);

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20 py-0">
      <CardContent className="p-4">
        {/* Header with gradient icon and menu */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={`h-12 w-12 rounded-xl ${gradient} shadow-sm`} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={() => onEdit(invoice)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit invoice
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild>
                <a
                  href={`/i/${invoice.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open invoice
                </a>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => handleCopyLink(invoice.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </DropdownMenuItem>

              {invoice.status !== "draft" && (
                <DropdownMenuItem asChild>
                  <a
                    href={`/api/download/invoice?id=${invoice.id}`}
                    target="_blank"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </DropdownMenuItem>
              )}

              {invoice.status !== "paid" &&
                invoice.status !== "cancelled" &&
                onRecordPayment && (
                  <DropdownMenuItem onClick={() => onRecordPayment(invoice)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record payment
                  </DropdownMenuItem>
                )}

              {(invoice.status === "draft" || invoice.status === "cancelled") &&
                onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(invoice)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Amount and Invoice Number */}
        <div className="flex items-center justify-between mb-2">
          <Link
            href={`/dashboard/sales/invoices/${invoice.id}`}
            className="text-lg font-semibold hover:text-primary transition-colors"
          >
            {formatCurrency(invoice.total)}
          </Link>
          <span className="text-sm font-mono text-muted-foreground">
            #{invoice.invoiceNumber}
          </span>
        </div>

        {/* Description */}
        {invoice.notes && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {invoice.notes}
          </p>
        )}
        {!invoice.notes && invoice.companyName && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            Invoice for {invoice.companyName}
          </p>
        )}

        {/* Due Date */}
        <div className="text-sm">
          <span className="text-muted-foreground">Due date: </span>
          <span
            className={`font-medium ${
              new Date(invoice.dueDate) < new Date() &&
              invoice.status !== "paid"
                ? "text-destructive"
                : ""
            }`}
          >
            {formatDate(invoice.dueDate)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
