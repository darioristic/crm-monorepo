"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { productsApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useProductEdit } from "./product-edit-context";

type FormData = {
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  currency: string;
};

export function ProductEditSheet() {
  const { editProductId, closeProductEdit, onProductUpdated } = useProductEdit();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = Boolean(editProductId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      unitPrice: 0,
      unit: "pcs",
      currency: "EUR",
    },
  });

  // Fetch product data when editProductId changes
  useEffect(() => {
    if (editProductId) {
      setIsLoading(true);
      productsApi
        .getById(editProductId)
        .then((response) => {
          if (response.success && response.data) {
            const product = response.data;
            reset({
              name: product.name || "",
              description: product.description || "",
              unitPrice:
                typeof product.unitPrice === "string"
                  ? parseFloat(product.unitPrice)
                  : product.unitPrice || 0,
              unit: product.unit || "pcs",
              currency: product.currency || "EUR",
            });
          }
        })
        .catch((error) => {
          logger.error("Failed to fetch product:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [editProductId, reset]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!editProductId) return;

      setIsSaving(true);
      try {
        const response = await productsApi.update(editProductId, {
          name: data.name.trim(),
          description: data.description.trim() || undefined,
          unitPrice: data.unitPrice,
          unit: data.unit.trim() || undefined,
          currency: data.currency,
        });

        if (response.success) {
          onProductUpdated?.();
          closeProductEdit();
        } else {
          logger.error("Failed to update product:", response.error);
        }
      } catch (error) {
        logger.error("Failed to update product:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [editProductId, closeProductEdit, onProductUpdated]
  );

  const handleDelete = useCallback(async () => {
    if (!editProductId) return;

    setIsDeleting(true);
    try {
      const response = await productsApi.delete(editProductId);
      if (response.success) {
        onProductUpdated?.();
        closeProductEdit();
      } else {
        logger.error("Failed to delete product:", response.error);
      }
    } catch (error) {
      logger.error("Failed to delete product:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [editProductId, closeProductEdit, onProductUpdated]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeProductEdit();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent title="Edit Product">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle>Edit Product</SheetTitle>
            {editProductId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Product</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this product? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="Product name"
                autoFocus
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              <p className="text-xs text-muted-foreground">This is the product display name.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Product description (optional)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">This is for internal use only.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Price</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("unitPrice", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">Default price.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" {...register("unit")} placeholder="e.g., hour, pcs, kg" />
                <p className="text-xs text-muted-foreground">Unit of measurement.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...register("currency")} placeholder="EUR" maxLength={3} />
            </div>

            <div className="pt-6 border-t">
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Product"
                )}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
