"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { LabelInput } from "./label-input";
import type { FormValues } from "./form-context";

export function OrderNo() {
  const { control, formState } = useFormContext<FormValues>();
  const error = formState.errors.orderNumber;

  return (
    <div className="flex items-center gap-2">
      <LabelInput
        name="template.orderNoLabel"
        className="text-[11px] text-[#878787] w-[70px]"
      />
      <Controller
        control={control}
        name="orderNumber"
        render={({ field }) => (
          <Input
            {...field}
            className={`text-[11px] border-0 p-0 h-auto w-fit min-w-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 font-mono bg-transparent ${
              error ? "text-red-500" : ""
            }`}
            placeholder="ORD-001"
          />
        )}
      />
    </div>
  );
}

