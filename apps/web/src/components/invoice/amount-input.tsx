"use client";

import { cn } from "@/lib/utils";
import { NumericFormat, type NumericFormatProps } from "react-number-format";
import { useState } from "react";
import { useController, useFormContext } from "react-hook-form";

export function AmountInput({
  className,
  name,
  ...props
}: Omit<NumericFormatProps, "value" | "onChange"> & {
  name: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const { control } = useFormContext();
  const {
    field: { value, onChange, onBlur },
  } = useController({
    name,
    control,
  });

  const isPlaceholder = !value && !isFocused;

  return (
    <div className="relative font-mono">
      <NumericFormat
        autoComplete="off"
        value={value}
        onValueChange={(values) => {
          // Preserve the exact floatValue, including 0 and decimals like 1.20
          // Only use 0 as fallback if floatValue is explicitly undefined/null
          onChange(
            values.floatValue !== undefined && values.floatValue !== null
              ? values.floatValue
              : 0
          );
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur();
        }}
        {...props}
        className={cn(
          className,
          isPlaceholder && "opacity-0",
          "p-0 border-0 h-6 text-xs !bg-transparent border-b border-transparent focus:border-border outline-none"
        )}
        thousandSeparator={true}
        decimalScale={props.decimalScale ?? 2}
      />

      {isPlaceholder && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
        </div>
      )}
    </div>
  );
}
