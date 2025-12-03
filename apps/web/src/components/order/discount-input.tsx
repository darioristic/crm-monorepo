"use client";

import { useState, useEffect } from "react";
import { useFormContext, useWatch, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatOrderAmount, parseCurrencyString } from "@/utils/order-calculate";
import type { FormValues } from "./form-context";

export function DiscountInput() {
  const { control } = useFormContext<FormValues>();
  const discount = useWatch({ control, name: "discount" });
  const currency = useWatch({ control, name: "template.currency" });
  const includeDecimals = useWatch({ control, name: "template.includeDecimals" });
  const locale = useWatch({ control, name: "template.locale" });
  const [isEditing, setIsEditing] = useState(false);

  const maximumFractionDigits = includeDecimals ? 2 : 0;

  return (
    <div>
      {isEditing ? (
        <Controller
          control={control}
          name="discount"
          render={({ field }) => {
            const [localValue, setLocalValue] = useState(
              field.value?.toString() || "0"
            );

            useEffect(() => {
              setLocalValue(field.value?.toString() || "0");
            }, [field.value]);

            const handleBlur = () => {
              const parsed = parseCurrencyString(localValue);
              const value = isNaN(parsed) || parsed < 0 ? 0 : parsed;
              field.onChange(value);
              setLocalValue(value.toString());
              setIsEditing(false);
            };

            return (
              <Input
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                autoFocus
                className="h-6 w-24 text-[11px] text-right font-mono border-[#DCDAD2] dark:border-[#2C2C2C]"
              />
            );
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs font-mono hover:text-foreground transition-colors"
        >
          -
          {formatOrderAmount({
            amount: discount ?? 0,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
            maximumFractionDigits,
          })}
        </button>
      )}
    </div>
  );
}

