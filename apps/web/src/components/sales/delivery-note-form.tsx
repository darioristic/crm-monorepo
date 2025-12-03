"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type {
  DeliveryNote,
  Company,
  CreateDeliveryNoteRequest,
  UpdateDeliveryNoteRequest,
} from "@crm/types";
import { deliveryNotesApi, companiesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
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
import { SelectCompany } from "@/components/companies/select-company";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Hash,
  ArrowLeft,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

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
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.coerce.number().min(0, "Unit price must be positive").default(0),
  discount: z.coerce.number().min(0).max(100).default(0),
});

const deliveryNoteFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  shippingAddress: z.string().min(5, "Shipping address is required"),
  shipDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  status: z.enum(["pending", "in_transit", "delivered", "returned"]),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type DeliveryNoteFormValues = z.infer<typeof deliveryNoteFormSchema>;

interface DeliveryNoteFormProps {
  deliveryNote?: DeliveryNote;
  mode: "create" | "edit";
  onSuccess?: (id: string) => void;
  onClose?: () => void;
}

export function DeliveryNoteForm({
  deliveryNote,
  mode,
  onSuccess,
  onClose,
}: DeliveryNoteFormProps) {
  const router = useRouter();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  const createMutation = useMutation<DeliveryNote, CreateDeliveryNoteRequest>(
    (data) => deliveryNotesApi.create(data)
  );

  const updateMutation = useMutation<DeliveryNote, UpdateDeliveryNoteRequest>(
    (data) => deliveryNotesApi.update(deliveryNote?.id || "", data)
  );

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
        console.error("Failed to fetch company details:", response.error);
      }
    } catch (error) {
      console.error("Error fetching company details:", error);
      setSelectedCompany(null);
    } finally {
      setIsLoadingCompany(false);
    }
  }, []);

  const form = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteFormSchema),
    defaultValues: {
      companyId: deliveryNote?.companyId || "",
      shippingAddress: deliveryNote?.shippingAddress || "",
      shipDate: deliveryNote?.shipDate?.split("T")[0] || "",
      deliveryDate: deliveryNote?.deliveryDate?.split("T")[0] || "",
      status: deliveryNote?.status || "pending",
      trackingNumber: deliveryNote?.trackingNumber || "",
      carrier: deliveryNote?.carrier || "",
      taxRate: 0,
      notes: deliveryNote?.notes || "",
      terms: "",
      items: deliveryNote?.items?.map((item) => ({
        productName: item.productName,
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: 0,
        discount: 0,
      })) || [
        {
          productName: "",
          description: "",
          quantity: 1,
          unit: "pcs",
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
    if (deliveryNote) {
      form.reset({
        companyId: deliveryNote.companyId,
        shippingAddress: deliveryNote.shippingAddress,
        shipDate: deliveryNote.shipDate?.split("T")[0] || "",
        deliveryDate: deliveryNote.deliveryDate?.split("T")[0] || "",
        status: deliveryNote.status,
        trackingNumber: deliveryNote.trackingNumber || "",
        carrier: deliveryNote.carrier || "",
        taxRate: 0,
        notes: deliveryNote.notes || "",
        terms: "",
        items: deliveryNote.items?.map((item) => ({
          productName: item.productName,
          description: item.description || "",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: 0,
          discount: 0,
        })) || [
          {
            productName: "",
            description: "",
            quantity: 1,
            unit: "pcs",
            unitPrice: 0,
            discount: 0,
          },
        ],
      });
      // Fetch company details for existing delivery note
      if (deliveryNote.companyId) {
        fetchCompanyDetails(deliveryNote.companyId);
      }
    }
  }, [deliveryNote, form, fetchCompanyDetails]);

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
    const subtotal = watchedItems.reduce((sum, item) => {
      const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
      const discountAmount = lineTotal * ((item.discount || 0) / 100);
      return sum + (lineTotal - discountAmount);
    }, 0);
    const tax = subtotal * ((watchedTaxRate || 0) / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [watchedItems, watchedTaxRate]);

  const onSubmit = async (values: DeliveryNoteFormValues) => {
    const items = values.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * (item.discount / 100);
      return {
        ...item,
        total: lineTotal - discountAmount,
      };
    });

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

    const data = {
      companyId: values.companyId,
      shippingAddress: values.shippingAddress,
      shipDate: values.shipDate
        ? new Date(values.shipDate).toISOString()
        : undefined,
      deliveryDate: values.deliveryDate
        ? new Date(values.deliveryDate).toISOString()
        : undefined,
      status: values.status,
      trackingNumber: values.trackingNumber || undefined,
      carrier: values.carrier || undefined,
      notes: values.notes || undefined,
      terms: values.terms || undefined,
      items,
      customerDetails,
      createdBy: "current-user-id", // This would come from auth context
    };

    let result: { success: boolean; data?: DeliveryNote; error?: unknown };
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateDeliveryNoteRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateDeliveryNoteRequest);
    }

    if (result.success) {
      toast.success(
        mode === "create"
          ? "Delivery note created successfully"
          : "Delivery note updated successfully"
      );
      if (onSuccess && result.data) {
        onSuccess(result.data.id);
      } else {
        router.push("/dashboard/sales/delivery-notes");
        router.refresh();
      }
    } else {
      toast.error(
        getErrorMessage(result.error, "Failed to save delivery note")
      );
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  // Common unit options
  const unitOptions = [
    "pcs",
    "kg",
    "g",
    "l",
    "ml",
    "m",
    "cm",
    "box",
    "pack",
    "set",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "Create Delivery Note" : "Edit Delivery Note"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new delivery note for shipping products"
              : `Editing delivery note ${deliveryNote?.deliveryNumber}`}
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
                      <FormLabel>Bill To (Company) *</FormLabel>
                      <FormControl>
                        <SelectCompany
                          value={field.value}
                          onSelect={field.onChange}
                          placeholder="Select or search company..."
                        />
                      </FormControl>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
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
                      <h4 className="font-semibold text-lg">
                        {selectedCompany.name}
                      </h4>

                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        {/* Address Info */}
                        {(selectedCompany.address ||
                          selectedCompany.city ||
                          selectedCompany.zip ||
                          selectedCompany.country) && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              {selectedCompany.address && (
                                <p>{selectedCompany.address}</p>
                              )}
                              {(selectedCompany.zip ||
                                selectedCompany.city) && (
                                <p>
                                  {selectedCompany.zip &&
                                    `${selectedCompany.zip} `}
                                  {selectedCompany.city}
                                </p>
                              )}
                              {selectedCompany.country && (
                                <p>{selectedCompany.country}</p>
                              )}
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
                      {(selectedCompany.vatNumber ||
                        selectedCompany.companyNumber) && (
                        <div className="flex flex-wrap gap-4 pt-2 border-t text-sm">
                          {selectedCompany.vatNumber && (
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                VAT/OIB:
                              </span>
                              <span className="font-medium">
                                {selectedCompany.vatNumber}
                              </span>
                            </div>
                          )}
                          {selectedCompany.companyNumber && (
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Company No:
                              </span>
                              <span className="font-medium">
                                {selectedCompany.companyNumber}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              <FormField
                control={form.control}
                name="shippingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Address *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the full shipping address..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="shipDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ship Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., FedEx, UPS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trackingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Tracking number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Items to Deliver</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        productName: "",
                        description: "",
                        quantity: 1,
                        unit: "pcs",
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
                          name={`items.${index}.unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {unitOptions.map((unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {unit}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <FormField
                          control={form.control}
                          name={`items.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount %</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-end gap-2">
                        <div className="text-sm font-medium mb-2">
                          {formatCurrency(
                            (watchedItems[index]?.quantity || 0) *
                              (watchedItems[index]?.unitPrice || 0) *
                              (1 - (watchedItems[index]?.discount || 0) / 100)
                          )}
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="mb-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Description (optional)"
                                {...field}
                              />
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
                    <span className="text-muted-foreground">
                      Tax ({watchedTaxRate}%):
                    </span>
                    <span className="font-medium w-32">
                      {formatCurrency(calculations.tax)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-8 text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold w-32">
                      {formatCurrency(calculations.total)}
                    </span>
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
                      <FormDescription>
                        Internal notes (not visible to customer)
                      </FormDescription>
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
                      <FormDescription>
                        Visible on the delivery note document
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {mode === "create"
                    ? "Create Delivery Note"
                    : "Update Delivery Note"}
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
