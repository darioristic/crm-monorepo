"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronDown, FileCheck, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { companiesApi, invoicesApi, ordersApi, quotesApi } from "@/lib/api";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
type OrderStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

type BulkActionsProps = {
  ids: string[];
  type: "invoice" | "quote" | "order" | "contact";
  onSuccess?: () => void;
};

export function BulkActions({ ids, type, onSuccess }: BulkActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: [`${type}s`] });
    onSuccess?.();
    toast({
      title: message,
      variant: "default",
    });
  };

  const handleError = () => {
    toast({
      title: "Something went wrong. Please try again.",
      variant: "destructive",
    });
  };

  // Invoice mutations
  const updateInvoicesMutation = useMutation({
    mutationFn: async (data: { ids: string[]; status?: InvoiceStatus }) => {
      const results = await Promise.all(
        data.ids.map((id) => invoicesApi.update(id, { status: data.status }))
      );
      return results;
    },
    onSuccess: (_, data) => handleSuccess(`Updated ${data.ids.length} invoices`),
    onError: handleError,
  });

  const deleteInvoicesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => invoicesApi.delete(id)));
      return results;
    },
    onSuccess: () => handleSuccess(`Deleted ${ids.length} invoices`),
    onError: handleError,
  });

  // Quote mutations
  const updateQuotesMutation = useMutation({
    mutationFn: async (data: { ids: string[]; status?: QuoteStatus }) => {
      const results = await Promise.all(
        data.ids.map((id) => quotesApi.update(id, { status: data.status }))
      );
      return results;
    },
    onSuccess: (_, data) => handleSuccess(`Updated ${data.ids.length} quotes`),
    onError: handleError,
  });

  // Order mutations
  const updateOrdersMutation = useMutation({
    mutationFn: async (data: { ids: string[]; status?: OrderStatus }) => {
      const results = await Promise.all(
        data.ids.map((id) => ordersApi.update(id, { status: data.status }))
      );
      return results;
    },
    onSuccess: (_, data) => handleSuccess(`Updated ${data.ids.length} orders`),
    onError: handleError,
  });

  // Contact mutations
  const deleteContactsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => companiesApi.delete(id)));
      return results;
    },
    onSuccess: () => handleSuccess(`Deleted ${ids.length} contacts`),
    onError: handleError,
  });

  if (ids.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
      <span className="text-sm text-muted-foreground">{ids.length} selected</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <span>Actions</span>
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[180px]" sideOffset={8}>
          {type === "invoice" && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FileCheck className="mr-2 size-4" />
                    <span>Status</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={14}>
                      {(
                        [
                          { label: "Draft", value: "draft" },
                          { label: "Sent", value: "sent" },
                          { label: "Paid", value: "paid" },
                          { label: "Overdue", value: "overdue" },
                          { label: "Cancelled", value: "cancelled" },
                        ] as const
                      ).map((item) => (
                        <DropdownMenuCheckboxItem
                          key={item.value}
                          onCheckedChange={() => {
                            updateInvoicesMutation.mutate({
                              ids,
                              status: item.value,
                            });
                          }}
                        >
                          {item.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Send className="mr-2 size-4" />
                    <span>Send</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={14}>
                      <DropdownMenuCheckboxItem
                        onCheckedChange={() => {
                          updateInvoicesMutation.mutate({
                            ids,
                            status: "sent",
                          });
                        }}
                      >
                        Mark as Sent
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Trash2 className="mr-2 size-4 text-destructive" />
                    <span className="text-destructive">Delete</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={14}>
                      <DropdownMenuCheckboxItem
                        onCheckedChange={() => {
                          deleteInvoicesMutation.mutate(ids);
                        }}
                      >
                        Confirm Delete
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </>
          )}

          {type === "quote" && (
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileCheck className="mr-2 size-4" />
                  <span>Status</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={14}>
                    {(
                      [
                        { label: "Draft", value: "draft" },
                        { label: "Sent", value: "sent" },
                        { label: "Accepted", value: "accepted" },
                        { label: "Rejected", value: "rejected" },
                        { label: "Expired", value: "expired" },
                      ] as const
                    ).map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        onCheckedChange={() => {
                          updateQuotesMutation.mutate({
                            ids,
                            status: item.value,
                          });
                        }}
                      >
                        {item.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          )}

          {type === "order" && (
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileCheck className="mr-2 size-4" />
                  <span>Status</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={14}>
                    {(
                      [
                        { label: "Pending", value: "pending" },
                        { label: "Processing", value: "processing" },
                        { label: "Completed", value: "completed" },
                        { label: "Cancelled", value: "cancelled" },
                        { label: "Refunded", value: "refunded" },
                      ] as const
                    ).map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.value}
                        onCheckedChange={() => {
                          updateOrdersMutation.mutate({
                            ids,
                            status: item.value,
                          });
                        }}
                      >
                        {item.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          )}

          {type === "contact" && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Archive className="mr-2 size-4" />
                    <span>Archive</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={14}>
                      <DropdownMenuCheckboxItem onCheckedChange={() => {}}>
                        Archive Selected
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Trash2 className="mr-2 size-4 text-destructive" />
                    <span className="text-destructive">Delete</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent sideOffset={14}>
                      <DropdownMenuCheckboxItem
                        onCheckedChange={() => {
                          deleteContactsMutation.mutate(ids);
                        }}
                      >
                        Confirm Delete
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={onSuccess} className="text-muted-foreground">
        Clear
      </Button>
    </div>
  );
}
