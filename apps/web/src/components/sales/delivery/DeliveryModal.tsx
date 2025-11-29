"use client";

import { useEffect } from "react";
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
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

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

const UNIT_OPTIONS = ["pcs", "kg", "g", "l", "ml", "m", "cm", "box", "pack", "set"];

interface DeliveryModalProps {
  deliveryNote?: DeliveryNote | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeliveryModal({
  deliveryNote,
  mode,
  open,
  onOpenChange,
  onSuccess,
}: DeliveryModalProps) {
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
    resolver: zodResolver(deliveryNoteFormSchema),
    defaultValues: {
      companyId: "",
      shippingAddress: "",
      shipDate: "",
      deliveryDate: "",
      status: "pending",
      trackingNumber: "",
      carrier: "",
      notes: "",
      items: [{ productName: "", description: "", quantity: 1, unit: "pcs" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (deliveryNote && mode === "edit") {
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
    } else if (mode === "create") {
      form.reset({
        companyId: "",
        shippingAddress: "",
        shipDate: "",
        deliveryDate: "",
        status: "pending",
        trackingNumber: "",
        carrier: "",
        notes: "",
        items: [{ productName: "", description: "", quantity: 1, unit: "pcs" }],
      });
    }
  }, [deliveryNote, mode, form]);

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
      createdBy: "current-user-id",
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateDeliveryNoteRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateDeliveryNoteRequest);
    }

    if (result.success) {
      toast.success(
        mode === "create" ? "Delivery note created successfully" : "Delivery note updated successfully"
      );
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(result.error || "Failed to save delivery note");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Delivery Note" : "Edit Delivery Note"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new delivery note for shipping products"
              : `Editing delivery note ${deliveryNote?.deliveryNumber}`}
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
                      rows={2}
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
                    <FormLabel>Delivery Date</FormLabel>
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
                      <Input placeholder="e.g., FedEx" {...field} />
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
                    <FormLabel>Tracking #</FormLabel>
                    <FormControl>
                      <Input placeholder="Tracking number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Items to Deliver</h4>
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
                <Card key={field.id} className="p-3">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
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
                    <div className="sm:col-span-3">
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
                    <div className="sm:col-span-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {UNIT_OPTIONS.map((unit) => (
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special instructions or notes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Delivery Note" : "Update Delivery Note"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

