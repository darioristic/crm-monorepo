"use client";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { productCategoriesApi, productsApi } from "@/lib/api";
import { ProductForm } from "./product-form";

export function ProductSheet() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | "view" | null;
  const productId = searchParams.get("productId");
  const isOpen = type === "create" || type === "edit" || type === "view";

  const { data: categories, isLoading: isLoadingCategories } = useApi(
    () => productCategoriesApi.getAll(),
    { autoFetch: isOpen }
  );

  const { data: product, isLoading: isLoadingProduct } = useApi(
    () => productsApi.getById(productId!),
    { autoFetch: !!productId && (type === "edit" || type === "view") }
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        router.push(pathname);
      }
    },
    [router, pathname]
  );

  const [size] = useState(700);
  const formatCurrency = (value: number, currency: string = "EUR") =>
    new Intl.NumberFormat("sr-RS", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {isOpen && (
        <SheetContent
          side="right"
          style={{ maxWidth: size }}
          noPadding
          className="!w-full !max-w-[700px] bg-background p-0 overflow-y-auto !border-0"
          hideCloseButton
        >
          <VisuallyHidden>
            <SheetTitle>
              {type === "edit"
                ? "Edit Product"
                : type === "view"
                  ? "Product Details"
                  : "New Product"}
            </SheetTitle>
          </VisuallyHidden>
          {!categories ||
          isLoadingCategories ||
          ((type === "edit" || type === "view") && isLoadingProduct) ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : type === "view" && product ? (
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
                <div className="flex items-center gap-2">
                  {product.sku && (
                    <span className="text-muted-foreground text-sm">SKU: {product.sku}</span>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {product.category?.name || "Uncategorized"}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                )}
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 sm:col-span-6 rounded-lg border p-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Pricing</h3>
                  <div>
                    <div className="text-xs text-muted-foreground">Unit Price</div>
                    <div className="font-medium">
                      {formatCurrency(Number(product.unitPrice) || 0, product.currency || "EUR")}
                    </div>
                  </div>
                  {product.costPrice !== undefined && product.costPrice !== null && (
                    <div>
                      <div className="text-xs text-muted-foreground">Cost Price</div>
                      <div className="font-medium">
                        {formatCurrency(Number(product.costPrice) || 0, product.currency || "EUR")}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <div className="text-xs text-muted-foreground">Currency</div>
                      <div className="font-medium">{product.currency || "EUR"}</div>
                    </div>
                    <div className="col-span-6">
                      <div className="text-xs text-muted-foreground">Tax Rate</div>
                      <div className="font-medium">{Number(product.taxRate) || 0}%</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-6 rounded-lg border p-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-medium">{product.isService ? "Service" : "Product"}</div>
                    </div>
                    <div className="col-span-6">
                      <div className="text-xs text-muted-foreground">Status</div>
                      <div className="font-medium">
                        <Badge variant={product.isActive ? "success" : "secondary"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <div className="col-span-12">
                      <div className="text-xs text-muted-foreground">Unit</div>
                      <div className="font-medium">{product.unit || "pcs"}</div>
                    </div>
                  </div>
                </div>

                {!product.isService && (
                  <div className="col-span-12 rounded-lg border p-4 space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Inventory</h3>
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-6">
                        <div className="text-xs text-muted-foreground">Stock Quantity</div>
                        <div className="font-medium">
                          {Number(product.stockQuantity) || 0} {product.unit}
                        </div>
                      </div>
                      <div className="col-span-6">
                        <div className="text-xs text-muted-foreground">Min Stock Level</div>
                        <div className="font-medium">{Number(product.minStockLevel) || 0}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <ProductForm
                mode={type === "edit" ? "edit" : "create"}
                product={product}
                categories={categories}
              />
            </div>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}
