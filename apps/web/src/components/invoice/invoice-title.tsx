"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { FormValues } from "./form-context";

export function InvoiceTitle() {
  const { control } = useFormContext<FormValues>();

  return (
    <Controller
      control={control}
      name="template.title"
      render={({ field }) => (
        <Input
          {...field}
          value={field.value || "Invoice"}
          onChange={(e) => field.onChange(e.target.value)}
          className="text-[21px] font-semibold border-0 p-0 h-auto w-fit min-w-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          placeholder="Invoice"
        />
      )}
    />
  );
}
