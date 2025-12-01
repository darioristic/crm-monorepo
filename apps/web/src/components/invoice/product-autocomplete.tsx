"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { FormValues } from "./form-context";
import { formatInvoiceAmount } from "@/utils/invoice-calculate";
import { useProductEdit } from "./product-edit-context";

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
  const [, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openProductEdit, setOnProductUpdated } = useProductEdit();
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

  // Fetch products when component mounts or currency changes
  // Don't filter by currency to show all products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch without currency filter to show all products
      const response = await productsApi.getPopular({
        limit: 100,
      });

      console.log("Fetched products:", response);

      if (response.success && response.data) {
        const transformedProducts: Product[] = response.data.map((p) => ({
          id: p.id,
          name: p.name,
          price:
            typeof p.unitPrice === "string"
              ? parseFloat(p.unitPrice)
              : p.unitPrice,
          unit: p.unit ?? undefined,
          currency: p.currency || currency || "EUR",
          description: p.description ?? undefined,
        }));
        setProducts(transformedProducts);
      } else {
        console.error("Failed to fetch products:", response.error);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currency]);

  // Fetch products on mount and when currency changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter products based on input - show more products for better UX
  const filteredProducts =
    value.trim().length >= 1
      ? products.filter((product) =>
          product.name.toLowerCase().includes(value.toLowerCase())
        )
      : products.slice(0, 10); // Show top 10 when not searching

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

      // Show suggestions when typing
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
        fetchProducts(); // Refresh products to get updated usage counts
      } catch (error) {
        console.error("Failed to increment product usage:", error);
      }

      setShowSuggestions(false);
      onProductSelect?.(product);
    },
    [setValue, index, onProductSelect, fetchProducts]
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
   * Save line item as product on blur (smart learning like midday)
   * This creates/updates products automatically from invoice line items
   * Only saves if name has minimum 3 characters to avoid garbage data
   */
  const handleBlur = useCallback(async () => {
    setIsFocused(false);
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200);

    const trimmedValue = (value || "").trim();
    // Only save if name has at least 3 characters (to avoid garbage like "re", "da")
    const hasValidContent = trimmedValue.length >= 3;
    const needsToClearProductId = trimmedValue.length === 0 && currentProductId;

    if (hasValidContent || needsToClearProductId) {
      setIsSaving(true);
      try {
        const saveData = {
          name: trimmedValue,
          price:
            currentPrice !== undefined && currentPrice !== 0
              ? currentPrice
              : null,
          unit: currentUnit || null,
          productId: currentProductId || undefined,
          currency: currency || "EUR",
        };

        console.log("Saving product:", saveData);

        const response = await productsApi.saveLineItemAsProduct(saveData);

        console.log("Save response:", response);

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
          fetchProducts();
        } else if (!response.success) {
          console.error("Failed to save product:", response.error);
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
    fetchProducts,
  ]);

  // Reset selection when filtered products change
  const prevProductsLengthRef = useRef(filteredProducts.length);
  useEffect(() => {
    if (prevProductsLengthRef.current !== filteredProducts.length) {
      setSelectedIndex(-1);
      prevProductsLengthRef.current = filteredProducts.length;
    }
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
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
            setSelectedIndex((prev) => {
              const newIndex =
                prev === -1
                  ? 0
                  : prev < filteredProducts.length - 1
                  ? prev + 1
                  : 0;
              return newIndex;
            });
            return;
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((prev) => {
              const newIndex =
                prev === -1
                  ? filteredProducts.length - 1
                  : prev > 0
                  ? prev - 1
                  : filteredProducts.length - 1;
              return newIndex;
            });
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
    <div ref={containerRef}>
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
        <div className="absolute z-50 mt-1 bg-background border shadow-md max-h-64 overflow-y-auto right-0 left-0">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Loading products...
            </div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product, suggestionIndex) => {
              const isSelected = selectedIndex === suggestionIndex;
              const isHovered = hoveredIndex === suggestionIndex;
              return (
                <div
                  key={product.id}
                  className={cn(
                    "w-full px-3 py-2 transition-colors flex items-center justify-between",
                    (isSelected || isHovered) &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <button
                    type="button"
                    className="flex flex-col flex-1 text-left cursor-pointer"
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
                    <span className="text-xs">{product.name}</span>
                    {product.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {product.description}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {product.price !== undefined && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground cursor-pointer"
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
                        {formatInvoiceAmount({
                          amount: product.price,
                          currency: product.currency || currency || "EUR",
                          locale: locale || "sr-RS",
                          maximumFractionDigits,
                        })}
                        {product.unit && `/${product.unit}`}
                      </button>
                    )}
                    <div
                      className={cn(
                        "flex justify-end transition-all duration-150 ease-out overflow-hidden",
                        isHovered ? "w-8" : "w-0"
                      )}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOnProductUpdated(() => fetchProducts);
                          openProductEdit(product.id);
                          setShowSuggestions(false);
                        }}
                        onMouseEnter={() => {
                          setSelectedIndex(suggestionIndex);
                          setHoveredIndex(suggestionIndex);
                        }}
                        className={cn(
                          "text-xs px-1 transition-all duration-150 ease-out",
                          isHovered
                            ? "opacity-50 hover:opacity-100"
                            : "opacity-0 pointer-events-none"
                        )}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : value.trim().length >= 2 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No products found - will be created on save
            </div>
          ) : products.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No products yet - type to create one
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
