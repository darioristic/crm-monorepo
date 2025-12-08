"use client";

import type {
  Company,
  CreateOrderRequest,
  Invoice,
  Order,
  Quote,
  UpdateOrderRequest,
} from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SelectCompany } from "@/components/companies/select-company";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApi, useMutation } from "@/hooks/use-api";
import { companiesApi, invoicesApi, ordersApi, quotesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

const lineItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive"),
  discount: z.coerce.number().min(0).max(100).default(0),
  total: z.coerce.number().min(0).default(0),
});

const orderFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  contactId: z.string().optional(),
  quoteId: z.string().optional(),
  invoiceId: z.string().optional(),
  status: z.enum(["pending", "processing", "completed", "cancelled", "refunded"]),
  subtotal: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0).default(0),
  currency: z.string().min(1, "Currency is required").default("EUR"),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  order?: Order & { items?: any[] };
  mode: "create" | "edit";
}

export function OrderForm({ order, mode }: OrderFormProps) {
  const router = useRouter();
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const { data: companies, isLoading: companiesLoading } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  const { data: quotes } = useApi<Quote[]>(() => quotesApi.getAll(), {
    autoFetch: true,
  });

  const { data: invoices } = useApi<Invoice[]>(() => invoicesApi.getAll(), {
    autoFetch: true,
  });

  const createMutation = useMutation<Order, CreateOrderRequest>((data) => ordersApi.create(data));

  const updateMutation = useMutation<Order, UpdateOrderRequest>((data) =>
    ordersApi.update(order?.id || "", data)
  );

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as any,
    defaultValues: {
      companyId: order?.companyId || "",
      contactId: order?.contactId || "",
      quoteId: order?.quoteId || "",
      invoiceId: order?.invoiceId || "",
      status: order?.status || "pending",
      subtotal: order?.subtotal || 0,
      tax: order?.tax || 0,
      total: order?.total || 0,
      currency: order?.currency || "EUR",
      notes: order?.notes || "",
      items: order?.items?.map((item: any) => ({
        productName: item.productName || "",
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
        total: item.total || 0,
      })) || [
        {
          productName: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          total: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate totals when items change
  useEffect(() => {
    const subscription = form.watch((_value, { name }) => {
      if (name?.startsWith("items.")) {
        const items = form.getValues("items");
        let subtotal = 0;

        items.forEach((item) => {
          const quantity = item.quantity || 0;
          const unitPrice = item.unitPrice || 0;
          const discount = item.discount || 0;
          const lineTotal = quantity * unitPrice;
          const discountAmount = lineTotal * (discount / 100);
          const itemTotal = lineTotal - discountAmount;
          subtotal += itemTotal;
        });

        const tax = subtotal * 0.2; // 20% VAT
        const total = subtotal + tax;

        form.setValue("subtotal", subtotal);
        form.setValue("tax", tax);
        form.setValue("total", total);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (order) {
      form.reset({
        companyId: order.companyId,
        contactId: order.contactId || "",
        quoteId: order.quoteId || "",
        invoiceId: order.invoiceId || "",
        status: order.status,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
        notes: order.notes || "",
        items: order.items?.map((item: any) => ({
          productName: item.productName || "",
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          total: item.total || 0,
        })) || [
          {
            productName: "",
            description: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
            total: 0,
          },
        ],
      });
    }
  }, [order, form]);

  const onSubmit = async (values: OrderFormValues) => {
    const data = {
      companyId: values.companyId,
      contactId: values.contactId || undefined,
      quoteId: values.quoteId || undefined,
      invoiceId: values.invoiceId || undefined,
      status: values.status,
      subtotal: values.subtotal,
      tax: values.tax,
      total: values.total,
      currency: values.currency,
      notes: values.notes || undefined,
      createdBy: "current-user-id", // This would come from auth context
      items: values.items,
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as unknown as CreateOrderRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateOrderRequest);
    }

    if (result.success) {
      toast.success(
        mode === "create" ? "Order created successfully" : "Order updated successfully"
      );
      router.push("/dashboard/sales/orders");
      router.refresh();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save order"));
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Order" : "Edit Order"}</CardTitle>
          <CardDescription>
            {mode === "create" ? "Create a new order" : `Editing order ${order?.orderNumber}`}
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
                      <FormControl>
                        <SelectCompany
                          value={field.value}
                          onSelect={field.onChange}
                          placeholder="Select or search company..."
                        />
                      </FormControl>
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
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
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
                  name="quoteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Quote</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                        value={field.value || "none"}
                        disabled={!quotes || quotes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a quote (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {quotes?.map((quote) => (
                            <SelectItem key={quote.id} value={quote.id}>
                              {quote.quoteNumber}
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
                  name="invoiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Invoice</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                        value={field.value || "none"}
                        disabled={!invoices || invoices.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an invoice (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {invoices?.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.invoiceNumber}
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
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="RSD">RSD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Order Items</h3>
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
                        total: 0,
                      })
                    }
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
                              <FormLabel>Product *</FormLabel>
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
                              <FormLabel>Quantity *</FormLabel>
                              <FormControl>
                                <Input type="number" min="0.01" step="0.01" {...field} />
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
                  <p className="text-sm text-destructive">
                    {form.formState.errors.items.root.message}
                  </p>
                )}
              </div>

              {/* Summary */}
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal</FormLabel>
                      <FormControl>
                        <Input type="number" readOnly {...field} />
                      </FormControl>
                      <FormDescription>Calculated from items</FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax (VAT)</FormLabel>
                      <FormControl>
                        <Input type="number" readOnly {...field} />
                      </FormControl>
                      <FormDescription>20% of subtotal</FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total</FormLabel>
                      <FormControl>
                        <Input type="number" readOnly className="font-semibold" {...field} />
                      </FormControl>
                      <FormDescription>Subtotal + Tax</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Special instructions or notes..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Add any special instructions or internal notes
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create Order" : "Update Order"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
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
              <X className="size-5" />
            </Button>
          </SheetHeader>
          <CreateCompanyInlineForm
            prefillName={""}
            onSuccess={(newCompanyId) => {
              setShowCreateCustomer(false);
              form.setValue("companyId", newCompanyId, {
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
            onCancel={() => setShowCreateCustomer(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
