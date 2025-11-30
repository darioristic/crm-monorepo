"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Quote, Company, CreateQuoteRequest, UpdateQuoteRequest } from "@crm/types";
import { quotesApi, companiesApi } from "@/lib/api";
import { useMutation, useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SalesSummary } from "@/components/sales/shared";

const lineItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive"),
  discount: z.coerce.number().min(0).max(100).default(0),
});

const quoteFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface QuoteModalProps {
  quote?: Quote | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuoteModal({
  quote,
  mode,
  open,
  onOpenChange,
  onSuccess,
}: QuoteModalProps) {
  const { data: companies, isLoading: companiesLoading } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  const createMutation = useMutation<Quote, CreateQuoteRequest>((data) =>
    quotesApi.create(data)
  );

  const updateMutation = useMutation<Quote, UpdateQuoteRequest>((data) =>
    quotesApi.update(quote?.id || "", data)
  );

  const today = new Date().toISOString().split("T")[0];
  const defaultValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema) as any,
    defaultValues: {
      companyId: "",
      issueDate: today,
      validUntil: defaultValidUntil,
      status: "draft",
      taxRate: 0,
      notes: "",
      terms: "",
      items: [{ productName: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (quote && mode === "edit") {
      form.reset({
        companyId: quote.companyId,
        issueDate: quote.issueDate?.split("T")[0] || today,
        validUntil: quote.validUntil?.split("T")[0] || defaultValidUntil,
        status: quote.status,
        taxRate: quote.taxRate,
        notes: quote.notes || "",
        terms: quote.terms || "",
        items: quote.items?.map((item) => ({
          productName: item.productName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })) || [{ productName: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }],
      });
    } else if (mode === "create") {
      form.reset({
        companyId: "",
        issueDate: today,
        validUntil: defaultValidUntil,
        status: "draft",
        taxRate: 0,
        notes: "",
        terms: "",
        items: [{ productName: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }],
      });
    }
  }, [quote, mode, form, today, defaultValidUntil]);

  const watchedItems = form.watch("items");
  const watchedTaxRate = form.watch("taxRate");

  const calculations = useMemo(() => {
    const subtotal = watchedItems.reduce((sum, item) => {
      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
      const discountAmount = lineTotal * ((item.discount || 0) / 100);
      return sum + (lineTotal - discountAmount);
    }, 0);
    const tax = subtotal * ((watchedTaxRate || 0) / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [watchedItems, watchedTaxRate]);

  const onSubmit = async (values: QuoteFormValues) => {
    const items = values.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * (item.discount / 100);
      return { ...item, total: lineTotal - discountAmount };
    });

    const data = {
      companyId: values.companyId,
      issueDate: new Date(values.issueDate).toISOString(),
      validUntil: new Date(values.validUntil).toISOString(),
      status: values.status,
      taxRate: values.taxRate,
      subtotal: calculations.subtotal,
      tax: calculations.tax,
      total: calculations.total,
      notes: values.notes || undefined,
      terms: values.terms || undefined,
      items,
      createdBy: "current-user-id",
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateQuoteRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateQuoteRequest);
    }

    if (result.success) {
      toast.success(mode === "create" ? "Quote created successfully" : "Quote updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save quote"));
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Quote" : "Edit Quote"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new sales quote for a customer"
              : `Editing quote ${quote?.quoteNumber}`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={companiesLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Line Items</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ productName: "", description: "", quantity: 1, unitPrice: 0, discount: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-3">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Product name *" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" min="1" placeholder="Qty" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" placeholder="Price" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.discount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" min="0" max="100" placeholder="Disc %" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-center text-sm font-medium">
                      {formatCurrency(
                        (watchedItems[index]?.quantity || 0) *
                        (watchedItems[index]?.unitPrice || 0) *
                        (1 - (watchedItems[index]?.discount || 0) / 100)
                      )}
                    </div>
                    <div className="sm:col-span-1 flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <SalesSummary
              subtotal={calculations.subtotal}
              taxRate={watchedTaxRate || 0}
              tax={calculations.tax}
              total={calculations.total}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Internal notes..." rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms & Conditions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Terms..." rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Quote" : "Update Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

