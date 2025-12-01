"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, ExternalLink, Copy, Printer } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { toast } from "sonner";
import type { Invoice } from "@crm/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
};

export function InvoiceDetailsSheet({ open, onOpenChange, invoice }: Props) {
  const [, copy] = useCopyToClipboard();

  if (!invoice) return null;

  const invoiceUrl = `${window.location.origin}/i/${invoice.id}`;

  const handleCopyLink = () => {
    copy(invoiceUrl);
    toast.success("Link copied to clipboard");
  };

  const handleDownload = () => {
    window.open(`/api/download/invoice?id=${invoice.id}`, "_blank");
  };

  const handlePrint = () => {
    window.open(`/api/download/invoice?id=${invoice.id}&preview=true`, "_blank");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      paid: "default",
      partial: "outline",
      overdue: "destructive",
      cancelled: "destructive",
    };
    return variants[status] || "secondary";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{invoice.invoiceNumber}</SheetTitle>
            <Badge variant={getStatusBadge(invoice.status)}>
              {invoice.status}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDate(invoice.issueDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <h4 className="font-medium mb-3">Items</h4>
              <div className="space-y-2">
                {invoice.items?.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between text-sm py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({invoice.taxRate}%)
                  </span>
                  <span>{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

