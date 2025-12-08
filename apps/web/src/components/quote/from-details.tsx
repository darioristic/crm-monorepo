"use client";

import type { JSONContent } from "@tiptap/react";
import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Editor } from "@/components/quote/editor";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "quote_from_details";
const STORAGE_LABEL_KEY = "quote_from_label";

export function FromDetails() {
  const { control, watch, setValue } = useFormContext();
  const id = watch("id");
  const fromDetails = watch("fromDetails");
  const fromLabel = watch("template.fromLabel");

  // Load from localStorage on mount (only if form doesn't have data)
  useEffect(() => {
    if (!fromDetails) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setValue("fromDetails", parsed, { shouldDirty: false });
        }
      } catch (e) {
        logger.error("Failed to load from details from localStorage:", e);
      }
    }

    if (!fromLabel || fromLabel === "From") {
      try {
        const savedLabel = localStorage.getItem(STORAGE_LABEL_KEY);
        if (savedLabel) {
          setValue("template.fromLabel", savedLabel, { shouldDirty: false });
        }
      } catch (_e) {
        // Ignore
      }
    }
  }, []);

  // Save to localStorage when content changes
  const handleSave = (content: JSONContent | null) => {
    try {
      if (content) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      logger.error("Failed to save from details to localStorage:", e);
    }
  };

  // Save label to localStorage
  const handleLabelSave = (value: string) => {
    try {
      localStorage.setItem(STORAGE_LABEL_KEY, value);
    } catch (_e) {
      // Ignore
    }
  };

  return (
    <div>
      <LabelInput name="template.fromLabel" className="mb-2 block" onSave={handleLabelSave} />

      <Controller
        name="fromDetails"
        control={control}
        render={({ field }) => (
          <Editor
            // NOTE: This is a workaround to get the new content to render
            key={id}
            initialContent={field.value}
            onChange={field.onChange}
            onBlur={(content) => {
              handleSave(content);
            }}
            placeholder="Your company name&#10;Address&#10;City, Country&#10;Email / Phone"
            className="min-h-[90px] [&>div]:min-h-[90px]"
          />
        )}
      />
    </div>
  );
}
