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
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  const content = watch("customerDetails");
  const id = watch("id");
  const existingCustomerId = watch("customerId");
  const existingCustomerName = watch("customerName");

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
          c = (res.success && res.data) || undefined;
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
        const ct = res.success && res.data ? res.data : null;
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

  // Effect to load customer data when editing and customerDetails is missing
  useEffect(() => {
    async function loadExistingCustomer() {
      // Only run if we have customerId but no content (editing scenario)
      if (!existingCustomerId || contentHasText || isLoadingCustomer) return;

      setIsLoadingCustomer(true);
      try {
        const res = await companiesApi.getById(existingCustomerId);
        if (res.success && res.data) {
          const c = res.data as Company;
          const customerContent = transformCustomerToContent(c);
          setValue("customerDetails", customerContent, {
            shouldValidate: true,
            shouldDirty: false, // Don't mark as dirty since we're just loading existing data
          });
          setValue("customerName", c.name, { shouldDirty: false });
        } else if (existingCustomerName) {
          // Fallback: if we can't load company but have name, create simple content
          const simpleContent: JSONContent = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: existingCustomerName }],
              },
            ],
          };
          setValue("customerDetails", simpleContent, { shouldDirty: false });
        }
      } catch (err) {
        console.error("Failed to load customer:", err);
        // Fallback to customer name if available
        if (existingCustomerName) {
          const simpleContent: JSONContent = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: existingCustomerName }],
              },
            ],
          };
          setValue("customerDetails", simpleContent, { shouldDirty: false });
        }
      } finally {
        setIsLoadingCustomer(false);
      }
    }
    loadExistingCustomer();
  }, [existingCustomerId, existingCustomerName, contentHasText, isLoadingCustomer, setValue]);

  return (
    <div>
      <LabelInput name="template.customerLabel" className="mb-2 block" />
      {isLoadingCustomer ? (
        <div className="text-xs text-muted-foreground">Loading customer...</div>
      ) : contentHasText ? (
        // If we have customer content, show the editor (no need to show dropdown again)
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
  const extCustomer = customer as Company & {
    addressLine1?: string;
    postalCode?: string;
    billingEmail?: string;
    companyNumber?: string;
    registrationNumber?: string;
  };
  const street = extCustomer.addressLine1 || customer.address || null;
  const postal = extCustomer.postalCode || customer.zip;
  const zipCity = [postal, customer.city].filter(Boolean).join(" ");
  const addressLine = [street, zipCity].filter(Boolean).join(", ");
  const country = customer.country || null;
  const email = extCustomer.billingEmail || customer.email || null;
  const pib = customer.vatNumber ? `PIB: ${customer.vatNumber}` : null;
  const mbSource = extCustomer.companyNumber || extCustomer.registrationNumber;
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
