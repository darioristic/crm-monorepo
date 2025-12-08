"use client";

import type { Company } from "@crm/types";
import type { JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Editor } from "@/components/invoice/editor";
import { SelectCustomer } from "@/components/shared/documents/select-customer";
import { useApi } from "@/hooks/use-api";
import { companiesApi, contactsApi } from "@/lib/api";
import { LabelInput } from "./label-input";

// Check if content has actual text
function hasContent(content: JSONContent | null | undefined): boolean {
  if (!content) return false;
  if (!content.content || !Array.isArray(content.content)) return false;

  // Check if any paragraph has text
  return content.content.some((node: JSONContent) => {
    if (!node.content || !Array.isArray(node.content)) return false;
    return node.content.some((inline: JSONContent) => inline.text && inline.text.trim().length > 0);
  });
}

export function CustomerDetails() {
  const { control, setValue, watch } = useFormContext();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"individual" | "organization" | null>(null);

  const content = watch("customerDetails");
  const id = watch("id");
  const currentCustomerId = watch("customerId");

  const {
    data: companiesData,
    isLoading,
    error,
    refetch,
  } = useApi(() => companiesApi.getAll({ pageSize: 100, source: "customer" }), {
    autoFetch: true,
  });
  const companies = companiesData || [];

  // Callback when a new company is created - refresh the list
  const handleCompanyCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  // Find selected customer
  const _customer =
    selectedType === "organization" && selectedCustomerId
      ? companies.find((c: Company) => c.id === selectedCustomerId)
      : null;

  const handleOnChange = (newContent?: JSONContent | null) => {
    // Reset the selected customer id when the content is changed
    setSelectedCustomerId(null);
    setSelectedType(null);

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
      setValue("companyId", "", { shouldValidate: true, shouldDirty: true });
      setValue("contactId", "", { shouldValidate: true, shouldDirty: true });
    }
  };

  useEffect(() => {
    async function applySelection() {
      if (!selectedCustomerId || !selectedType) return;
      if (selectedType === "organization") {
        let c = companies.find((x: Company) => x.id === selectedCustomerId);
        if (!c) {
          setValue("customerId", selectedCustomerId, {
            shouldValidate: true,
            shouldDirty: true,
          });
          setValue("companyId", selectedCustomerId, {
            shouldValidate: true,
            shouldDirty: true,
          });
          const res = await companiesApi.getById(selectedCustomerId);
          c = (res.success && (res.data as any)) || undefined;
        }
        if (!c) return;
        const customerContent = transformCustomerToContent(c);
        setSelectedCustomerId(null);
        setSelectedType(null);
        setValue("customerName", c.name, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("customerId", c.id, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("companyId", c.id, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("contactId", "", { shouldValidate: true, shouldDirty: true });
        setValue("customerDetails", customerContent, {
          shouldValidate: true,
          shouldDirty: true,
        });
      } else {
        const res = await contactsApi.getById(selectedCustomerId);
        const ct: any = res.success && res.data ? res.data : null;
        if (!ct) return;
        const lines = [
          `${ct.firstName} ${ct.lastName}`.trim(),
          ct.email,
          ct.phone,
          ct.jmbg ? `JMBG: ${ct.jmbg}` : undefined,
        ].filter(Boolean);
        const content = {
          type: "doc",
          content: lines.map((line: string) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          })),
        } as JSONContent;
        setSelectedCustomerId(null);
        setSelectedType(null);
        setValue("customerName", `${ct.firstName} ${ct.lastName}`.trim(), {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("customerId", ct.id, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("companyId", "", { shouldValidate: true, shouldDirty: true });
        setValue("contactId", ct.id, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("customerDetails", content, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
    applySelection();
  }, [selectedCustomerId, selectedType, companies, setValue]);

  // Check if we have actual content to show
  const contentHasText = hasContent(content);

  return (
    <div>
      <LabelInput name="template.customerLabel" className="mb-2 block" />
      {contentHasText ? (
        <>
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
          {!isLoading && !error && (!currentCustomerId || !String(currentCustomerId).trim()) && (
            <div className="mt-2">
              <SelectCustomer
                companies={companies}
                onSelect={(type, id) => {
                  setSelectedType(type);
                  setSelectedCustomerId(id);
                }}
                onCompanyCreated={handleCompanyCreated}
              />
            </div>
          )}
        </>
      ) : (
        <>
          {isLoading && <div className="text-xs text-muted-foreground">Loading companies...</div>}
          {error && (
            <div className="text-xs text-destructive">
              Failed to load companies. Please check if you are logged in.
            </div>
          )}
          {!isLoading && !error && (
            <SelectCustomer
              companies={companies}
              onSelect={(type, id) => {
                setSelectedType(type);
                setSelectedCustomerId(id);
              }}
              onCompanyCreated={handleCompanyCreated}
            />
          )}
        </>
      )}
    </div>
  );
}

// Transform customer data to TipTap content
function transformCustomerToContent(customer: Company): JSONContent {
  const street = (customer as any).addressLine1 || customer.address || null;
  const postal = (customer as any).postalCode || customer.zip;
  const zipCity = [postal, customer.city].filter(Boolean).join(" ");
  const addressLine = [street, zipCity].filter(Boolean).join(", ");
  const country = customer.country || null;
  const email = (customer as any).billingEmail || customer.email || null;
  const pib = customer.vatNumber ? `PIB: ${customer.vatNumber}` : null;
  const mbSource = (customer as any).companyNumber || (customer as any).registrationNumber;
  const mb = mbSource ? `MB: ${String(mbSource)}` : null;

  const lines = [customer.name, addressLine, country, email, pib, mb].filter(Boolean);

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line as string }],
    })),
  };
}
