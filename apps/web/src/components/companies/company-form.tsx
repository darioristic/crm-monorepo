"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
import { createCompany, getCurrentCompany } from "@/lib/companies";
import { companiesApi } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { CountrySelector } from "./country-selector";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  industry: z.string().min(1, {
    message: "Industry is required.",
  }),
  address: z.string().min(1, {
    message: "Address is required.",
  }),
  email: z.string().email().optional().or(z.literal("")),
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

export interface CompanyData {
  id?: string;
  name: string;
  industry: string;
  address: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  contact?: string | null;
  vatNumber?: string | null;
  companyNumber?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  zip?: string | null;
  note?: string | null;
  logoUrl?: string | null;
}

type Props = {
  data?: CompanyData;
};

export function CompanyForm({ data }: Props) {
  const isEdit = !!data;
  const { setParams, name: prefillName } = useCompanyParams();
  const { refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Get current company data to use as defaults when creating new company
  const { data: currentCompany } = useQuery({
    queryKey: ["company", "current"],
    queryFn: async () => {
      const result = await getCurrentCompany();
      if (!result.success || !result.data) {
        return null;
      }
      return result.data;
    },
    enabled: !isEdit, // Only fetch when creating new company (not editing)
  });

  const createMutation = useMutation({
    mutationFn: async (values: CompanyData) => {
      // Generate logo from initials if no logo provided
      const { generateLogoFromInitials } = await import("@/lib/logo-generator");
      const logoUrl = values.logoUrl || generateLogoFromInitials(values.name);

      // Create company - backend should automatically add user as owner member
      // and switch if switchCompany: true is passed
      const result = await createCompany({
        name: values.name,
        industry: values.industry || "Other",
        address: values.address,
        email: values.email || undefined,
        phone: values.phone || null,
        website: values.website || null,
        contact: values.contact || null,
        city: values.city || null,
        zip: values.zip || null,
        country: values.country || null,
        countryCode: values.countryCode || null,
        vatNumber: values.vatNumber || null,
        companyNumber: values.companyNumber || null,
        note: values.note || null,
        logoUrl: logoUrl, // Use generated logo or provided one
        switchCompany: true, // Automatically switch to the new company (multi-tenant)
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create company");
      }
      return result.data;
    },
    onSuccess: async (newCompany) => {
      if (newCompany?.id) {
        // Backend should have already switched if switchCompany: true was passed
        // Invalidate all queries to refresh data, including companies list
        await queryClient.invalidateQueries({ queryKey: ["companies"] });
        await queryClient.invalidateQueries({ queryKey: ["team", "current"] });
        await queryClient.invalidateQueries({ queryKey: ["company", "current"] });
        // Refresh user data to get new companyId
        await refreshUser();
        // Close the sheet
        setParams(null);
        // Show success message
        toast.success("Company created and switched successfully");
        // Refresh the page to ensure all data is fresh
        router.refresh();
      } else {
        // Fallback if no company ID
        setParams(null);
        router.refresh();
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create company");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CompanyData) => {
      const result = await companiesApi.update(data?.id || "", values);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update company");
      }
      return result.data;
    },
    onSuccess: () => {
      setParams(null);
      toast.success("Company updated successfully");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update company");
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: data?.id,
      // Use prefillName, then data, then current company name, then empty
      name: prefillName ?? data?.name ?? currentCompany?.name ?? "",
      // Use data, then current company industry, then empty
      industry: data?.industry ?? currentCompany?.industry ?? "",
      // Use data, then current company address, then empty
      address: data?.address ?? currentCompany?.address ?? "",
      // Use data, then current company email, then empty
      email: data?.email ?? currentCompany?.email ?? "",
      // Use data, then current company phone, then empty
      phone: data?.phone ?? currentCompany?.phone ?? "",
      // Use data, then current company website, then empty
      website: data?.website ?? currentCompany?.website ?? "",
      // Use data, then current company contact, then empty
      contact: data?.contact ?? currentCompany?.contact ?? "",
      // Use data, then current company vatNumber, then empty
      vatNumber: data?.vatNumber ?? currentCompany?.vatNumber ?? "",
      // Use data, then current company companyNumber, then empty
      companyNumber: data?.companyNumber ?? currentCompany?.companyNumber ?? "",
      // Use data, then current company city, then empty
      city: data?.city ?? currentCompany?.city ?? "",
      // Use data, then current company country, then empty
      country: data?.country ?? currentCompany?.country ?? "",
      // Use data, then current company countryCode, then empty
      countryCode: data?.countryCode ?? currentCompany?.countryCode ?? "",
      // Use data, then current company zip, then empty
      zip: data?.zip ?? currentCompany?.zip ?? "",
      // Use data, then current company note, then empty
      note: data?.note ?? currentCompany?.note ?? "",
      // Use data, then current company logoUrl, then empty
      logoUrl: data?.logoUrl ?? currentCompany?.logoUrl ?? "",
    },
  });

  // Update form values when currentCompany data is loaded (for create mode)
  useEffect(() => {
    if (!isEdit && currentCompany) {
      form.reset({
        name: prefillName ?? currentCompany.name ?? "",
        industry: currentCompany.industry ?? "",
        address: currentCompany.address ?? "",
        email: currentCompany.email ?? "",
        phone: currentCompany.phone ?? "",
        website: currentCompany.website ?? "",
        contact: currentCompany.contact ?? "",
        vatNumber: currentCompany.vatNumber ?? "",
        companyNumber: currentCompany.companyNumber ?? "",
        city: currentCompany.city ?? "",
        country: currentCompany.country ?? "",
        countryCode: currentCompany.countryCode ?? "",
        zip: currentCompany.zip ?? "",
        note: currentCompany.note ?? "",
        logoUrl: currentCompany.logoUrl ?? "",
      });
    }
  }, [currentCompany, isEdit, prefillName, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const formattedData: CompanyData = {
      name: values.name,
      industry: values.industry || "Other",
      address: values.address,
      email: values.email || null,
      phone: values.phone || null,
      website: values.website || null,
      contact: values.contact || null,
      city: values.city || null,
      zip: values.zip || null,
      country: values.country || null,
      countryCode: values.countryCode || null,
      vatNumber: values.vatNumber || null,
      companyNumber: values.companyNumber || null,
      note: values.note || null,
      logoUrl: values.logoUrl || null,
    };

    if (isEdit) {
      updateMutation.mutate(formattedData);
    } else {
      // For create, use the mutation which handles switching automatically
      createMutation.mutate(formattedData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error 
    ? (createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error))
    : updateMutation.error
    ? (updateMutation.error instanceof Error ? updateMutation.error.message : String(updateMutation.error))
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
          <div>
            <Accordion
              type="multiple"
              defaultValue={["general", "details"]}
              className="space-y-6"
            >
              <AccordionItem value="general">
                <AccordionTrigger>General</AccordionTrigger>
                <AccordionContent>
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
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Industry *
                          </FormLabel>
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
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Email
                          </FormLabel>
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
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Phone
                          </FormLabel>
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
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="www.company.com"
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
                            Contact Person
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="John Doe"
                              autoComplete="off"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="details">
                <AccordionTrigger>Details</AccordionTrigger>

                <AccordionContent>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Address *
                          </FormLabel>
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
                            <FormLabel className="text-xs text-[#878787] font-normal">
                              City
                            </FormLabel>
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
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Country
                          </FormLabel>
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-[#878787] font-normal">
                              PIB / VAT Number
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="123456789"
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
                              Matični broj / Company Number
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
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-[#878787] font-normal">
                            Note
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              className="flex min-h-[80px] resize-none"
                              placeholder="Additional information..."
                              autoComplete="off"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background">
          <div className="flex justify-end mt-auto space-x-4">
            <Button
              variant="outline"
              onClick={() => setParams(null)}
              type="button"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isDirty}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
