"use client";

import { useSliderWithInput } from "@/hooks/use-slider-with-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef } from "react";

type AmountRangeProps = {
  minValue?: number;
  maxValue?: number;
  initialValue?: [number, number];
  onChange: (range: [number, number]) => void;
  totalCount?: number;
  currency?: string;
  label?: string;
};

export function AmountRange({
  minValue = 0,
  maxValue = 100000,
  initialValue,
  onChange,
  totalCount,
  currency = "EUR",
  label = "Amount Range",
}: AmountRangeProps) {
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  const {
    sliderValue,
    inputValues,
    validateAndUpdateValue,
    handleInputChange,
    handleSliderChange,
    setValues,
  } = useSliderWithInput({
    minValue,
    maxValue,
    initialValue: initialValue || [minValue, maxValue],
  });

  // Initialize with defaults only if initialValue is not set
  useEffect(() => {
    if (minValue !== undefined && maxValue !== undefined && !initialValue) {
      setValues([minValue, maxValue]);
    }
  }, [minValue, maxValue, setValues, initialValue]);

  // Sync when initialValue changes
  useEffect(() => {
    if (initialValue && initialValue.length === 2) {
      setValues(initialValue);
    }
  }, [initialValue, setValues]);

  const handleApply = () => {
    if (sliderValue[0] !== undefined && sliderValue[1] !== undefined) {
      onChange([sliderValue[0], sliderValue[1]]);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("sr-RS", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {totalCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {totalCount} results
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <form
          className="flex w-full items-center justify-between gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleApply();
          }}
        >
          <div className="space-y-1 flex-1">
            <Label htmlFor="min-amount" className="text-xs">
              Min
            </Label>
            <Input
              ref={minInputRef}
              className="h-8 text-xs"
              type="text"
              inputMode="decimal"
              value={inputValues[0] || ""}
              onChange={(e) => handleInputChange(e, 0)}
              onFocus={(e) => e.target.select()}
              onBlur={() => validateAndUpdateValue(inputValues[0] ?? "", 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  validateAndUpdateValue(inputValues[0] ?? "", 0);
                  maxInputRef.current?.focus();
                }
              }}
              aria-label="Enter minimum amount"
            />
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="max-amount" className="text-xs">
              Max
            </Label>
            <Input
              ref={maxInputRef}
              className="h-8 text-xs"
              type="text"
              inputMode="decimal"
              value={inputValues[1] || ""}
              onChange={(e) => handleInputChange(e, 1)}
              onFocus={(e) => e.target.select()}
              onBlur={() => validateAndUpdateValue(inputValues[1] ?? "", 1)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  validateAndUpdateValue(inputValues[1] ?? "", 1);
                  handleApply();
                }
              }}
              aria-label="Enter maximum amount"
            />
          </div>
        </form>
      </div>

      <Slider
        value={sliderValue}
        onValueChange={handleSliderChange}
        min={minValue}
        max={maxValue}
        aria-label="Amount range"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(minValue)}</span>
        <span>{formatCurrency(maxValue)}</span>
      </div>

      <Button
        className="w-full text-xs"
        variant="outline"
        size="sm"
        onClick={handleApply}
      >
        Apply Filter
      </Button>
    </div>
  );
}
