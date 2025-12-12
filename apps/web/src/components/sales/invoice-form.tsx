"use client";

import type { Company, CreateInvoiceRequest, Invoice, UpdateInvoiceRequest } from "@crm/types";
import {
  AlertCircle,
  Building2,
  Globe,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SelectCompany } from "@/components/companies/select-company";
import { type DeliveryType, InvoiceSubmitButton } from "@/components/invoice/invoice-submit-button";
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
import { useAuth } from "@/contexts/auth-context";
import { useMutation } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { companiesApi, invoicesApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

interface CustomerDetails {
  name: string;
  address?: string;
  city?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  email?: string;
  phone?: string;
  website?: string;
  vatNumber?: string;
  companyNumber?: string;
}

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
  status: z.enum(["draft", "scheduled", "sent", "paid", "partial", "overdue", "cancelled"]),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  invoice?: Invoice;
  mode: "create" | "edit";
}

export function InvoiceForm({ invoice, mode }: InvoiceFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

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

  // Fetch company details when companyId changes
  const fetchCompanyDetails = useCallback(async (companyId: string) => {
    if (!companyId) {
      setSelectedCompany(null);
      return;
    }

    setIsLoadingCompany(true);
    try {
      const response = await companiesApi.getById(companyId);
      if (response.success && response.data) {
        setSelectedCompany(response.data);
      } else {
        setSelectedCompany(null);
        logger.error("Failed to fetch company details:", response.error);
      }
    } catch (error) {
      logger.error("Error fetching company details:", error);
      setSelectedCompany(null);
    } finally {
      setIsLoadingCompany(false);
    }
  }, []);

  const form = useZodForm(invoiceFormSchema, {
    defaultValues: {
      companyId: invoice?.companyId || "",
      issueDate: invoice?.issueDate?.split("T")[0] || today,
      dueDate: invoice?.dueDate?.split("T")[0] || defaultDueDate,
      status: invoice?.status || "draft",
      taxRate: invoice?.taxRate || 0,
      notes: invoice?.notes || "",
      terms: invoice?.terms || "",
      items: invoice?.items?.map((item) => ({
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
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (invoice) {
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
      // Fetch company details for existing invoice
      if (invoice.companyId) {
        fetchCompanyDetails(invoice.companyId);
      }
    }
  }, [invoice, form, today, defaultDueDate, fetchCompanyDetails]);

  // Watch companyId changes and fetch company details
  const watchedCompanyId = form.watch("companyId");
  useEffect(() => {
    if (watchedCompanyId && watchedCompanyId !== selectedCompany?.id) {
      fetchCompanyDetails(watchedCompanyId);
    }
  }, [watchedCompanyId, fetchCompanyDetails, selectedCompany?.id]);

  const watchedItems = form.watch("items");
  const watchedTaxRate = form.watch("taxRate");

  const calculations = useMemo(() => {
    const subtotal = watchedItems.reduce(
      (sum: number, item: InvoiceFormValues["items"][number]) => {
        const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
        const discountAmount = lineTotal * ((item.discount || 0) / 100);
        return sum + (lineTotal - discountAmount);
      },
      0
    );
    const tax = subtotal * ((watchedTaxRate || 0) / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [watchedItems, watchedTaxRate]);

  const handleSubmit = async (deliveryType: DeliveryType, scheduledAt?: string) => {
    // Trigger form validation
    const isValid = await form.trigger();
    if (!isValid) return;

    const values = form.getValues();

    const items = values.items.map((item: InvoiceFormValues["items"][number]) => ({
      productName: item.productName,
      description: item.description || undefined,
      quantity: item.quantity,
      unit: "pcs",
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
    }));

    // Build customerDetails from selected company
    const customerDetails: CustomerDetails | undefined = selectedCompany
      ? {
          name: selectedCompany.name,
          address: selectedCompany.address || undefined,
          city: selectedCompany.city || undefined,
          zip: selectedCompany.zip || undefined,
          country: selectedCompany.country || undefined,
          countryCode: selectedCompany.countryCode || undefined,
          email: selectedCompany.email || undefined,
          phone: selectedCompany.phone || undefined,
          website: selectedCompany.website || undefined,
          vatNumber: selectedCompany.vatNumber || undefined,
          companyNumber: selectedCompany.companyNumber || undefined,
        }
      : undefined;

    // Determine status based on delivery type
    let status: "draft" | "sent" | "scheduled" = "draft";
    if (deliveryType === "create_and_send") {
      status = "sent";
    } else if (deliveryType === "scheduled") {
      status = "scheduled";
    }

    const createData = {
      companyId: values.companyId,
      sellerCompanyId: user?.companyId,
      issueDate: new Date(values.issueDate).toISOString(),
      dueDate: new Date(values.dueDate).toISOString(),
      status,
      taxRate: values.taxRate,
      notes: values.notes || undefined,
      terms: values.terms || undefined,
      items,
      customerDetails,
      deliveryType,
      scheduledAt,
    } as CreateInvoiceRequest;

    const updateData = {
      companyId: values.companyId,
      sellerCompanyId: user?.companyId,
      issueDate: new Date(values.issueDate).toISOString(),
      dueDate: new Date(values.dueDate).toISOString(),
      status,
      taxRate: values.taxRate,
      notes: values.notes || undefined,
      terms: values.terms || undefined,
      items,
      customerDetails,
    } as UpdateInvoiceRequest;

    try {
      const result =
        mode === "create"
          ? await createMutation.mutate(createData)
          : await updateMutation.mutate(updateData);

      if (result.success && result.data) {
        // If scheduling and creation successful, schedule the invoice
        if (mode === "create" && deliveryType === "scheduled" && scheduledAt) {
          const scheduleResult = await invoicesApi.schedule(result.data.id, scheduledAt);
          if (!scheduleResult.success) {
            toast.error("Invoice created but scheduling failed");
            router.push("/dashboard/sales/invoices");
            router.refresh();
            return;
          }
        }

        // Handle scheduling for existing invoices
        if (mode === "edit" && invoice?.id && deliveryType === "scheduled" && scheduledAt) {
          // Schedule or update schedule
          if (invoice.status === "scheduled") {
            await invoicesApi.updateSchedule(invoice.id, scheduledAt);
          } else {
            await invoicesApi.schedule(invoice.id, scheduledAt);
          }
        }

        const message =
          deliveryType === "scheduled"
            ? "Invoice scheduled successfully"
            : deliveryType === "create_and_send"
              ? "Invoice sent successfully"
              : mode === "create"
                ? "Invoice created successfully"
                : "Invoice updated successfully";
        toast.success(message);
        router.push("/dashboard/sales/invoices");
        router.refresh();
      } else {
        toast.error(getErrorMessage(result.error, "Failed to save invoice"));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save invoice"));
    }
  };

  const handleCancelSchedule = async () => {
    if (invoice?.id && invoice.status === "scheduled") {
      try {
        const result = await invoicesApi.cancelSchedule(invoice.id);
        if (result.success) {
          toast.success("Schedule cancelled");
          router.refresh();
        } else {
          toast.error("Failed to cancel schedule");
        }
      } catch (_error) {
        toast.error("Failed to cancel schedule");
      }
    }
  };

  // Keep the old onSubmit for form submission (required by Form component)
  const onSubmit = async (_values: InvoiceFormValues) => {
    // This is called when the form is submitted via Enter key
    // Default to "create" delivery type
    await handleSubmit("create");
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Invoice" : "Edit Invoice"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new invoice for a customer"
              : `Editing invoice ${invoice?.invoiceNumber}`}
          </CardDescription>
          {invoice && mode === "edit" && (
            <div className="mt-2 text-sm text-muted-foreground">
              Paid: {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.total)}
              {invoice.paidAmount < invoice.total && (
                <span className="ml-2 text-destructive">
                  (Balance: {formatCurrency(invoice.total - invoice.paidAmount)})
                </span>
              )}
            </div>
          )}
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
                      <FormLabel>Bill To (Company) *</FormLabel>
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
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
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

              {/* Bill To Details - Company Information */}
              {isLoadingCompany && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading company details...</span>
                  </div>
                </Card>
              )}

              {selectedCompany && !isLoadingCompany && (
                <Card className="p-4 bg-muted/30 border-primary/20">
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-lg">{selectedCompany.name}</h4>

                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        {/* Address Info */}
                        {(selectedCompany.address ||
                          selectedCompany.city ||
                          selectedCompany.zip ||
                          selectedCompany.country) && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              {selectedCompany.address && <p>{selectedCompany.address}</p>}
                              {(selectedCompany.zip || selectedCompany.city) && (
                                <p>
                                  {selectedCompany.zip && `${selectedCompany.zip} `}
                                  {selectedCompany.city}
                                </p>
                              )}
                              {selectedCompany.country && <p>{selectedCompany.country}</p>}
                            </div>
                          </div>
                        )}

                        {/* Contact Info */}
                        <div className="space-y-1">
                          {selectedCompany.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{selectedCompany.email}</span>
                            </div>
                          )}
                          {selectedCompany.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{selectedCompany.phone}</span>
                            </div>
                          )}
                          {selectedCompany.website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{selectedCompany.website}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Business Identifiers */}
                      {(selectedCompany.vatNumber || selectedCompany.companyNumber) && (
                        <div className="flex flex-wrap gap-4 pt-2 border-t text-sm">
                          {selectedCompany.vatNumber && (
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">VAT/OIB:</span>
                              <span className="font-medium">{selectedCompany.vatNumber}</span>
                            </div>
                          )}
                          {selectedCompany.companyNumber && (
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Company No:</span>
                              <span className="font-medium">{selectedCompany.companyNumber}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Line Items</h3>
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

                {form.formState.errors.items?.root &&
                  typeof (form.formState.errors.items.root as any)?.message === "string" && (
                    <p className="text-sm text-destructive">
                      {(form.formState.errors.items.root as any).message as string}
                    </p>
                  )}
              </div>

              {/* Totals */}
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2 text-right">
                  <div className="flex justify-end gap-8">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium w-32">
                      {formatCurrency(calculations.subtotal)}
                    </span>
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
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Payment terms and conditions..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Visible on the invoice document</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <InvoiceSubmitButton
                  mode={mode}
                  isLoading={isLoading}
                  isScheduled={invoice?.status === "scheduled"}
                  currentScheduledAt={invoice?.scheduledAt}
                  onSubmit={handleSubmit}
                  onCancelSchedule={handleCancelSchedule}
                />
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
