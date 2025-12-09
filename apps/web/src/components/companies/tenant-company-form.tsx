"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type TenantCompany, tenantAdminApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { CountrySelector } from "./country-selector";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  industry: z.string().optional().or(z.literal("")),
  address: z.string().min(1, {
    message: "Address is required.",
  }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().optional(),
  website: z.string().optional(),
  contact: z.string().optional(),
  vatNumber: z.string().optional(),
  companyNumber: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  zip: z.string().optional(),
  note: z.string().optional(),
  logoUrl: z.string().optional(),
});

type Props = {
  company?: TenantCompany;
  onSuccess?: () => void;
};

export function TenantCompanyForm({ company, onSuccess }: Props) {
  const isEdit = !!company;
  const queryClient = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const _API_URL =
    typeof window === "undefined" ? process.env.API_URL || "http://localhost:3001" : "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company?.name || "",
      industry: company?.industry || "",
      address: company?.address || "",
      email: company?.email || "",
      phone: company?.phone || "",
      website: company?.website || "",
      contact: company?.contact || "",
      vatNumber: company?.vatNumber || "",
      companyNumber: company?.companyNumber || "",
      city: company?.city || "",
      country: company?.country || "",
      countryCode: company?.countryCode || "",
      zip: company?.zip || "",
      note: company?.note || "",
      logoUrl: company?.logoUrl || "",
    },
  });

  function generateInitialsLogo(name: string) {
    const initials = (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || "")
      .join("");
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="100%" height="100%" fill="#000"/><text x="50%" y="55%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="56" fill="#fff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // First create company without logo, then upload if file provided
      const result = await tenantAdminApi.companies.create({
        name: values.name,
        industry: values.industry || "Other",
        address: values.address,
        email: values.email,
        phone: values.phone || undefined,
        website: values.website || undefined,
        contact: values.contact || undefined,
        city: values.city || undefined,
        zip: values.zip || undefined,
        country: values.country || undefined,
        countryCode: values.countryCode || undefined,
        vatNumber: values.vatNumber || undefined,
        companyNumber: values.companyNumber || undefined,
        note: values.note || undefined,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create company");
      }

      const created = result.data as TenantCompany;
      try {
        if (logoFile) {
          await uploadCompanyLogo(created.id, logoFile);
        } else {
          const initialsLogo = generateInitialsLogo(values.name);
          await tenantAdminApi.companies.update(created.id, {
            logoUrl: initialsLogo,
          });
        }
      } catch (e) {
        // If logo upload fails, company still exists; surface error but continue
        logger.error("Logo upload failed", e);
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tenant-admin", "companies"],
      });
      toast.success("Company created successfully");
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create company");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!company) throw new Error("Company ID is required");
      // Update fields
      const result = await tenantAdminApi.companies.update(company.id, {
        name: values.name,
        industry: values.industry || "Other",
        address: values.address,
        email: values.email,
        phone: values.phone || undefined,
        website: values.website || undefined,
        contact: values.contact || undefined,
        city: values.city || undefined,
        zip: values.zip || undefined,
        country: values.country || undefined,
        countryCode: values.countryCode || undefined,
        vatNumber: values.vatNumber || undefined,
        companyNumber: values.companyNumber || undefined,
        note: values.note || undefined,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update company");
      }

      // Handle logo file upload or fallback
      if (logoFile) {
        await uploadCompanyLogo(company.id, logoFile);
      } else if (!values.logoUrl || values.logoUrl.trim() === "") {
        const initialsLogo = generateInitialsLogo(values.name);
        await tenantAdminApi.companies.update(company.id, {
          logoUrl: initialsLogo,
        });
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tenant-admin", "companies"],
      });
      toast.success("Company updated successfully");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update company");
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error
    ? createMutation.error instanceof Error
      ? createMutation.error.message
      : String(createMutation.error)
    : updateMutation.error
      ? updateMutation.error instanceof Error
        ? updateMutation.error.message
        : String(updateMutation.error)
      : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="h-[calc(100vh-180px)] scrollbar-hide overflow-auto">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">
                    Company Name *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      autoFocus
                      placeholder="Acme Inc"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Industry</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Technology, Healthcare, Finance..."
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Address *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="123 Main Street, Suite 100"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">City</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Belgrade"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">
                      ZIP / Postal Code
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="11000"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Country</FormLabel>
                  <FormControl>
                    <CountrySelector
                      defaultValue={field.value ?? ""}
                      onSelect={(code, name) => {
                        field.onChange(name);
                        form.setValue("countryCode", code);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Email *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="contact@company.com"
                      type="email"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Phone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="+381 11 123 4567"
                      type="tel"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Website</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="https://example.com"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">
                    Primary Contact
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Jane Doe"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">VAT Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="RS123456789"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">
                      Company Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="12345678"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Logo</FormLabel>
                  <FormControl>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Note</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Internal notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background">
          <div className="flex justify-end mt-auto space-x-4">
            <Button variant="outline" onClick={() => onSuccess?.()} type="button">
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/v1/companies/${companyId}/logo`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to upload logo");
  }

  const result = await response.json();
  if (!result.success || !result.data?.logoUrl) {
    throw new Error(result.error?.message || "Failed to upload logo");
  }

  return result.data.logoUrl as string;
}
