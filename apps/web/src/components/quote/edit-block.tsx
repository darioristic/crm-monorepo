"use client";

import { useState } from "react";
import { useFormContext, useWatch, Controller } from "react-hook-form";
import { Plus } from "lucide-react";
import { Editor } from "@/components/quote/editor";
import type { FormValues } from "./form-context";

type EditBlockProps = {
  name: "topBlock" | "bottomBlock";
};

export function EditBlock({ name }: EditBlockProps) {
  const { control, watch } = useFormContext<FormValues>();
  const value = useWatch({ control, name });
  const [isEditing, setIsEditing] = useState(!!value);
  const id = watch("id");

  const label = name === "topBlock" ? "Header" : "Footer";
  const placeholder = name === "topBlock" 
    ? "Add header text..." 
    : "Add footer text...";

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1 text-[11px] text-[#878787] hover:text-foreground transition-colors py-2"
      >
        <Plus className="h-3 w-3" />
        <span>Add {label.toLowerCase()} text</span>
      </button>
    );
  }

  return (
    <div>
      <span className="text-[11px] text-[#878787] mb-2 block">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Editor
            key={id}
            initialContent={field.value}
            onChange={field.onChange}
            placeholder={placeholder}
            className="min-h-[70px] [&>div]:min-h-[70px]"
          />
        )}
      />
    </div>
  );
}

