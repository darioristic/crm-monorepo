"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Editor } from "@/components/invoice/editor";
import { LabelInput } from "./label-input";

// FROM details are now fetched from the current tenant via useInvoiceSettings hook
// No localStorage - tenant data is the source of truth

export function FromDetails() {
  const { control, watch } = useFormContext();
  const id = watch("id");

  return (
    <div>
      <LabelInput name="template.fromLabel" className="mb-2 block" />

      <Controller
        name="fromDetails"
        control={control}
        render={({ field }) => (
          <Editor
            // NOTE: This is a workaround to get the new content to render
            key={id}
            initialContent={field.value}
            onChange={field.onChange}
            placeholder="Your company name&#10;Address&#10;City, Country&#10;Email / Phone"
            className="min-h-[90px] [&>div]:min-h-[90px]"
          />
        )}
      />
    </div>
  );
}
