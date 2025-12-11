"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAuth } from "@/contexts/auth-context";
import { productsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatOrderAmount } from "@/utils/order-calculate";
import type { FormValues } from "./form-context";
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

// Query key for products - include companyId to refresh on company switch

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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { openProductEdit, setOnProductUpdated } = useProductEdit();
  const { setValue, watch, control } = useFormContext<FormValues>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lsCompany =
    typeof window !== "undefined"
      ? window.localStorage?.getItem("selectedCompanyId") || undefined
      : undefined;
  const effectiveCompanyId = user?.companyId ?? lsCompany;
  const PRODUCTS_QUERY_KEY = ["order-products", effectiveCompanyId];

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

  // Fetch products using React Query - shared across ALL ProductAutocomplete instances
  const { data: products = [], isLoading } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const response = await productsApi.getPopular({ limit: 100 });
      if (response.success && response.data) {
        return response.data.map((p) => ({
          id: p.id,
          name: p.name,
          price: typeof p.unitPrice === "string" ? parseFloat(p.unitPrice) : p.unitPrice,
          unit: p.unit ?? undefined,
          currency: p.currency || currency || "EUR",
          description: p.description ?? undefined,
        })) as Product[];
      }
      return [];
    },
    staleTime: 30000, // 30 seconds - shorter to get fresher data
    refetchOnWindowFocus: true,
  });

  // Mutation for saving line item as product
  const saveProductMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      price?: number | null;
      unit?: string | null;
      productId?: string;
      currency?: string | null;
    }) => {
      return productsApi.saveLineItemAsProduct(data);
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        const { product, shouldClearProductId } = response.data;

        if (shouldClearProductId) {
          setValue(`lineItems.${index}.productId`, undefined, {
            shouldValidate: true,
            shouldDirty: true,
          });
        } else if (product && !currentProductId) {
          setValue(`lineItems.${index}.productId`, product.id, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }

        // Invalidate products query to refresh ALL ProductAutocomplete instances
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      }
    },
  });

  // Mutation for incrementing usage count
  const incrementUsageMutation = useMutation({
    mutationFn: async (productId: string) => {
      return productsApi.incrementUsage(productId);
    },
    onSuccess: () => {
      // Invalidate products query to get fresh usage counts
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });

  // Filter products based on input
  const filteredProducts =
    value.trim().length >= 1
      ? products.filter((product) => product.name.toLowerCase().includes(value.toLowerCase()))
      : products.slice(0, 10);

  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setSelectedIndex(-1);

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
    (product: Product) => {
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

      // Set description from product
      if (product.description) {
        setValue(`lineItems.${index}.description`, product.description, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      setValue(`lineItems.${index}.productId`, product.id, {
        shouldValidate: true,
        shouldDirty: true,
      });

      // Increment usage count
      incrementUsageMutation.mutate(product.id);

      setShowSuggestions(false);
      onProductSelect?.(product);
    },
    [setValue, index, onProductSelect, incrementUsageMutation]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setSelectedIndex(-1);

    // Refetch products on focus to ensure fresh data
    queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });

    if (!currentProductId) {
      setShowSuggestions(true);
    }
  }, [currentProductId, queryClient]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setTimeout(() => setShowSuggestions(false), 200);

    const trimmedValue = (value || "").trim();
    const hasValidContent = trimmedValue.length >= 3;
    const needsToClearProductId = trimmedValue.length === 0 && currentProductId;

    if (hasValidContent || needsToClearProductId) {
      saveProductMutation.mutate({
        name: trimmedValue,
        price: currentPrice !== undefined && currentPrice !== 0 ? currentPrice : null,
        unit: currentUnit || null,
        productId: currentProductId || undefined,
        currency: currency || "EUR",
      });
    }
  }, [value, currentPrice, currentUnit, currentProductId, currency, saveProductMutation]);

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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
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
              const newIndex = prev === -1 ? 0 : prev < filteredProducts.length - 1 ? prev + 1 : 0;
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

  // Callback for when product is updated in edit sheet
  const handleProductUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
  }, [queryClient]);

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
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading products...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product, suggestionIndex) => {
              const isSelected = selectedIndex === suggestionIndex;
              const isHovered = hoveredIndex === suggestionIndex;
              return (
                <div
                  key={product.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  className={cn(
                    "w-full px-3 py-2 transition-colors flex items-center justify-between cursor-pointer",
                    (isSelected || isHovered) && "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => {
                    setSelectedIndex(suggestionIndex);
                    setHoveredIndex(suggestionIndex);
                  }}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  onMouseDown={(e) => {
                    if ((e.target as HTMLElement).closest("[data-edit-button]")) {
                      return;
                    }
                    e.preventDefault();
                    handleProductSelect(product);
                  }}
                >
                  <div className="flex flex-col flex-1 text-left">
                    <span className="text-xs">{product.name}</span>
                    {product.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {product.description}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {product.price !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {formatOrderAmount({
                          amount: product.price,
                          currency: product.currency || currency || "EUR",
                          locale: locale || "sr-RS",
                          maximumFractionDigits,
                        })}
                        {product.unit && `/${product.unit}`}
                      </span>
                    )}
                    {isHovered && (
                      <button
                        type="button"
                        data-edit-button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOnProductUpdated(() => handleProductUpdated);
                          openProductEdit(product.id);
                          setShowSuggestions(false);
                        }}
                        className="text-xs px-1 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        Edit
                      </button>
                    )}
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
