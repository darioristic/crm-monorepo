"use client";

import type { Company, CreateInvoiceRequest, Invoice, UpdateInvoiceRequest } from "@crm/types";
import { AlertCircle, CheckCircle, Copy, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SalesSummary } from "@/components/sales/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApi, useMutation } from "@/hooks/use-api";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useZodForm } from "@/hooks/use-zod-form";
import { companiesApi, invoicesApi } from "@/lib/api";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

const lineItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive"),
  discount: z.coerce.number().min(0).max(100).default(0),
});

const invoiceFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceModalProps {
  invoice?: Invoice | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InvoiceModal({ invoice, mode, open, onOpenChange, onSuccess }: InvoiceModalProps) {
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [, copy] = useCopyToClipboard();

  const { data: companies, isLoading: companiesLoading } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  const createMutation = useMutation<Invoice, CreateInvoiceRequest>((data) =>
    invoicesApi.create(data)
  );

  const updateMutation = useMutation<Invoice, UpdateInvoiceRequest>((data) =>
    invoicesApi.update(invoice?.id || "", data)
  );

  const today = new Date().toISOString().split("T")[0];
  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const form = useZodForm(invoiceFormSchema, {
    defaultValues: {
      companyId: "",
      issueDate: today,
      dueDate: defaultDueDate,
      status: "draft",
      taxRate: 0,
      notes: "",
      terms: "",
      items: [
        {
          productName: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (invoice && mode === "edit") {
      setCreatedInvoice(null);
      form.reset({
        companyId: invoice.companyId,
        issueDate: invoice.issueDate?.split("T")[0] || today,
        dueDate: invoice.dueDate?.split("T")[0] || defaultDueDate,
        status: invoice.status,
        taxRate: invoice.taxRate,
        notes: invoice.notes || "",
        terms: invoice.terms || "",
        items: invoice.items?.map((item) => ({
          productName: item.productName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })) || [
          {
            productName: "",
            description: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
          },
        ],
      });
    } else if (mode === "create") {
      setCreatedInvoice(null);
      form.reset({
        companyId: "",
        issueDate: today,
        dueDate: defaultDueDate,
        status: "draft",
        taxRate: 0,
        notes: "",
        terms: "",
        items: [
          {
            productName: "",
            description: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
          },
        ],
      });
    }
  }, [invoice, mode, form, today, defaultDueDate]);

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

  const onSubmit = async (values: InvoiceFormValues) => {
    const baseData = {
      companyId: values.companyId,
      issueDate: new Date(values.issueDate).toISOString(),
      dueDate: new Date(values.dueDate).toISOString(),
      status: values.status,
      taxRate: values.taxRate,
      subtotal: calculations.subtotal,
      tax: calculations.tax,
      total: calculations.total,
      notes: values.notes || undefined,
      terms: values.terms || undefined,
      createdBy: "current-user-id",
    };

    const result =
      mode === "create"
        ? await createMutation.mutate({
            ...baseData,
            items: values.items.map((item) => ({
              productName: item.productName,
              description: item.description || undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              unit: "pcs",
            })),
          } as CreateInvoiceRequest)
        : await updateMutation.mutate(baseData as UpdateInvoiceRequest);

    if (result.success) {
      if (mode === "create" && result.data) {
        setCreatedInvoice(result.data);
        toast.success("Invoice created successfully");
      } else {
        toast.success("Invoice updated successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save invoice"));
    }
  };

  const handleClose = () => {
    setCreatedInvoice(null);
    onOpenChange(false);
    if (createdInvoice) {
      onSuccess?.();
    }
  };

  const getInvoicePreviewUrl = (inv: Invoice) => {
    return `${window.location.origin}/i/id/${inv.id}`;
  };

  const handleCopyLink = () => {
    if (createdInvoice) {
      copy(getInvoicePreviewUrl(createdInvoice));
      toast.success("Link copied to clipboard");
    }
  };

  const handleOpenPreview = () => {
    if (createdInvoice) {
      window.open(getInvoicePreviewUrl(createdInvoice), "_blank");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {createdInvoice ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            </div>

            <h2 className="text-2xl font-semibold mb-2">Invoice Created!</h2>
            <p className="text-muted-foreground mb-6">
              Invoice {createdInvoice.invoiceNumber} has been created successfully.
            </p>

            <div className="w-full max-w-md space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Invoice Preview Link</p>
                <p className="text-sm font-mono truncate">{getInvoicePreviewUrl(createdInvoice)}</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button className="flex-1" onClick={handleOpenPreview}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Preview
                </Button>
              </div>
            </div>

            <Button variant="outline" onClick={handleClose} className="mt-8">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{mode === "create" ? "Create Invoice" : "Edit Invoice"}</DialogTitle>
              <DialogDescription>
                {mode === "create"
                  ? "Create a new invoice for a customer"
                  : `Editing invoice ${invoice?.invoiceNumber}`}
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
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
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
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Price"
                                    {...field}
                                  />
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
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    placeholder="Disc %"
                                    {...field}
                                  />
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
                  paidAmount={invoice?.paidAmount}
                  showBalance={mode === "edit"}
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
                        <FormLabel>Payment Terms</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Payment terms..." rows={3} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === "create" ? "Create Invoice" : "Update Invoice"}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
