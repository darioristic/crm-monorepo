"use client";

import { useEffect, useState } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { formatQuoteAmount, parseCurrencyString } from "@/utils/quote-calculate";
import type { FormValues } from "./form-context";

function DiscountInputEditor({
  value,
  onChange,
  onFinish,
}: {
  value: number;
  onChange: (val: number) => void;
  onFinish: () => void;
}) {
  const [localValue, setLocalValue] = useState(value?.toString() || "0");

  useEffect(() => {
    setLocalValue(value?.toString() || "0");
  }, [value]);

  const handleBlur = () => {
    const parsed = parseCurrencyString(localValue);
    const newValue = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onChange(newValue);
    setLocalValue(newValue.toString());
    onFinish();
  };

  return (
    <Input
      name="discount"
      id="discount"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-6 w-24 text-[11px] text-right font-mono border-[#DCDAD2] dark:border-[#2C2C2C]"
    />
  );
}

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
          render={({ field }) => (
            <DiscountInputEditor
              value={field.value ?? 0}
              onChange={field.onChange}
              onFinish={() => setIsEditing(false)}
            />
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs font-mono hover:text-foreground transition-colors"
        >
          -
          {formatQuoteAmount({
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
