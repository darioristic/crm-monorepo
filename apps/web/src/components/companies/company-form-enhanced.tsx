"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { useMutation, useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { CountrySelector } from "./country-selector";
import { VatNumberInput } from "./vat-number-input";

// Industry options
const industries = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Transportation",
  "Energy",
  "Media",
  "Telecommunications",
  "Agriculture",
  "Construction",
  "Hospitality",
  "Other",
];

// Common email domains to exclude for auto-website
const excludedDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "google.com",
  "aol.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "live.com",
];

// Form validation schema
const companyFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Email is not valid"),
  billingEmail: z.string().email("Email is not valid").nullable().optional(),
  phone: z.string().optional(),
  website: z
    .string()
    .optional()
    .transform((url) => url?.replace(/^https?:\/\//, "")),
  contact: z.string().optional(),
  industry: z.string().min(1, "Please select an industry"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  zip: z.string().optional(),
  vatNumber: z.string().optional(),
  note: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

// Company type from API
export interface EnhancedCompany {
  id: string;
  name: string;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  website: string | null;
  contact: string | null;
  industry: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  countryCode: string | null;
  vatNumber: string | null;
  note: string | null;
}

interface CompanyFormEnhancedProps {
  data?: EnhancedCompany;
  onSuccess?: (company: EnhancedCompany) => void;
}

export function CompanyFormEnhanced({ data, onSuccess }: CompanyFormEnhancedProps) {
  const { setParams, name: prefilledName } = useCompanyParams();
  const isEdit = !!data;

  const createMutation = useMutation<EnhancedCompany, CompanyFormValues>((values) =>
    companiesApi.create(values as any)
  );

  const updateMutation = useMutation<EnhancedCompany, CompanyFormValues>((values) =>
    companiesApi.update(data?.id || "", values as any)
  );

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema) as any,
    defaultValues: {
      id: data?.id,
      name: prefilledName || data?.name || "",
      email: data?.email || "",
      billingEmail: data?.billingEmail || null,
      phone: data?.phone || "",
      website: data?.website || "",
      contact: data?.contact || "",
      industry: data?.industry || "",
      addressLine1: data?.addressLine1 || "",
      addressLine2: data?.addressLine2 || "",
      city: data?.city || "",
      state: data?.state || "",
      country: data?.country || "",
      countryCode: data?.countryCode || "",
      zip: data?.zip || "",
      vatNumber: data?.vatNumber || "",
      note: data?.note || "",
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        id: data.id,
        name: data.name,
        email: data.email || "",
        billingEmail: data.billingEmail,
        phone: data.phone || "",
        website: data.website || "",
        contact: data.contact || "",
        industry: data.industry,
        addressLine1: data.addressLine1 || "",
        addressLine2: data.addressLine2 || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "",
        countryCode: data.countryCode || "",
        zip: data.zip || "",
        vatNumber: data.vatNumber || "",
        note: data.note || "",
      });
    }
  }, [data, form]);

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const email = e.target.value.trim();
    const domain = email.split("@").at(1);
    if (domain && !excludedDomains.includes(domain)) {
      const currentWebsite = form.getValues("website");
      if (!currentWebsite) {
        form.setValue("website", domain, { shouldValidate: true });
      }
    }
  };

  const onSubmit = async (values: CompanyFormValues) => {
    const formattedData = {
      ...values,
      id: values.id || undefined,
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      billingEmail: values.billingEmail || null,
      city: values.city || null,
      state: values.state || null,
      country: values.country || null,
      contact: values.contact || null,
      note: values.note || null,
      website: values.website || null,
      phone: values.phone || null,
      zip: values.zip || null,
      vatNumber: values.vatNumber || null,
      countryCode: values.countryCode || null,
    };

    let result;
    if (isEdit) {
      result = await updateMutation.mutate(formattedData);
    } else {
      result = await createMutation.mutate(formattedData);
    }

    if (result.success && result.data) {
      setParams(null);
      onSuccess?.(result.data);
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="h-[calc(100vh-200px)] overflow-auto pr-1">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Accordion
            type="multiple"
            defaultValue={["general", "details"]}
            className="space-y-4"
          >
            <AccordionItem value="general" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">
                General Information
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Company Name *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Acme Inc"
                          autoComplete="off"
                          autoFocus
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
                      <FormLabel className="text-xs text-muted-foreground">
                        Email *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="info@acme.com"
                          type="email"
                          autoComplete="off"
                          onBlur={handleEmailBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billingEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Billing Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            field.onChange(
                              e.target.value.trim().length > 0
                                ? e.target.value.trim()
                                : null
                            );
                          }}
                          placeholder="finance@acme.com"
                          type="email"
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormDescription>
                        Used for sending invoices if different from main email.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="+1 (555) 123-4567"
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
                      <FormLabel className="text-xs text-muted-foreground">
                        Website
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="acme.com"
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
                      <FormLabel className="text-xs text-muted-foreground">
                        Contact Person
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="John Doe"
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
                      <FormLabel className="text-xs text-muted-foreground">
                        Industry *
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {industries.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="details" className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium">
                Address & Details
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Address Line 1
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="123 Main St"
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Address Line 2
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Suite 100"
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
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          Country
                        </FormLabel>
                        <FormControl>
                          <CountrySelector
                            defaultValue={field.value || ""}
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
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          City
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="New York"
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          State / Province
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="NY"
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
                        <FormLabel className="text-xs text-muted-foreground">
                          ZIP / Postal Code
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="10001"
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
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Tax ID / VAT Number
                      </FormLabel>
                      <FormControl>
                        <VatNumberInput
                          value={field.value || ""}
                          onChange={field.onChange}
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
                      <FormLabel className="text-xs text-muted-foreground">
                        Notes
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          className="min-h-[80px] resize-none"
                          placeholder="Additional information about this company..."
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="pt-4 border-t mt-4">
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParams(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update Company" : "Create Company"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

