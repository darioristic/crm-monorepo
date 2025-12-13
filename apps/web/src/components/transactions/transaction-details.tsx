"use client";

import type { PaymentWithInvoice } from "@crm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { paymentsApi, type Tag, tagsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SelectTags } from "./select-tags";

// Extended payment type with enrichment fields
interface EnrichedPayment extends PaymentWithInvoice {
  vendorName?: string;
  merchantName?: string;
  categorySlug?: string;
  description?: string;
  isRecurring?: boolean;
  frequency?: string;
  internal?: boolean;
}

function formatAmount(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Note component with debounce (like Midday)
function Note({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange: (value: string | null) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [debouncedValue, setDebouncedValue] = useState(defaultValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (debouncedValue !== defaultValue) {
      onChange(debouncedValue?.length > 0 ? debouncedValue : null);
    }
  }, [debouncedValue, defaultValue, onChange]);

  return (
    <Textarea
      defaultValue={defaultValue}
      placeholder="Add a note..."
      className="min-h-[100px] resize-none"
      onChange={(evt) => setValue(evt.target.value)}
    />
  );
}

export function TransactionDetails() {
  const queryClient = useQueryClient();
  const { transactionId, setTransactionId } = useTransactionParams();

  // Fetch transaction details
  const { data, isLoading } = useQuery({
    queryKey: ["payment", transactionId],
    queryFn: async (): Promise<EnrichedPayment | null> => {
      if (!transactionId) return null;
      const res = await paymentsApi.getById(transactionId);
      return (res.data as EnrichedPayment | undefined) ?? null;
    },
    enabled: Boolean(transactionId),
    staleTime: 0,
  });

  const { data: listData } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await paymentsApi.getAll({ pageSize: 100 });
      return res;
    },
  });
  const transactions = Array.isArray(listData?.data) ? (listData?.data as EnrichedPayment[]) : [];
  const currentIndex = transactions.findIndex((t) => t.id === transactionId);
  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < transactions.length - 1;
  const handlePrev = () => {
    if (canPrev) {
      const prev = transactions[currentIndex - 1];
      if (prev?.id) setTransactionId(prev.id);
    }
  };
  const handleNext = () => {
    if (canNext) {
      const next = transactions[currentIndex + 1];
      if (next?.id) setTransactionId(next.id);
    }
  };

  // Fetch transaction tags
  const { data: transactionTags = [] } = useQuery({
    queryKey: ["payment-tags", transactionId],
    queryFn: async () => {
      if (!transactionId) return [];
      const res = await paymentsApi.getTags(transactionId);
      const tagsData = res.data as { tags?: Array<{ tag: Tag }> } | Array<{ tag: Tag }> | undefined;
      if (Array.isArray(tagsData)) return tagsData;
      return tagsData?.tags || [];
    },
    enabled: Boolean(transactionId),
  });

  // Fetch all available tags
  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await tagsApi.getAll();
      const tagsData = res.data as { tags?: Tag[] } | Tag[] | undefined;
      if (Array.isArray(tagsData)) return tagsData;
      return tagsData?.tags || [];
    },
  });

  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!transactionId) return;
      return paymentsApi.update(transactionId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment", transactionId] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!transactionId) return;
      return paymentsApi.addTag(transactionId, tagId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["payment-tags", transactionId],
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!transactionId) return;
      return paymentsApi.removeTag(transactionId, tagId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["payment-tags", transactionId],
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  // Create new tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; color?: string }) => {
      return tagsApi.create(tagData);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      if (response.data?.id) {
        addTagMutation.mutate(response.data.id);
      }
    },
  });

  if (isLoading || !data) {
    return null;
  }

  const defaultAccordionValue = ["attachment"];
  if (data?.notes) {
    defaultAccordionValue.push("note");
  }

  const assignedTagsRaw = Array.isArray(transactionTags) ? transactionTags : [];
  const assignedTags = assignedTagsRaw.map((tt) => tt.tag).filter(Boolean) as Tag[];
  const tagsArray = Array.isArray(allTags) ? allTags : [];

  return (
    <div className="h-[calc(100vh-80px)] scrollbar-hide overflow-auto pb-12">
      {/* Header Section */}
      <div className="flex justify-between mb-8">
        <div className="flex-1 flex-col">
          {/* Date Row */}
          <div className="flex items-center justify-between">
            <span className="text-[#606060] text-xs select-text">
              {data?.paymentDate && format(new Date(data.paymentDate), "MMM d, y")}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" onClick={handlePrev} disabled={!canPrev}>
                <ChevronLeft />
              </Button>
              <span className="text-xs text-muted-foreground">
                {transactions.length > 0 && currentIndex >= 0
                  ? `${currentIndex + 1} / ${transactions.length}`
                  : ""}
              </span>
              <Button variant="outline" size="icon-sm" onClick={handleNext} disabled={!canNext}>
                <ChevronRight />
              </Button>
            </div>
          </div>

          {/* Name/Description */}
          <h2 className="mt-6 mb-3 select-text">
            {data?.description ||
              data?.merchantName ||
              data?.vendorName ||
              data?.notes ||
              "Transaction"}
          </h2>

          {/* Amount */}
          <div className="flex justify-between items-center">
            <div className="flex flex-col w-full space-y-1">
              <span
                className={cn(
                  "text-4xl select-text font-serif",
                  data?.amount > 0 && "text-[#00C969]"
                )}
              >
                {formatAmount(data?.amount || 0, data?.currency || "EUR")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description Box */}
      {data?.notes && (
        <div className="border dark:bg-[#1A1A1A]/95 px-4 py-3 text-sm text-popover-foreground select-text mb-6">
          {data.notes}
        </div>
      )}

      {/* Category and Method Grid */}
      <div className="grid grid-cols-2 gap-4 mt-6 mb-2">
        <div>
          <Label htmlFor="category" className="mb-2 block">
            Category
          </Label>
          <Select
            value={data?.categorySlug || ""}
            onValueChange={(value) => {
              updateTransactionMutation.mutate({
                categorySlug: value,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="refunds-received">Refunds Received</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
                <SelectItem value="office-supplies">Office Supplies</SelectItem>
                <SelectItem value="software">Software & Subscriptions</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="meals">Meals & Entertainment</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="salaries">Salaries & Wages</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="professional-services">Professional Services</SelectItem>
                <SelectItem value="taxes">Taxes</SelectItem>
                <SelectItem value="bank-fees">Bank Fees</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="method" className="mb-2 block">
            Method
          </Label>
          <Select
            value={data?.paymentMethod || ""}
            onValueChange={(value) => {
              updateTransactionMutation.mutate({
                paymentMethod: value,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags Section */}
      <div className="mt-6">
        <Label htmlFor="tags" className="mb-2 block">
          Tags
        </Label>
        <SelectTags
          tags={assignedTags.map((tag) => ({
            id: tag.id,
            label: tag.name,
            value: tag.name,
          }))}
          availableTags={tagsArray.map((tag) => ({
            id: tag.id,
            label: tag.name,
            value: tag.name,
          }))}
          onSelect={(tag) => {
            if (tag.id) {
              addTagMutation.mutate(tag.id);
            }
          }}
          onRemove={(tag) => {
            if (tag.id) {
              removeTagMutation.mutate(tag.id);
            }
          }}
          onCreate={(name) => {
            createTagMutation.mutate({ name });
          }}
        />
      </div>

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={defaultAccordionValue} className="mt-6">
        {/* Attachments */}
        <AccordionItem value="attachment">
          <AccordionTrigger>Attachments</AccordionTrigger>
          <AccordionContent className="select-text">
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
              <Upload className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF, PNG, JPG up to 10MB
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* General Settings */}
        <AccordionItem value="general">
          <AccordionTrigger>General</AccordionTrigger>
          <AccordionContent className="select-text">
            {/* Exclude from Analytics */}
            <div className="mb-4 border-b pb-4">
              <Label className="mb-2 block font-medium text-md">Exclude from analytics</Label>
              <div className="flex flex-row items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs text-muted-foreground">
                    Exclude this transaction from analytics like profit, expense and revenue. This
                    is useful for internal transfers between accounts to avoid double-counting.
                  </p>
                </div>
                <Switch
                  checked={data?.internal ?? false}
                  onCheckedChange={(checked) => {
                    updateTransactionMutation.mutate({
                      internal: checked,
                    });
                  }}
                />
              </div>
            </div>

            {/* Mark as Recurring */}
            <div className="flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <Label className="mb-2 block font-medium text-md">Mark as recurring</Label>
                <p className="text-xs text-muted-foreground">
                  Mark as recurring. Similar future transactions will be automatically categorized
                  and flagged as recurring.
                </p>
              </div>
              <Switch
                checked={data?.isRecurring ?? false}
                onCheckedChange={(checked) => {
                  updateTransactionMutation.mutate({
                    isRecurring: checked,
                  });
                }}
              />
            </div>

            {/* Frequency Selector */}
            {data?.isRecurring && (
              <Select
                value={data?.frequency ?? undefined}
                onValueChange={(value) => {
                  updateTransactionMutation.mutate({
                    frequency: value,
                  });
                }}
              >
                <SelectTrigger className="w-full mt-4">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Note */}
        <AccordionItem value="note">
          <AccordionTrigger>Note</AccordionTrigger>
          <AccordionContent className="select-text">
            <Note
              defaultValue={data?.notes ?? ""}
              onChange={(value) => {
                updateTransactionMutation.mutate({
                  notes: value,
                });
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
