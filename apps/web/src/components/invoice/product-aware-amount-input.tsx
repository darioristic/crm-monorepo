"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type FieldPath, useController, useFormContext, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { productsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FormValues } from "./form-context";

// Same query key as ProductAutocomplete
const PRODUCTS_QUERY_KEY = ["invoice-products"];

type Props = {
  name: FieldPath<FormValues>;
  lineItemIndex: number;
  className?: string;
};

export function ProductAwareAmountInput({ name, lineItemIndex, className }: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const { control, watch } = useFormContext<FormValues>();
  const queryClient = useQueryClient();

  const {
    field: { value, onChange, onBlur },
  } = useController<FormValues>({
    name,
    control,
  });

  // Get current line item data for saving product
  const lineItemName = watch(`lineItems.${lineItemIndex}.name`);
  const currentUnit = watch(`lineItems.${lineItemIndex}.unit`);
  const currentProductId = watch(`lineItems.${lineItemIndex}.productId`);
  const currency = useWatch({ control, name: "template.currency" });

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

  const handleAmountBlur = () => {
    setIsFocused(false);
    onBlur();

    // Only save if we have a productId and a valid name
    if (currentProductId && lineItemName && lineItemName.trim().length > 0) {
      saveProductMutation.mutate({
        name: lineItemName.trim(),
        price: typeof value === "number" ? value : null,
        unit: currentUnit || null,
        productId: currentProductId,
        currency: currency || null,
      });
    }
  };

  const isPlaceholder = !value && !isFocused;

  return (
    <div className="relative font-mono">
      <NumericFormat
        name={name}
        id={name}
        autoComplete="off"
        value={value as number | string | null | undefined}
        onValueChange={(values) => {
          onChange(
            values.floatValue !== undefined && values.floatValue !== null ? values.floatValue : 0
          );
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={handleAmountBlur}
        placeholder="0"
        className={cn(
          "p-0 border-0 h-6 !bg-transparent border-b border-transparent focus:border-border outline-none text-center w-full text-xs",
          className,
          isPlaceholder && "opacity-0"
        )}
        thousandSeparator={true}
        decimalScale={2}
      />

      {isPlaceholder && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
        </div>
      )}
    </div>
  );
}
