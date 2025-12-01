"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { useState, useCallback } from "react";
import {
  useFormContext,
  useWatch,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import type { FormValues } from "./form-context";

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
  const [isSaving, setIsSaving] = useState(false);
  const { control, watch, register } = useFormContext<FormValues>();

  // Get current line item data for saving product
  const lineItemName = watch(`lineItems.${lineItemIndex}.name`);
  const currentPrice = watch(`lineItems.${lineItemIndex}.price`);
  const currentUnit = watch(`lineItems.${lineItemIndex}.unit`);
  const currentProductId = watch(`lineItems.${lineItemIndex}.productId`);
  const currency = useWatch({ control, name: "template.currency" });

  const { ref, ...registerProps } = register(name as any);

  /**
   * Save line item as product on blur (when unit changes)
   * Only saves if we have a productId (meaning this line item references an existing product)
   */
  const handleUnitBlur = useCallback(async () => {
    setIsFocused(false);

    // Only save if we have a productId and a valid name
    if (currentProductId && lineItemName && lineItemName.trim().length > 0) {
      setIsSaving(true);
      try {
        await productsApi.saveLineItemAsProduct({
          name: lineItemName.trim(),
          price: currentPrice !== undefined ? currentPrice : null,
          unit: currentUnit || null,
          productId: currentProductId,
          currency: currency || null,
        });
      } catch (error) {
        console.error("Failed to update product unit:", error);
      } finally {
        setIsSaving(false);
      }
    }
  }, [currentProductId, lineItemName, currentPrice, currentUnit, currency]);

  const isPlaceholder = !currentUnit && !isFocused;

  return (
    <div className="relative">
      <input
        {...registerProps}
        ref={ref}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          registerProps.onBlur(e);
          handleUnitBlur();
        }}
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

