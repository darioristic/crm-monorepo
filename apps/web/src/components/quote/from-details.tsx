"use client";

import type { JSONContent } from "@tiptap/react";
import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Editor } from "@/components/quote/editor";
import { useTenant } from "@/contexts/tenant-context";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "quote_from_details";
const STORAGE_LABEL_KEY = "quote_from_label";

export function FromDetails() {
  const { control, watch, setValue } = useFormContext();
  const id = watch("id");
  const fromDetails = watch("fromDetails");
  const fromLabel = watch("template.fromLabel");
  const { currentTenant } = useTenant();

  // Initialize From details from tenant account or localStorage
  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setValue("fromDetails", parsed, { shouldDirty: false });
          return true;
        }
      } catch (e) {
        logger.error("Failed to load from details from localStorage:", e);
      }
      return false;
    };

    const loadFromTenantAccount = async () => {
      if (!currentTenant?.id) return;
      try {
        const res = await fetch(`/api/v1/tenant-accounts/${currentTenant.id}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const account = data?.data;
        const lines: string[] = [];
        if (account?.name) lines.push(account.name);
        if (account?.address) lines.push(account.address);
        const cityLine = [account?.city, account?.zip, account?.country].filter(Boolean).join(", ");
        if (cityLine) lines.push(cityLine);
        if (account?.email) lines.push(account.email);
        if (account?.phone) lines.push(account.phone);
        if (account?.website) lines.push(account.website);
        if (account?.vatNumber) lines.push(`PIB: ${account.vatNumber}`);
        if (account?.companyNumber) lines.push(`MB: ${account.companyNumber}`);
        const built =
          lines.length > 0
            ? {
                type: "doc",
                content: lines.map((line) => ({
                  type: "paragraph",
                  content: [{ type: "text", text: line }],
                })),
              }
            : null;
        if (built) {
          setValue("fromDetails", built, { shouldDirty: false });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(built));
          } catch (_) {}
        }
      } catch (error) {
        logger.error("Failed to fetch tenant account details:", error);
      }
    };

    if (!fromDetails) {
      const hasLocal = loadFromLocalStorage();
      if (!hasLocal) {
        loadFromTenantAccount();
      }
    }

    if (!fromLabel || fromLabel === "From") {
      try {
        const savedLabel = localStorage.getItem(STORAGE_LABEL_KEY);
        if (savedLabel) {
          setValue("template.fromLabel", savedLabel, { shouldDirty: false });
        }
      } catch (_) {}
    }
  }, [currentTenant?.id]);

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
