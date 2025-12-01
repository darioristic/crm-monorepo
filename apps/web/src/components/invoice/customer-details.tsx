"use client";

import { Editor } from "@/components/invoice/editor";
import { companiesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import type { JSONContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { SelectCustomer } from "./select-customer";
import { LabelInput } from "./label-input";

// Check if content has actual text
function hasContent(content: JSONContent | null | undefined): boolean {
  if (!content) return false;
  if (!content.content || !Array.isArray(content.content)) return false;
  
  // Check if any paragraph has text
  return content.content.some((node: any) => {
    if (!node.content || !Array.isArray(node.content)) return false;
    return node.content.some((inline: any) => inline.text && inline.text.trim().length > 0);
  });
}

export function CustomerDetails() {
  const { control, setValue, watch } = useFormContext();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const content = watch("customerDetails");
  const id = watch("id");

  const { data: companiesData, isLoading, error } = useApi(
    () => companiesApi.getAll({ pageSize: 100 }),
    { autoFetch: true }
  );
  const companies = companiesData || [];


  // Find selected customer
  const customer = selectedCustomerId 
    ? companies.find((c: any) => c.id === selectedCustomerId)
    : null;

  const handleOnChange = (newContent?: JSONContent | null) => {
    // Reset the selected customer id when the content is changed
    setSelectedCustomerId(null);

    setValue("customerDetails", newContent, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (!newContent || !hasContent(newContent)) {
      setValue("customerName", null, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue("customerId", null, { shouldValidate: true, shouldDirty: true });
    }
  };

  useEffect(() => {
    if (customer) {
      const customerContent = transformCustomerToContent(customer);

      // Remove the selected customer id
      setSelectedCustomerId(null);

      setValue("customerName", customer.name, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue("customerId", customer.id, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue("customerDetails", customerContent, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [customer, setValue]);

  // Check if we have actual content to show
  const contentHasText = hasContent(content);

  return (
    <div>
      <LabelInput
        name="template.customerLabel"
        className="mb-2 block"
      />
      {contentHasText ? (
        <Controller
          name="customerDetails"
          control={control}
          render={({ field }) => (
            <Editor
              // NOTE: This is a workaround to get the new content to render
              key={id}
              initialContent={field.value}
              onChange={handleOnChange}
              placeholder="Customer details..."
              className="min-h-[90px]"
            />
          )}
        />
      ) : (
        <>
          {isLoading && (
            <div className="text-xs text-muted-foreground">Loading companies...</div>
          )}
          {error && (
            <div className="text-xs text-destructive">
              Failed to load companies. Please check if you are logged in.
            </div>
          )}
          {!isLoading && !error && (
            <SelectCustomer 
              companies={companies}
              onSelect={(customerId) => setSelectedCustomerId(customerId)}
            />
          )}
        </>
      )}
    </div>
  );
}

// Transform customer data to TipTap content
function transformCustomerToContent(customer: any): JSONContent {
  const lines = [
    customer.name,
    customer.address,
    [customer.city, customer.postalCode, customer.country].filter(Boolean).join(", "),
    customer.email,
    customer.phone,
    customer.vatNumber ? `VAT: ${customer.vatNumber}` : null,
  ].filter(Boolean);

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line as string }],
    })),
  };
}
