"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { FormValues } from "./form-context";
import { extractTextFromEditorDoc, createEditorDocFromText } from "@/types/invoice";

type EditBlockProps = {
  name: "topBlock" | "bottomBlock";
};

export function EditBlock({ name }: EditBlockProps) {
  const { control, setValue } = useFormContext<FormValues>();
  const value = useWatch({ control, name });
  const [isEditing, setIsEditing] = useState(!!value);

  const textValue = extractTextFromEditorDoc(value);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(name, createEditorDocFromText(text), { shouldDirty: true });
  };

  const handleRemove = () => {
    setValue(name, null, { shouldDirty: true });
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1 text-[10px] text-[#878787] hover:text-foreground transition-colors py-2"
      >
        <Plus className="h-3 w-3" />
        <span>Add {name === "topBlock" ? "header" : "footer"} text</span>
      </button>
    );
  }

  return (
    <div className="relative py-2 group">
      <Textarea
        value={textValue}
        onChange={handleChange}
        placeholder={`Add ${name === "topBlock" ? "header" : "footer"} text...`}
        className="min-h-[60px] text-[11px] border-[#DCDAD2] dark:border-[#2C2C2C] resize-none leading-relaxed bg-transparent placeholder:text-[#878787]"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute -top-1 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
