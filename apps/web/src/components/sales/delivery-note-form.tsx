"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DeliveryNote, Company, CreateDeliveryNoteRequest, UpdateDeliveryNoteRequest } from "@crm/types";
import { deliveryNotesApi, companiesApi } from "@/lib/api";
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
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

const lineItemSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unit: z.string().min(1, "Unit is required"),
});

const deliveryNoteFormSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  shippingAddress: z.string().min(5, "Shipping address is required"),
  shipDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  status: z.enum(["pending", "in_transit", "delivered", "returned"]),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
});

type DeliveryNoteFormValues = z.infer<typeof deliveryNoteFormSchema>;

interface DeliveryNoteFormProps {
  deliveryNote?: DeliveryNote;
  mode: "create" | "edit";
}

export function DeliveryNoteForm({ deliveryNote, mode }: DeliveryNoteFormProps) {
  const router = useRouter();

  const { data: companies, isLoading: companiesLoading } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  const createMutation = useMutation<DeliveryNote, CreateDeliveryNoteRequest>((data) =>
    deliveryNotesApi.create(data)
  );

  const updateMutation = useMutation<DeliveryNote, UpdateDeliveryNoteRequest>((data) =>
    deliveryNotesApi.update(deliveryNote?.id || "", data)
  );

  const form = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteFormSchema) as any,
    defaultValues: {
      companyId: deliveryNote?.companyId || "",
      shippingAddress: deliveryNote?.shippingAddress || "",
      shipDate: deliveryNote?.shipDate?.split("T")[0] || "",
      deliveryDate: deliveryNote?.deliveryDate?.split("T")[0] || "",
      status: deliveryNote?.status || "pending",
      trackingNumber: deliveryNote?.trackingNumber || "",
      carrier: deliveryNote?.carrier || "",
      notes: deliveryNote?.notes || "",
      items: deliveryNote?.items?.map((item) => ({
        productName: item.productName,
        description: item.description || "",
        quantity: item.quantity,
        unit: item.unit,
      })) || [{ productName: "", description: "", quantity: 1, unit: "pcs" }],
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
        notes: deliveryNote.notes || "",
        items: deliveryNote.items?.map((item) => ({
          productName: item.productName,
          description: item.description || "",
          quantity: item.quantity,
          unit: item.unit,
        })) || [{ productName: "", description: "", quantity: 1, unit: "pcs" }],
      });
    }
  }, [deliveryNote, form]);

  const onSubmit = async (values: DeliveryNoteFormValues) => {
    const data = {
      companyId: values.companyId,
      shippingAddress: values.shippingAddress,
      shipDate: values.shipDate ? new Date(values.shipDate).toISOString() : undefined,
      deliveryDate: values.deliveryDate ? new Date(values.deliveryDate).toISOString() : undefined,
      status: values.status,
      trackingNumber: values.trackingNumber || undefined,
      carrier: values.carrier || undefined,
      notes: values.notes || undefined,
      items: values.items,
      createdBy: "current-user-id", // This would come from auth context
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateDeliveryNoteRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateDeliveryNoteRequest);
    }

    if (result.success) {
      toast.success(mode === "create" ? "Delivery note created successfully" : "Delivery note updated successfully");
      router.push("/dashboard/sales/delivery-notes");
      router.refresh();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save delivery note"));
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  // Common unit options
  const unitOptions = ["pcs", "kg", "g", "l", "ml", "m", "cm", "box", "pack", "set"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Delivery Note" : "Edit Delivery Note"}</CardTitle>
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

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Items to Deliver</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productName: "", description: "", quantity: 1, unit: "pcs" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="grid gap-4 sm:grid-cols-12">
                      <div className="sm:col-span-5">
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

                      <div className="sm:col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity *</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
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
                      Add any special delivery instructions or internal notes
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create Delivery Note" : "Update Delivery Note"}
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

