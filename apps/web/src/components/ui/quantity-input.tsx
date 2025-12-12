"use client";

import { Minus, Plus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  className?: string;
  step?: number;
  placeholder?: string;
};

export function QuantityInput({
  value = 0,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  onChange,
  onBlur,
  onFocus,
  className,
  step = 0.1,
  placeholder = "0",
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [rawValue, setRawValue] = React.useState(String(value));

  const handleInput: React.ChangeEventHandler<HTMLInputElement> = ({ currentTarget: el }) => {
    const input = el.value;
    setRawValue(input);

    const num = Number.parseFloat(input);
    if (!Number.isNaN(num) && min <= num && num <= max) {
      onChange?.(num);
    }
  };

  const handlePointerDown = (diff: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      event.preventDefault();
      inputRef.current?.focus();
    }
    const newVal = Math.min(Math.max(value + diff, min), max);
    onChange?.(newVal);
    setRawValue(String(newVal));
  };

  return (
    <div className={cn("group flex items-stretch transition-[box-shadow] font-mono", className)}>
      <button
        aria-label="Decrease"
        className="flex items-center pr-[.325em]"
        disabled={value <= min}
        onPointerDown={handlePointerDown(-1)}
        type="button"
        tabIndex={-1}
      >
        <Minus className="size-2" absoluteStrokeWidth strokeWidth={3.5} />
      </button>
      <div className="relative grid items-center justify-items-center text-center">
        <input
          ref={inputRef}
          className="flex w-full max-w-full text-center transition-colors file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 border-0 h-6 text-xs !bg-transparent border-b border-transparent focus:border-border [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
          style={{ fontKerning: "none" }}
          type="number"
          min={min}
          max={max}
          autoComplete="off"
          step={step}
          value={rawValue === "0" ? "" : rawValue}
          placeholder={placeholder}
          onInput={handleInput}
          onBlur={onBlur}
          onFocus={onFocus}
          inputMode="decimal"
        />
      </div>
      <button
        aria-label="Increase"
        className="flex items-center pl-[.325em]"
        disabled={value >= max}
        onPointerDown={handlePointerDown(1)}
        type="button"
        tabIndex={-1}
      >
        <Plus className="size-2" absoluteStrokeWidth strokeWidth={3.5} />
      </button>
    </div>
  );
}

// Compact version with visible buttons for forms
type CompactQuantityInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
};

export function CompactQuantityInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  disabled,
  className,
  size = "default",
}: CompactQuantityInputProps) {
  const clamp = (val: number) => Math.min(Math.max(val, min), max);

  const sizeClasses = {
    sm: "size-6",
    default: "size-8",
  };

  const iconSizes = {
    sm: "size-3",
    default: "size-4",
  };

  return (
    <div className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        className={cn(
          sizeClasses[size],
          "flex items-center justify-center rounded-l-md border bg-muted text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:pointer-events-none",
          "transition-colors"
        )}
      >
        <Minus className={iconSizes[size]} />
      </button>
      <div
        className={cn(
          "flex items-center justify-center border-y bg-background px-3 text-sm tabular-nums",
          size === "sm" ? "h-6 min-w-[2rem]" : "h-8 min-w-[2.5rem]"
        )}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        className={cn(
          sizeClasses[size],
          "flex items-center justify-center rounded-r-md border bg-muted text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:pointer-events-none",
          "transition-colors"
        )}
      >
        <Plus className={iconSizes[size]} />
      </button>
    </div>
  );
}
