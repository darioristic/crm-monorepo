"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DeliveryNoteForm } from "@/components/sales/delivery-note-form";
import { Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deliveryNotesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { DeliveryNote } from "@crm/types";

export function DeliveryNoteSheet() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | "success" | null;
  const deliveryNoteId = searchParams.get("deliveryNoteId");

  const isOpen = type === "create" || type === "edit" || type === "success";

  // Fetch delivery note data when editing or showing success
  const { data: deliveryNoteData, isLoading: isLoadingDeliveryNote } =
    useApi<DeliveryNote>(() => deliveryNotesApi.getById(deliveryNoteId!), {
      autoFetch: !!deliveryNoteId && (type === "edit" || type === "success"),
    });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Remove query params when closing
        router.push(pathname);
      }
    },
    [router, pathname]
  );

  const handleSuccess = useCallback(
    (id: string) => {
      // Show success state
      const params = new URLSearchParams(searchParams);
      params.set("type", "success");
      params.set("deliveryNoteId", id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {isOpen && (
        <DeliveryNoteSheetContent
          type={type!}
          deliveryNoteId={deliveryNoteId}
          deliveryNoteData={deliveryNoteData}
          onSuccess={handleSuccess}
          onClose={() => handleOpenChange(false)}
          isLoading={
            isLoadingDeliveryNote && (type === "edit" || type === "success")
          }
        />
      )}
    </Sheet>
  );
}

type DeliveryNoteSheetContentProps = {
  type: "create" | "edit" | "success";
  deliveryNoteId?: string | null;
  deliveryNoteData?: DeliveryNote;
  onSuccess: (id: string) => void;
  onClose: () => void;
  isLoading?: boolean;
};

function DeliveryNoteSheetContent({
  type,
  deliveryNoteId,
  deliveryNoteData,
  onSuccess,
  onClose,
  isLoading,
}: DeliveryNoteSheetContentProps) {
  const [size] = useState(700);

  if (isLoading) {
    return (
      <SheetContent
        side="right"
        style={{ maxWidth: size }}
        noPadding
        className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0"
        hideCloseButton
      >
        <VisuallyHidden>
          <SheetTitle>Loading Delivery Note...</SheetTitle>
        </VisuallyHidden>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SheetContent>
    );
  }

  if (type === "success") {
    return (
      <SheetContent
        side="right"
        noPadding
        className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0"
      >
        <VisuallyHidden>
          <SheetTitle>Delivery Note Created</SheetTitle>
        </VisuallyHidden>
        <SuccessContent
          deliveryNoteId={deliveryNoteId!}
          deliveryNote={deliveryNoteData}
          onViewDeliveryNote={() => {
            window.open(
              `/d/id/${deliveryNoteId}`,
              "_blank",
              "noopener,noreferrer"
            );
          }}
          onCreateAnother={() => window.location.reload()}
        />
      </SheetContent>
    );
  }

  return (
    <SheetContent
      side="right"
      style={{ maxWidth: size }}
      noPadding
      className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0 transition-[max-width] duration-300 ease-in-out"
      hideCloseButton
    >
      <VisuallyHidden>
        <SheetTitle>
          {type === "edit" ? "Edit Delivery Note" : "New Delivery Note"}
        </SheetTitle>
      </VisuallyHidden>
      <div className="h-full overflow-y-auto">
        <DeliveryNoteForm
          deliveryNote={deliveryNoteData}
          mode={type}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      </div>
    </SheetContent>
  );
}

type SuccessContentProps = {
  deliveryNoteId: string;
  deliveryNote?: DeliveryNote;
  onViewDeliveryNote: () => void;
  onCreateAnother: () => void;
};

function SuccessContent({
  deliveryNoteId,
  deliveryNote,
  onViewDeliveryNote,
  onCreateAnother,
}: SuccessContentProps) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/sales/delivery-notes/${deliveryNoteId}`
      : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleDownload = () => {
    window.open(`/api/download/delivery-note?id=${deliveryNoteId}`, "_blank");
  };

  // Get company data
  const company = deliveryNote?.company;
  const companyName = company?.name || deliveryNote?.companyName;

  // Build address line (zip + city) or use full address
  const addressLine =
    [company?.zip, company?.city].filter(Boolean).join(" ") || company?.address;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-8 pb-0">
        <h1 className="text-2xl font-semibold mb-1">Created</h1>
        <p className="text-muted-foreground">
          Your delivery note was created successfully
        </p>
      </div>

      {/* Delivery Note Preview Card */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="bg-[#FAFAFA] dark:bg-muted/30 rounded-lg p-6 relative">
          {/* Delivery Note Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-xs text-muted-foreground">
                Delivery Note No:
              </span>
              <span className="text-sm font-medium ml-1">
                {deliveryNote?.deliveryNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                Delivery Date:
              </span>
              <span className="text-sm font-medium ml-1">
                {deliveryNote?.deliveryDate
                  ? formatDate(deliveryNote.deliveryDate)
                  : "—"}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <p className="text-xs font-medium text-foreground mb-2">To</p>
            <div className="space-y-0.5">
              {companyName && (
                <p className="text-sm text-muted-foreground">{companyName}</p>
              )}
              {addressLine && (
                <p className="text-sm text-muted-foreground">{addressLine}</p>
              )}
              {company?.country && (
                <p className="text-sm text-muted-foreground">
                  {company.country}
                </p>
              )}
              {company?.vatNumber && (
                <p className="text-sm text-muted-foreground">
                  PIB: {company.vatNumber}
                </p>
              )}
              {company?.phone && (
                <p className="text-sm text-muted-foreground">
                  Tel: {company.phone}
                </p>
              )}
              {(company?.email || company?.billingEmail) && (
                <p className="text-sm text-muted-foreground">
                  E-mail:{" "}
                  <a
                    href={`mailto:${company.email || company.billingEmail}`}
                    className="underline"
                  >
                    {company.email || company.billingEmail}
                  </a>
                </p>
              )}
              {!companyName && !company && (
                <p className="text-sm text-muted-foreground">Customer</p>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {deliveryNote?.shippingAddress && (
            <div className="mb-6">
              <p className="text-xs font-medium text-foreground mb-2">
                Shipping Address
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {deliveryNote.shippingAddress}
              </p>
            </div>
          )}

          {/* Total */}
          {deliveryNote && deliveryNote.total > 0 && (
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold">
                {formatCurrency(deliveryNote.total || 0, "EUR")}
              </span>
            </div>
          )}

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-border my-6" />

          {/* Details Section */}
          <div>
            <h3 className="text-base font-medium mb-4">Details</h3>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Share link</p>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="bg-background text-sm font-mono"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleDownload}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Decorative bottom wave */}
          <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
            <svg
              viewBox="0 0 400 20"
              className="w-full h-full text-background"
              preserveAspectRatio="none"
            >
              <path
                d="M0,20 Q10,0 20,20 T40,20 T60,20 T80,20 T100,20 T120,20 T140,20 T160,20 T180,20 T200,20 T220,20 T240,20 T260,20 T280,20 T300,20 T320,20 T340,20 T360,20 T380,20 T400,20 L400,20 L0,20 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-8 pt-0 flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onViewDeliveryNote}
        >
          View delivery note
        </Button>
        <Button className="flex-1" onClick={onCreateAnother}>
          Create another
        </Button>
      </div>
    </div>
  );
}
