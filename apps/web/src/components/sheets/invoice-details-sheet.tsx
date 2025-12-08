"use client";

import type { Invoice } from "@crm/types";
import { formatCurrency, formatDateDMY } from "@crm/utils";
import { Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { extractTextFromEditorDoc } from "@/types/invoice";

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
            <Badge variant={getStatusBadge(invoice.status)}>{invoice.status}</Badge>
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

          {/* Bill To */}
          <div className="space-y-2">
            <h4 className="font-medium">Bill to</h4>
            <div className="text-sm space-y-0.5 text-muted-foreground">
              {(() => {
                const cd = invoice.customerDetails as any;
                let doc: any = null;
                if (cd && typeof cd === "string") {
                  try {
                    const parsed = JSON.parse(cd);
                    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
                      doc = parsed;
                    }
                  } catch {}
                } else if (cd && typeof cd === "object" && cd.type === "doc") {
                  doc = cd;
                }

                if (doc) {
                  const lines = extractTextFromEditorDoc(doc)
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  return lines.length ? lines.map((line, idx) => <p key={idx}>{line}</p>) : null;
                }

                if (cd && typeof cd === "object") {
                  const lines: string[] = [];
                  if (cd.name) lines.push(String(cd.name));
                  if (cd.address) lines.push(String(cd.address));
                  const cityZipCountry = [cd.zip, cd.city, cd.country].filter(Boolean).join(" ");
                  if (cityZipCountry) lines.push(cityZipCountry);
                  if (cd.email) lines.push(String(cd.email));
                  if (cd.phone) lines.push(String(cd.phone));
                  if (cd.vatNumber) lines.push(`PIB: ${String(cd.vatNumber)}`);
                  return lines.length ? lines.map((line, idx) => <p key={idx}>{line}</p>) : null;
                }

                const companyName = invoice.company?.name;
                const addressLine =
                  [invoice.company?.zip, invoice.company?.city].filter(Boolean).join(" ") ||
                  invoice.company?.address ||
                  invoice.company?.addressLine1;
                return (
                  <>
                    {companyName && <p>{companyName}</p>}
                    {addressLine && <p>{addressLine}</p>}
                    {invoice.company?.country && <p>{invoice.company.country}</p>}
                    {invoice.company?.vatNumber && <p>{`PIB: ${invoice.company.vatNumber}`}</p>}
                    {(invoice.company?.email || invoice.company?.billingEmail) && (
                      <p>E-mail: {invoice.company.email || invoice.company.billingEmail}</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDateDMY(invoice.issueDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{formatDateDMY(invoice.dueDate)}</p>
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
                        {item.quantity} ×{" "}
                        {formatCurrency(item.unitPrice, invoice.currency || "EUR", "sr-RS")}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.total, invoice.currency || "EUR", "sr-RS")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, invoice.currency || "EUR", "sr-RS")}</span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                  <span>{formatCurrency(invoice.tax, invoice.currency || "EUR", "sr-RS")}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency || "EUR", "sr-RS")}</span>
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
