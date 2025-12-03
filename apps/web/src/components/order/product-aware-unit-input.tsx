"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { useState } from "react";
import {
  useFormContext,
  useWatch,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import type { FormValues } from "./form-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Same query key as ProductAutocomplete
const PRODUCTS_QUERY_KEY = ["order-products"];

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  lineItemIndex: number;
  className?: string;
  placeholder?: string;
};

export function ProductAwareUnitInput<T extends FieldValues>({
  name,
  lineItemIndex,
  className,
  placeholder = "pcs",
}: Props<T>) {
  const [isFocused, setIsFocused] = useState(false);
  const { control, watch, register } = useFormContext<FormValues>();
  const queryClient = useQueryClient();

  // Get current line item data for saving product
  const lineItemName = watch(`lineItems.${lineItemIndex}.name`);
  const currentPrice = watch(`lineItems.${lineItemIndex}.price`);
  const currentUnit = watch(`lineItems.${lineItemIndex}.unit`);
  const currentProductId = watch(`lineItems.${lineItemIndex}.productId`);
  const currency = useWatch({ control, name: "template.currency" });

  const { ref, ...registerProps } = register(name as any);

  // Mutation for saving product with React Query
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
    onSuccess: () => {
      // Invalidate products query to refresh ALL ProductAutocomplete instances
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });

  const handleUnitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    registerProps.onBlur(e);

    // Only save if we have a productId and a valid name
    if (currentProductId && lineItemName && lineItemName.trim().length > 0) {
      saveProductMutation.mutate({
        name: lineItemName.trim(),
        price: currentPrice !== undefined ? currentPrice : null,
        unit: currentUnit || null,
        productId: currentProductId,
        currency: currency || null,
      });
    }
  };

  const isPlaceholder = !currentUnit && !isFocused;

  return (
    <div className="relative">
      <input
        {...registerProps}
        ref={ref}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={handleUnitBlur}
        className={cn(
          "p-0 border-0 h-6 bg-transparent border-b border-transparent focus:border-border outline-none text-center w-full text-xs",
          className,
          isPlaceholder && "opacity-0"
        )}
      />

      {isPlaceholder && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
        </div>
      )}
    </div>
  );
}
