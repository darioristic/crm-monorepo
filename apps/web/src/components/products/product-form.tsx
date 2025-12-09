"use client";

import type {
  CreateProductRequest,
  Product,
  ProductCategory,
  UpdateProductRequest,
} from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/use-api";
import { productsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

const units = [
  { value: "pcs", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "g", label: "Grams" },
  { value: "l", label: "Liters" },
  { value: "ml", label: "Milliliters" },
  { value: "m", label: "Meters" },
  { value: "cm", label: "Centimeters" },
  { value: "box", label: "Boxes" },
  { value: "pack", label: "Packs" },
  { value: "hr", label: "Hours" },
  { value: "day", label: "Days" },
];

const currencies = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "RSD", label: "Serbian Dinar (RSD)" },
  { value: "GBP", label: "British Pound (£)" },
];

const productFormSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0, "Price must be a positive number"),
  costPrice: z.coerce.number().min(0).optional(),
  currency: z.string().default("EUR"),
  unit: z.string().default("pcs"),
  taxRate: z.coerce.number().min(0).max(100).default(20),
  categoryId: z.string().optional(),
  stockQuantity: z.coerce.number().min(0).optional(),
  minStockLevel: z.coerce.number().min(0).optional(),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: Product;
  categories: ProductCategory[];
  mode: "create" | "edit";
}

export function ProductForm({ product, categories, mode }: ProductFormProps) {
  const router = useRouter();

  const createMutation = useMutation<Product, CreateProductRequest>((data) =>
    productsApi.create(data)
  );

  const updateMutation = useMutation<Product, UpdateProductRequest>((data) =>
    productsApi.update(product?.id || "", data)
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as any,
    defaultValues: {
      name: product?.name || "",
      sku: product?.sku || "",
      description: product?.description || "",
      unitPrice: Number(product?.unitPrice) || 0,
      costPrice: Number(product?.costPrice) || undefined,
      currency: product?.currency || "EUR",
      unit: product?.unit || "pcs",
      taxRate: Number(product?.taxRate) || 20,
      categoryId: product?.categoryId || undefined,
      stockQuantity: Number(product?.stockQuantity) || undefined,
      minStockLevel: Number(product?.minStockLevel) || undefined,
      isActive: product?.isActive ?? true,
      isService: product?.isService ?? false,
    },
  });

  const isService = form.watch("isService");

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        sku: product.sku || "",
        description: product.description || "",
        unitPrice: Number(product.unitPrice) || 0,
        costPrice: Number(product.costPrice) || undefined,
        currency: product.currency || "EUR",
        unit: product.unit || "pcs",
        taxRate: Number(product.taxRate) || 20,
        categoryId: product.categoryId || undefined,
        stockQuantity: Number(product.stockQuantity) || undefined,
        minStockLevel: Number(product.minStockLevel) || undefined,
        isActive: product.isActive ?? true,
        isService: product.isService ?? false,
      });
    }
  }, [product, form]);

  const onSubmit = async (values: ProductFormValues) => {
    const payload = {
      ...values,
      unitPrice: values.unitPrice,
      costPrice: values.costPrice,
      taxRate: values.taxRate,
      stockQuantity: values.isService ? undefined : values.stockQuantity,
      minStockLevel: values.isService ? undefined : values.minStockLevel,
      categoryId: values.categoryId || undefined,
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(payload as CreateProductRequest);
    } else {
      result = await updateMutation.mutate(payload as UpdateProductRequest);
    }

    if (result.success) {
      toast.success(
        mode === "create" ? "Product created successfully" : "Product updated successfully"
      );
      router.push("/dashboard/products");
      router.refresh();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to save product"));
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create Product" : "Edit Product"}</CardTitle>
        <CardDescription>
          {mode === "create"
            ? "Add a new product or service to your catalog"
            : "Update product information"}
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
            <div className="grid grid-cols-12 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-12">
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="PRD-001" {...field} />
                    </FormControl>
                    <FormDescription>Unique product identifier</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="col-span-12">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Product description..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pricing */}
            <div className="grid grid-cols-12 gap-6">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>Unit Price *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>Cost Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>Your purchase cost</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem className="col-span-12">
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax and Unit */}
            <div className="grid grid-cols-12 gap-6">
              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6">
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stock (only for products, not services) */}
            {!isService && (
              <div className="grid grid-cols-12 gap-6">
                <FormField
                  control={form.control}
                  name="stockQuantity"
                  render={({ field }) => (
                    <FormItem className="col-span-12 sm:col-span-6">
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minStockLevel"
                  render={({ field }) => (
                    <FormItem className="col-span-12 sm:col-span-6">
                      <FormLabel>Min Stock Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="10"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>Alert when below this</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Toggles */}
            <div className="grid grid-cols-12 gap-6 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="isService"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Service</FormLabel>
                      <FormDescription>This is a service (no stock tracking)</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="col-span-12 sm:col-span-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>Product is available for sale</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Product" : "Update Product"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
