"use client";

import type { CustomerOrganization } from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Globe, Loader2, Search } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { useMutation } from "@/hooks/use-api";
import { companiesApi, organizationsApi } from "@/lib/api";

const formSchema = z
  .object({
    name: z.string().min(2, {
      message: "Name must be at least 2 characters.",
    }),
    industry: z.string().optional().default("Other"),
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
  onSuccess: (companyId: string) => void;
  onCancel: () => void;
};

export function CreateCompanyInlineForm({ prefillName, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [_detectedDomain, setDetectedDomain] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const createMutation = useMutation<any, any>((values) =>
    companiesApi.create({
      ...values,
      source: "customer",
    })
  );

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: prefillName ?? "",
      industry: "Other",
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

  const [addrSuggestions, setAddrSuggestions] = useState<
    Array<
      Pick<
        CustomerOrganization,
        "id" | "name" | "addressLine1" | "city" | "zip" | "state" | "country" | "countryCode"
      >
    >
  >([]);
  const [showAddrSuggestions, setShowAddrSuggestions] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrDebounceRef = useRef<number | null>(null);

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
    // Generate logo from initials if no logo provided
    const { generateLogoFromInitials } = await import("@/lib/logo-generator");
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
      source: "customer" as const, // Mark as customer company (not shown in /dashboard/companies)
    };

    const result = await createMutation.mutate(formattedData);

    if (result.success && result.data) {
      try {
        await organizationsApi.create({
          id: result.data.id,
          name: values.name,
          email: values.email || undefined,
          phone: values.phone || undefined,
          pib: values.vatNumber || undefined,
          companyNumber: values.companyNumber || undefined,
          contactPerson: values.contact || undefined,
          addressLine1: values.address || undefined,
          city: values.city || undefined,
          zip: values.zip || undefined,
          country: values.country || undefined,
          countryCode: values.countryCode || undefined,
          note: values.note || undefined,
          isFavorite: false,
        });
      } catch {}
      try {
        await queryClient.invalidateQueries({ queryKey: ["companies"] });
      } catch {}
      try {
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      } catch {}
      try {
        if (typeof window !== "undefined") {
          window.localStorage?.setItem("lastCreatedCompanyId", String(result.data.id));
        }
      } catch {}
      onSuccess(result.data.id);
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
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-[#878787] font-normal">
                          Industry
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
                          <div className="relative">
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="123 Main Street"
                              autoComplete="off"
                              onFocus={() => setShowAddrSuggestions(true)}
                              onBlur={() => {
                                setTimeout(() => setShowAddrSuggestions(false), 150);
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v);
                                if (addrDebounceRef.current) {
                                  window.clearTimeout(addrDebounceRef.current);
                                  addrDebounceRef.current = null;
                                }
                                addrDebounceRef.current = window.setTimeout(async () => {
                                  if (!v || v.trim().length < 2) {
                                    setAddrSuggestions([]);
                                    setAddrLoading(false);
                                    setShowAddrSuggestions(false);
                                    return;
                                  }
                                  try {
                                    setAddrLoading(true);
                                    setShowAddrSuggestions(true);
                                    const res = await organizationsApi.getAll({
                                      search: v,
                                      page: 1,
                                      pageSize: 5,
                                    });
                                    if (res.success && Array.isArray(res.data)) {
                                      const items = (res.data as CustomerOrganization[])
                                        .map((o) => ({
                                          id: o.id,
                                          name: o.name,
                                          addressLine1: o.addressLine1 || "",
                                          city: o.city || "",
                                          zip: o.zip || "",
                                          state: o.state || "",
                                          country: o.country || "",
                                          countryCode: o.countryCode || "",
                                        }))
                                        .filter((i) => i.addressLine1);
                                      if (form.getValues("address") === v) {
                                        setAddrSuggestions(items);
                                        setShowAddrSuggestions(items.length > 0);
                                      }
                                    }
                                  } catch {
                                  } finally {
                                    setAddrLoading(false);
                                  }
                                }, 250);
                              }}
                            />
                            {showAddrSuggestions && (addrLoading || addrSuggestions.length > 0) && (
                              <div className="absolute z-50 mt-1 bg-background border shadow-md max-h-48 overflow-y-auto left-0 right-0 rounded-md">
                                {addrLoading ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">
                                    Searching addresses...
                                  </div>
                                ) : (
                                  addrSuggestions.map((s) => (
                                    <button
                                      key={`${s.id}-${s.addressLine1}`}
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60"
                                      onMouseDown={(ev) => {
                                        ev.preventDefault();
                                        form.setValue("address", s.addressLine1 || "", {
                                          shouldDirty: true,
                                          shouldValidate: true,
                                        });
                                        if (s.city)
                                          form.setValue("city", s.city, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        if (s.zip)
                                          form.setValue("zip", s.zip, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        if (s.country)
                                          form.setValue("country", s.country, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        if (s.countryCode)
                                          form.setValue("countryCode", s.countryCode, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        setShowAddrSuggestions(false);
                                      }}
                                    >
                                      <div className="font-medium truncate">{s.addressLine1}</div>
                                      <div className="text-muted-foreground truncate">
                                        {[s.city, s.state, s.zip, s.country]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
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

        {/* Fixed footer with buttons */}
        <div className="flex-shrink-0 pt-4 mt-4 border-t bg-background">
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
