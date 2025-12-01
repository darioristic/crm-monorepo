"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { FormValues } from "./form-context";
import { formatInvoiceAmount } from "@/utils/invoice-calculate";

type Product = {
  id: string;
  name: string;
  price?: number;
  unit?: string;
  currency?: string;
  description?: string;
};

type Props = {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onProductSelect?: (product: Product) => void;
  disabled?: boolean;
};

export function ProductAutocomplete({
  index,
  value,
  onChange,
  onProductSelect,
  disabled = false,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setValue, watch, control } = useFormContext<FormValues>();

  const currentProductId = watch(`lineItems.${index}.productId`);
  const currentPrice = watch(`lineItems.${index}.price`);
  const currentUnit = watch(`lineItems.${index}.unit`);
  const currency = useWatch({ control, name: "template.currency" });
  const locale = useWatch({ control, name: "template.locale" });
  const includeDecimals = useWatch({
    control,
    name: "template.includeDecimals",
  });
  const maximumFractionDigits = includeDecimals ? 2 : 0;

  // Fetch products from API - use popular products sorted by usage
  const {
    data: productsData,
    isLoading,
    refetch,
  } = useApi(
    () =>
      productsApi.getPopular({ limit: 50, currency: currency || undefined }),
    { autoFetch: true }
  );

  // Transform API products to local format
  const products: Product[] = (productsData || []).map((p) => ({
    id: p.id,
    name: p.name,
    price:
      typeof p.unitPrice === "string" ? parseFloat(p.unitPrice) : p.unitPrice,
    unit: p.unit ?? undefined,
    currency: p.currency || currency || "EUR",
    description: p.description ?? undefined,
  }));

  // Filter products based on input
  const filteredProducts =
    value.trim().length >= 2
      ? products.filter((product) =>
          product.name.toLowerCase().includes(value.toLowerCase())
        )
      : products.slice(0, 5);

  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setSelectedIndex(-1);

      // If the input is cleared and we have a productId, remove it
      if (newValue.trim() === "" && currentProductId) {
        setValue(`lineItems.${index}.productId`, undefined, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      if (isFocused) {
        setShowSuggestions(true);
      }
    },
    [onChange, isFocused, currentProductId, setValue, index]
  );

  const handleProductSelect = useCallback(
    async (product: Product) => {
      // Fill in the line item with product data
      setValue(`lineItems.${index}.name`, product.name, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (product.price !== undefined) {
        setValue(`lineItems.${index}.price`, product.price, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      if (product.unit) {
        setValue(`lineItems.${index}.unit`, product.unit, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      // Set product reference
      setValue(`lineItems.${index}.productId`, product.id, {
        shouldValidate: true,
        shouldDirty: true,
      });

      // Increment usage count since user actively selected this product
      try {
        await productsApi.incrementUsage(product.id);
        refetch(); // Refresh products to get updated usage counts
      } catch (error) {
        console.error("Failed to increment product usage:", error);
      }

      setShowSuggestions(false);
      onProductSelect?.(product);
    },
    [setValue, index, onProductSelect, refetch]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setSelectedIndex(-1);

    // Only show suggestions if no product is selected
    if (!currentProductId) {
      setShowSuggestions(true);
    }
  }, [currentProductId]);

  /**
   * Save line item as product on blur (smart learning like midday-main)
   * This creates/updates products automatically from invoice line items
   */
  const handleBlur = useCallback(async () => {
    setIsFocused(false);
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200);

    // Only save if there's content OR if we need to clear a productId
    const hasContent = value && value.trim().length > 0;
    const needsToClearProductId = !hasContent && currentProductId;

    if (hasContent || needsToClearProductId) {
      setIsSaving(true);
      try {
        const response = await productsApi.saveLineItemAsProduct({
          name: value || "",
          price: currentPrice !== undefined ? currentPrice : null,
          unit: currentUnit || null,
          productId: currentProductId || undefined,
          currency: currency || null,
        });

        if (response.success && response.data) {
          const { product, shouldClearProductId } = response.data;

          if (shouldClearProductId) {
            // Clear the old product reference
            setValue(`lineItems.${index}.productId`, undefined, {
              shouldValidate: true,
              shouldDirty: true,
            });
          } else if (product && !currentProductId) {
            // Set the new product reference if we created/found a product
            setValue(`lineItems.${index}.productId`, product.id, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }

          // Refresh products list
          refetch();
        }
      } catch (error) {
        console.error("Failed to save line item as product:", error);
      } finally {
        setIsSaving(false);
      }
    }
  }, [
    value,
    currentPrice,
    currentUnit,
    currentProductId,
    currency,
    setValue,
    index,
    refetch,
  ]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredProducts.length]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showSuggestions && filteredProducts.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((prev) =>
              prev < filteredProducts.length - 1 ? prev + 1 : 0
            );
            return;
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredProducts.length - 1
            );
            return;
          case "Enter":
            e.preventDefault();
            e.stopPropagation();
            if (selectedIndex >= 0 && filteredProducts[selectedIndex]) {
              handleProductSelect(filteredProducts[selectedIndex]);
            }
            return;
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            setShowSuggestions(false);
            setSelectedIndex(-1);
            inputRef.current?.blur();
            return;
        }
      }

      if (e.key === "Tab") {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    },
    [showSuggestions, filteredProducts, selectedIndex, handleProductSelect]
  );

  const showPlaceholder = !value && !isFocused;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={isFocused && !value ? "Search or create product..." : ""}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        className={cn(
          "border-0 p-0 min-h-6 border-b border-transparent focus:border-border text-xs pt-1",
          "transition-colors duration-200 bg-transparent outline-none resize-none w-full",
          "text-primary leading-[18px]",
          "placeholder:font-sans placeholder:text-muted-foreground",
          showPlaceholder &&
            "bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]"
        )}
      />

      {showSuggestions && !currentProductId && (
        <div className="absolute z-50 mt-1 bg-background border shadow-md max-h-64 overflow-y-auto right-0 left-0 rounded-md">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Loading products...
            </div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product, suggestionIndex) => (
              <div
                key={product.id}
                className={cn(
                  "w-full cursor-pointer px-3 py-2 transition-colors",
                  selectedIndex === suggestionIndex &&
                    "bg-accent text-accent-foreground",
                  hoveredIndex === suggestionIndex &&
                    "bg-accent text-accent-foreground"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleProductSelect(product);
                }}
                onMouseEnter={() => {
                  setSelectedIndex(suggestionIndex);
                  setHoveredIndex(suggestionIndex);
                }}
                onMouseLeave={() => setHoveredIndex(-1)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <div className="text-xs font-medium">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {product.description}
                      </div>
                    )}
                  </div>

                  {product.price !== undefined && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatInvoiceAmount({
                        amount: product.price,
                        currency: product.currency || currency || "EUR",
                        locale: locale || "sr-RS",
                        maximumFractionDigits,
                      })}
                      {product.unit && `/${product.unit}`}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : value.trim().length >= 2 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No products found
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Type to search products...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
