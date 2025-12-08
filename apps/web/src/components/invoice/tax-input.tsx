"use client";

import { useId } from "react";
import { useController, useFormContext } from "react-hook-form";
import { NumericFormat } from "react-number-format";

export function TaxInput() {
  const { control } = useFormContext();
  const id = useId();

  const {
    field: { value, onChange },
  } = useController({
    name: "template.taxRate",
    control,
  });

  return (
    <NumericFormat
      name="template.taxRate"
      id={id}
      suffix="%)"
      prefix="("
      autoComplete="off"
      value={value}
      onValueChange={(values) => {
        const newValue = values.floatValue ?? 0;
        onChange(newValue);
      }}
      className="p-0 border-0 h-6 text-xs !bg-transparent flex-shrink-0 w-16 text-[11px] text-[#878787] outline-none"
      thousandSeparator={false}
      decimalScale={2}
      isAllowed={(values) => {
        const { floatValue } = values;
        return floatValue === undefined || (floatValue >= 0 && floatValue <= 100);
      }}
      allowNegative={false}
    />
  );
}
