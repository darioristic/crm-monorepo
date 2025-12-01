"use client";

import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api";
import { NumericFormat } from "react-number-format";
import { useState, useCallback } from "react";
import {
  useController,
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
};

export function ProductAwareAmountInput<T extends FieldValues>({
  name,
  lineItemIndex,
  className,
}: Props<T>) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { control, watch } = useFormContext<FormValues>();

  const {
    field: { value, onChange, onBlur },
  } = useController({
    name,
    control: control as any,
  });

  // Get current line item data for saving product
  const lineItemName = watch(`lineItems.${lineItemIndex}.name`);
  const currentUnit = watch(`lineItems.${lineItemIndex}.unit`);
  const currentProductId = watch(`lineItems.${lineItemIndex}.productId`);
  const currency = useWatch({ control, name: "template.currency" });

  /**
   * Save line item as product on blur (when price changes)
   * Only saves if we have a productId (meaning this line item references an existing product)
   */
  const handleAmountBlur = useCallback(async () => {
    setIsFocused(false);
    onBlur();

    // Only save if we have a productId and a valid name
    if (currentProductId && lineItemName && lineItemName.trim().length > 0) {
      setIsSaving(true);
      try {
        await productsApi.saveLineItemAsProduct({
          name: lineItemName.trim(),
          price: value !== undefined ? value : null,
          unit: currentUnit || null,
          productId: currentProductId,
          currency: currency || null,
        });
      } catch (error) {
        console.error("Failed to update product price:", error);
      } finally {
        setIsSaving(false);
      }
    }
  }, [currentProductId, lineItemName, value, currentUnit, currency, onBlur]);

  const isPlaceholder = !value && !isFocused;

  return (
    <div className="relative">
      <NumericFormat
        autoComplete="off"
        value={value}
        onValueChange={(values) => {
          onChange(
            values.floatValue !== undefined && values.floatValue !== null
              ? values.floatValue
              : 0
          );
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={handleAmountBlur}
        placeholder="0"
        className={cn(
          "p-0 border-0 h-6 bg-transparent border-b border-transparent focus:border-border outline-none text-center w-full text-xs",
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

