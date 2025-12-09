"use client";

import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Globe, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CountrySelector } from "@/components/companies/country-selector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@/hooks/use-api";
import { companiesApi, organizationsApi } from "@/lib/api";
import { generateLogoFromInitials } from "@/lib/logo-generator";

const formSchema = z
  .object({
    name: z.string().min(2, {
      message: "Name must be at least 2 characters.",
    }),
    industry: z.string().optional().default("Other"),
    primaryRole: z
      .enum(["customer", "partner", "vendor", "supplier", "prospect"])
      .optional()
      .default("customer"),
    address: z.string().optional().default(""),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().optional(),
    contact: z.string().optional().default(""),
    vatNumber: z.string().optional().default(""),
    companyNumber: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    countryCode: z.string().optional(),
    zip: z.string().optional(),
    note: z.string().optional(),
    logoUrl: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasEmail = !!(data.email && String(data.email).trim().length > 0);
      const hasPhone = !!(data.phone && String(data.phone).trim().length > 0);
      return hasEmail || hasPhone;
    },
    {
      message: "At least one contact method (email or phone) is required.",
      path: ["email"],
    }
  );

// Extract domain from email or website
function extractDomain(input: string): string | null {
  if (!input) return null;

  // If it's an email, extract the domain part
  if (input.includes("@")) {
    const parts = input.split("@");
    return parts[1]?.toLowerCase() || null;
  }

  // If it's a URL, extract the domain
  try {
    let url = input;
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "").toLowerCase();
  } catch {
    // Maybe it's just a domain
    return input.replace("www.", "").toLowerCase();
  }
}

// Get logo URL from Clearbit (free, no API key needed)
function getLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

type Props = {
  prefillName?: string;
  initialValues?: Partial<z.infer<typeof formSchema>>;
  companyId?: string;
  mode?: "create" | "edit";
  onSuccess: (companyId: string) => void;
  onCancel: () => void;
};

export function CreateCompanyInlineForm({
  prefillName,
  initialValues,
  companyId,
  mode = "create",
  onSuccess,
  onCancel,
}: Props) {
  const queryClient = useQueryClient();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [_detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const createMutation = useMutation<Company, CreateCompanyRequest | UpdateCompanyRequest>(
    (values) =>
      mode === "edit" && companyId
        ? companiesApi.update(companyId, values as UpdateCompanyRequest)
        : companiesApi.create({
            ...(values as CreateCompanyRequest),
            source: "customer",
          })
  );

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: prefillName ?? "",
      industry: "Other",
      primaryRole: "customer",
      address: "",
      email: "",
      phone: "",
      website: "",
      contact: "",
      vatNumber: "",
      companyNumber: "",
      city: "",
      country: "",
      countryCode: "",
      zip: "",
      note: "",
      logoUrl: "",
    },
  });

  // Merge provided initial values into the form defaults
  useEffect(() => {
    if (initialValues) {
      form.reset({
        name: initialValues.name ?? "",
        industry: initialValues.industry ?? "Other",
        primaryRole: initialValues.primaryRole ?? "customer",
        address: initialValues.address ?? "",
        email: initialValues.email ?? "",
        phone: initialValues.phone ?? "",
        website: initialValues.website ?? "",
        contact: initialValues.contact ?? "",
        vatNumber: initialValues.vatNumber ?? "",
        companyNumber: initialValues.companyNumber ?? "",
        city: initialValues.city ?? "",
        country: initialValues.country ?? "",
        countryCode: initialValues.countryCode ?? "",
        zip: initialValues.zip ?? "",
        note: initialValues.note ?? "",
        logoUrl: initialValues.logoUrl ?? "",
      });
    }
  }, [initialValues, form]);

  // Handle domain detection from email or website
  const handleDomainDetection = useCallback(
    (value: string, field: "email" | "website") => {
      const domain = extractDomain(value);
      if (domain) {
        // Always update if domain is detected (allow re-detection)
        setDetectedDomain(domain);
        setLogoError(false);

        // Auto-fill website if it's from email
        if (field === "email" && !form.getValues("website")) {
          form.setValue("website", `https://${domain}`);
        }

        // Set logo URL
        const logoUrl = getLogoUrl(domain);
        form.setValue("logoUrl", logoUrl);
      } else {
        // Clear logo if no domain detected
        setDetectedDomain(null);
        form.setValue("logoUrl", "");
      }
    },
    [form]
  );

  // Lookup company data (placeholder - can be expanded with real API)
  const handleLookup = useCallback(async () => {
    const email = form.getValues("email");
    const website = form.getValues("website");
    const domain = extractDomain(email || website || "");

    if (!domain) {
      toast.error("Unesite email ili website da biste pretražili kompaniju");
      return;
    }

    setIsLookingUp(true);
    setDetectedDomain(domain);
    setLogoError(false);

    try {
      // Set logo URL from Clearbit (free)
      const logoUrl = getLogoUrl(domain);
      form.setValue("logoUrl", logoUrl);

      // Auto-fill website if not set
      if (!form.getValues("website")) {
        form.setValue("website", `https://${domain}`);
      }

      toast.success(`Logo pronađen za ${domain}`);
    } catch (_error) {
      toast.error("Nije moguće pronaći podatke o kompaniji");
    } finally {
      setIsLookingUp(false);
    }
  }, [form]);

  const handleSubmit = async (values: z.input<typeof formSchema>) => {
    const logoUrl = values.logoUrl || generateLogoFromInitials(values.name);

    const formattedData = {
      name: values.name,
      industry: values.industry || "Other",
      address: values.address || "",
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
      logoUrl: logoUrl, // Use generated logo or provided one
      ...(mode === "create" ? { source: "customer" as const } : {}),
    };

    const result = await createMutation.mutate(formattedData);

    if (result.success && (result.data || companyId)) {
      try {
        if (mode === "create" && result.data) {
          await organizationsApi.create({
            id: result.data.id,
            name: values.name,
            email: values.email || undefined,
            phone: values.phone || undefined,
            pib: values.vatNumber || undefined,
            companyNumber: values.companyNumber || undefined,
            contactPerson: values.contact || undefined,
            isFavorite: false,
            roles: values.primaryRole ? [values.primaryRole] : undefined,
          });
        } else if (mode === "edit" && companyId) {
          try {
            await organizationsApi.update(companyId, {
              name: values.name,
              email: values.email || undefined,
              phone: values.phone || undefined,
              pib: values.vatNumber || undefined,
              companyNumber: values.companyNumber || undefined,
              contactPerson: values.contact || undefined,
            } as any);
          } catch {}
        }
      } catch {}
      try {
        await queryClient.invalidateQueries({ queryKey: ["companies"] });
      } catch {}
      try {
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      } catch {}
      try {
        if (typeof window !== "undefined") {
          const idToStore = (mode === "create" && result.data?.id) || companyId;
          if (idToStore) {
            window.localStorage?.setItem("lastCreatedCompanyId", String(idToStore));
          }
        }
      } catch {}
      onSuccess((mode === "create" ? result.data.id : companyId!) as string);
    } else {
      toast.error(String((result as any)?.error || "Failed to create company"));
    }
  };

  const isSubmitting = createMutation.isLoading;
  const error = createMutation.error;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col h-[calc(100vh-120px)]"
      >
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          <Accordion type="multiple" defaultValue={["general", "details"]} className="space-y-4">
            <AccordionItem value="general" className="border-none">
              <AccordionTrigger className="text-sm font-medium py-2">General</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Logo preview and company name */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {form.watch("logoUrl") && !logoError ? (
                        <Avatar className="h-16 w-16 rounded-lg border">
                          <AvatarImage
                            src={form.watch("logoUrl") || ""}
                            alt="Company logo"
                            onError={() => {
                              setLogoError(true);
                              // Clear logoUrl if it fails to load
                              form.setValue("logoUrl", "");
                            }}
                          />
                          <AvatarFallback className="rounded-lg text-lg">
                            {form.watch("name")?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                          <Globe className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
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
                    </div>
                  </div>

                  {/* Email with lookup button */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-[#878787] font-normal">
                          Email (unesite za automatsko preuzimanje loga)
                        </FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="contact@company.com"
                              type="email"
                              autoComplete="off"
                              onChange={(e) => {
                                field.onChange(e);
                                handleDomainDetection(e.target.value, "email");
                              }}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleLookup}
                            disabled={isLookingUp}
                            title="Pretraži kompaniju"
                          >
                            {isLookingUp ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
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

                  {/* Website */}
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
                            onChange={(e) => {
                              field.onChange(e);
                              handleDomainDetection(e.target.value, "website");
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-[#878787] font-normal">Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="supplier">Supplier</SelectItem>
                            <SelectItem value="prospect">Prospect</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="text-sm font-medium py-2">
                Address & Details
              </AccordionTrigger>
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
                            placeholder="123 Main Street"
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
                            ZIP Code
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
                            Matični broj
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Footer with safe-area padding */}
        <div className="flex-shrink-0 pt-4 pb-4 mt-4 border-t bg-background [padding-bottom:env(safe-area-inset-bottom)]">
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Select
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
