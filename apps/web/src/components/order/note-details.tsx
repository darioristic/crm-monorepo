"use client";

import { Controller, useFormContext } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Editor } from "@/components/order/editor";

export function NoteDetails() {
  const { control, watch } = useFormContext();
  const id = watch("id");

  return (
    <div>
      <LabelInput name="template.noteLabel" className="mb-2 block" />

      <Controller
        name="noteDetails"
        control={control}
        render={({ field }) => (
          <Editor
            key={id}
            initialContent={field.value}
            onChange={field.onChange}
            placeholder="Additional notes or terms..."
            className="min-h-[70px] [&>div]:min-h-[70px]"
          />
        )}
      />
    </div>
  );
}
