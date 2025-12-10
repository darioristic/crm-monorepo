"use client";

import type { JSONContent } from "@tiptap/react";
import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Editor } from "@/components/invoice/editor";
import { LabelInput } from "./label-input";

const STORAGE_KEY = "invoice_payment_details";
const STORAGE_LABEL_KEY = "invoice_payment_label";

export function PaymentDetails() {
  const { control, watch, setValue } = useFormContext();
  const id = watch("id");
  const paymentDetails = watch("paymentDetails");
  const paymentLabel = watch("template.paymentLabel");

  // Load from localStorage on mount
  useEffect(() => {
    if (!paymentDetails) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setValue("paymentDetails", parsed, { shouldDirty: false });
        }
      } catch (_e) {
        // Ignore
      }
    }

    if (!paymentLabel || paymentLabel === "Payment Details") {
      try {
        const savedLabel = localStorage.getItem(STORAGE_LABEL_KEY);
        if (savedLabel) {
          setValue("template.paymentLabel", savedLabel, { shouldDirty: false });
        }
      } catch (_e) {
        // Ignore
      }
    }
  }, []);

  const handleSave = (content: JSONContent | null) => {
    try {
      if (content) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_e) {
      // Ignore
    }
  };

  const handleLabelSave = (value: string) => {
    try {
      localStorage.setItem(STORAGE_LABEL_KEY, value);
    } catch (_e) {
      // Ignore
    }
  };

  return (
    <div>
      <LabelInput name="template.paymentLabel" className="mb-2 block" onSave={handleLabelSave} />

      <Controller
        name="paymentDetails"
        control={control}
        render={({ field }) => (
          <Editor
            key={id}
            initialContent={field.value}
            onChange={field.onChange}
            onBlur={(content) => {
              handleSave(content);
            }}
            placeholder="Bank name&#10;IBAN: XX00 0000 0000 0000&#10;SWIFT: XXXXXXXX"
            className="min-h-[70px] [&>div]:min-h-[70px]"
          />
        )}
      />
    </div>
  );
}
