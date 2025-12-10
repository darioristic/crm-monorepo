"use client";

import { useState } from "react";
import { type FieldPath, type FieldValues, useController, useFormContext } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { cn } from "@/lib/utils";

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  className?: string;
};

export function AmountInput<T extends FieldValues>({ name, className }: Props<T>) {
  const [isFocused, setIsFocused] = useState(false);
  const { control } = useFormContext<T>();
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
          onChange(
            values.floatValue !== undefined && values.floatValue !== null ? values.floatValue : 0
          );
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur();
        }}
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
