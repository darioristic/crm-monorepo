"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { FormValues } from "./form-context";

export function OrderTitle() {
  const { control } = useFormContext<FormValues>();

  return (
    <Controller
      control={control}
      name="template.title"
      render={({ field }) => (
        <Input
          {...field}
          value={field.value || "Order"}
          onChange={(e) => field.onChange(e.target.value)}
          className="!text-[29px] !font-semibold border-0 p-0 h-auto w-fit min-w-[120px] focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          placeholder="Order"
        />
      )}
    />
  );
}
