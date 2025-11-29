"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Form,
  FormControl,
  FormDescription,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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

interface QuoteFormProps {
  quote?: Quote;
  mode: "create" | "edit";
}

export function QuoteForm({ quote, mode }: QuoteFormProps) {
  const router = useRouter();

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
  const defaultValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      companyId: quote?.companyId || "",
      issueDate: quote?.issueDate?.split("T")[0] || today,
      validUntil: quote?.validUntil?.split("T")[0] || defaultValidUntil,
      status: quote?.status || "draft",
      taxRate: quote?.taxRate || 0,
      notes: quote?.notes || "",
      terms: quote?.terms || "",
      items: quote?.items?.map((item) => ({
        productName: item.productName,
        description: item.description || "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })) || [{ productName: "", description: "", quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (quote) {
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
    }
  }, [quote, form, today, defaultValidUntil]);

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
      return {
        ...item,
        total: lineTotal - discountAmount,
      };
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
      createdBy: "current-user-id", // This would come from auth context
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateQuoteRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateQuoteRequest);
    }

    if (result.success) {
      toast.success(mode === "create" ? "Quote created successfully" : "Quote updated successfully");
      router.push("/dashboard/sales/quotes");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to save quote");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Quote" : "Edit Quote"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new sales quote for a customer"
              : `Editing quote ${quote?.quoteNumber}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Line Items</h3>
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
                  <Card key={field.id} className="p-4">
                    <div className="grid gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product/Service *</FormLabel>
                              <FormControl>
                                <Input placeholder="Product name" {...field} />
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
                              <FormLabel>Qty *</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
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
                              <FormLabel>Unit Price *</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="0.01" {...field} />
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
                              <FormLabel>Discount %</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="100" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-end">
                        <div className="text-sm font-medium mb-2">
                          {formatCurrency(
                            (watchedItems[index]?.quantity || 0) *
                            (watchedItems[index]?.unitPrice || 0) *
                            (1 - (watchedItems[index]?.discount || 0) / 100)
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex items-end">
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

                    <div className="mt-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Description (optional)" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}

                {form.formState.errors.items?.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
                )}
              </div>

              {/* Totals */}
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2 text-right">
                  <div className="flex justify-end gap-8">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium w-32">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  <div className="flex justify-end gap-8">
                    <span className="text-muted-foreground">Tax ({watchedTaxRate}%):</span>
                    <span className="font-medium w-32">{formatCurrency(calculations.tax)}</span>
                  </div>
                  <div className="flex justify-end gap-8 text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold w-32">{formatCurrency(calculations.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Notes & Terms */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Internal notes (not visible to customer)</FormDescription>
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
                        <Textarea
                          placeholder="Terms and conditions..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Visible on the quote document</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create Quote" : "Update Quote"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

