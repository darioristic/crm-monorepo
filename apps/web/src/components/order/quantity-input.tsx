"use client";

import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import {
  useController,
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
};

export function QuantityInput<T extends FieldValues>({
  name,
  className,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
}: Props<T>) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { control } = useFormContext<T>();
  const {
    field: { value, onChange, onBlur },
  } = useController({
    name,
    control,
  });

  const isPlaceholder = (value === 0 || !value) && !isFocused;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setRawValue(input);

    const num = parseFloat(input);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
  };

  const handlePointerDown = (diff: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") {
      e.preventDefault();
      inputRef.current?.focus();
    }
    const currentVal = typeof value === "number" ? value : 0;
    const newVal = Math.min(Math.max(currentVal + diff, min), max);
    onChange(newVal);
    setRawValue(String(newVal));
  };

  // Sync rawValue with form value
  const displayValue = isFocused ? rawValue : (value === 0 ? "" : String(value || ""));

  return (
    <div className="relative">
      <div
        className={cn(
          "group flex items-stretch transition-[box-shadow] font-mono justify-center",
          className,
          isPlaceholder && "[&_button]:pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Decrease"
          className={cn(
            "flex items-center pr-[.325em] opacity-0 group-hover:opacity-100 transition-opacity",
            isPlaceholder && "pointer-events-none"
          )}
          disabled={typeof value === "number" && value <= min}
          onPointerDown={handlePointerDown(-step)}
          tabIndex={-1}
        >
          <Minus className="size-2" strokeWidth={3.5} />
        </button>

        <div className="relative grid items-center justify-items-center text-center">
          <input
            ref={inputRef}
            type="number"
            min={min}
            max={max}
            step={step}
            autoComplete="off"
            value={displayValue}
            placeholder="0"
            onInput={handleInput}
            onFocus={() => {
              setIsFocused(true);
              setRawValue(value === 0 ? "" : String(value || ""));
            }}
            onBlur={() => {
              setIsFocused(false);
              onBlur();
            }}
            inputMode="decimal"
            className={cn(
              "flex w-full max-w-full text-center transition-colors placeholder:text-muted-foreground",
              "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              "p-0 border-0 h-6 text-xs !bg-transparent border-b border-transparent focus:border-border",
              "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
              isPlaceholder && "opacity-0"
            )}
            style={{ fontKerning: "none" }}
          />
        </div>

        <button
          type="button"
          aria-label="Increase"
          className={cn(
            "flex items-center pl-[.325em] opacity-0 group-hover:opacity-100 transition-opacity",
            isPlaceholder && "pointer-events-none"
          )}
          disabled={typeof value === "number" && value >= max}
          onPointerDown={handlePointerDown(step)}
          tabIndex={-1}
        >
          <Plus className="size-2" strokeWidth={3.5} />
        </button>
      </div>

      {isPlaceholder && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
        </div>
      )}
    </div>
  );
}
