"use client";

import { Controller, useFormContext } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Input } from "@/components/ui/input";
import type { FormValues } from "./form-context";

export function QuoteNo() {
  const { control, formState } = useFormContext<FormValues>();
  const error = formState.errors.quoteNumber;

  return (
    <div className="flex items-center gap-2">
      <LabelInput name="template.quoteNoLabel" className="text-[11px] text-[#878787] w-[70px]" />
      <Controller
        control={control}
        name="quoteNumber"
        render={({ field }) => (
          <Input
            {...field}
            className={`text-[11px] border-0 p-0 h-auto w-fit min-w-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 font-mono bg-transparent ${
              error ? "text-red-500" : ""
            }`}
            placeholder="Auto"
            readOnly
          />
        )}
      />
    </div>
  );
}
