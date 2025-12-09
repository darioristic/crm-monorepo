"use client";

import type { Company, CreateQuoteRequest, Quote, UpdateQuoteRequest } from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Reorder, useDragControls } from "framer-motion";
import { AlertCircle, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApi, useMutation } from "@/hooks/use-api";
import { companiesApi, quotesApi } from "@/lib/api";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

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

interface QuoteSheetProps {
  quote?: Quote | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function LineItem({
  index,
  onRemove,
  control,
  register,
  watchedItem,
  canRemove,
}: {
  index: number;
  onRemove: () => void;
  control: any;
  register: any;
  watchedItem: any;
  canRemove: boolean;
}) {
  const dragControls = useDragControls();
  const lineTotal =
    (watchedItem?.quantity || 0) *
    (watchedItem?.unitPrice || 0) *
    (1 - (watchedItem?.discount || 0) / 100);

  return (
    <Reorder.Item
      value={index}
      dragListener={false}
      dragControls={dragControls}
      className="bg-card rounded-lg border border-border p-4 group"
    >
      <div className="flex items-start gap-3">
        <div
          className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity mt-2"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={control}
              name={`items.${index}.productName`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Product/Service name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
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

          <div className="grid grid-cols-4 gap-3">
            <FormField
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Qty</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`items.${index}.unitPrice`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Price</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`items.${index}.discount`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Disc %</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="100" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total</div>
              <div className="h-9 flex items-center font-medium">{formatCurrency(lineTotal)}</div>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

export function QuoteSheet({ quote, mode, open, onOpenChange, onSuccess }: QuoteSheetProps) {
  const {
    data: companies,
    isLoading: companiesLoading,
    refetch: refetchCompanies,
  } = useApi<Company[]>(() => companiesApi.getAll(), { autoFetch: true });

  const createMutation = useMutation<Quote, CreateQuoteRequest>((data) => quotesApi.create(data));

  const updateMutation = useMutation<Quote, UpdateQuoteRequest>((data) =>
    quotesApi.update(quote?.id || "", data)
  );

  const today = new Date().toISOString().split("T")[0];
  const defaultValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema) as Resolver<QuoteFormValues>,
    shouldUnregister: true,
    defaultValues: {
      companyId: "",
      issueDate: today,
      validUntil: defaultValidUntil,
      status: "draft",
      taxRate: 20,
      notes: "",
      terms: "",
      items: [],
    },
  });

  const { fields, append, remove, move, replace } = useFieldArray({
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
        items:
          quote.items?.map((item) => ({
            productName: item.productName,
            description: item.description || "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })) || [],
      });
      const mapped =
        quote.items?.map((item) => ({
          productName: item.productName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })) || [];
      replace(mapped);
    } else if (mode === "create" && open) {
      form.reset({
        companyId: "",
        issueDate: today,
        validUntil: defaultValidUntil,
        status: "draft",
        taxRate: 20,
        notes: "",
        terms: "",
        items: [],
      });
      replace([]);
    }
  }, [quote, mode, form, today, defaultValidUntil, open]);

  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

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

  const handleReorder = (newOrder: number[]) => {
    const oldIndex = fields.findIndex((_, i) => !newOrder.includes(i));
    const newIndex = newOrder.findIndex((val, i) => val !== i);
    if (oldIndex !== -1 && newIndex !== -1) {
      move(oldIndex, newIndex);
    }
  };

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
      toast.success(
        mode === "create" ? "Quote created successfully" : "Quote updated successfully"
      );
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save quote"));
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border bg-muted/50">
          <SheetTitle>
            {mode === "create" ? "New Quote" : `Edit Quote ${quote?.quoteNumber}`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto p-6">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form id="quote-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Company & Status */}
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
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowCreateCustomer(true)}
                          className="text-xs p-0 h-auto hover:bg-transparent"
                        >
                          + Create new customer
                        </Button>
                      </div>
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

              {/* Dates & Tax */}
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
                    onClick={() =>
                      append({
                        productName: "",
                        description: "",
                        quantity: 1,
                        unitPrice: 0,
                        discount: 0,
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <Reorder.Group
                  axis="y"
                  values={fields.map((_, i) => i)}
                  onReorder={handleReorder}
                  className="space-y-2"
                >
                  {fields.map((field, index) => (
                    <LineItem
                      key={field.id}
                      index={index}
                      onRemove={() => remove(index)}
                      control={form.control}
                      register={form.register}
                      watchedItem={watchedItems[index]}
                      canRemove={fields.length > 1}
                    />
                  ))}
                </Reorder.Group>
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({watchedTaxRate}%)</span>
                  <span>{formatCurrency(calculations.tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t border-border pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(calculations.total)}</span>
                </div>
              </div>

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
                          rows={3}
                          className="resize-none"
                          {...field}
                        />
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
                        <Textarea
                          placeholder="Terms..."
                          rows={3}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="quote-form" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Quote" : "Update Quote"}
          </Button>
        </div>
      </SheetContent>
      <Sheet open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader className="mb-6 flex justify-between items-center flex-row">
            <h2 className="text-xl">Create Customer</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCreateCustomer(false)}
              className="p-0 m-0 size-auto hover:bg-transparent"
            >
              <AlertCircle className="size-5" />
            </Button>
          </SheetHeader>
          <CreateCompanyInlineForm
            prefillName=""
            onSuccess={(newCompanyId) => {
              form.setValue("companyId", newCompanyId, {
                shouldDirty: true,
                shouldValidate: true,
              });
              refetchCompanies();
              setShowCreateCustomer(false);
            }}
            onCancel={() => setShowCreateCustomer(false)}
          />
        </SheetContent>
      </Sheet>
    </Sheet>
  );
}
