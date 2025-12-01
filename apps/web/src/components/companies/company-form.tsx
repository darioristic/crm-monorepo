"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
}

type Props = {
  data?: CompanyData;
};

export function CompanyForm({ data }: Props) {
  const isEdit = !!data;
  const { setParams, name: prefillName } = useCompanyParams();

  const createMutation = useMutation<CompanyData, any>((values) =>
    companiesApi.create(values)
  );

  const updateMutation = useMutation<CompanyData, any>((values) =>
    companiesApi.update(data?.id || "", values)
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: data?.id,
      name: prefillName ?? data?.name ?? "",
      industry: data?.industry ?? "",
      address: data?.address ?? "",
      email: data?.email ?? "",
      phone: data?.phone ?? "",
      website: data?.website ?? "",
      contact: data?.contact ?? "",
      vatNumber: data?.vatNumber ?? "",
      companyNumber: data?.companyNumber ?? "",
      city: data?.city ?? "",
      country: data?.country ?? "",
      countryCode: data?.countryCode ?? "",
      zip: data?.zip ?? "",
      note: data?.note ?? "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const formattedData = {
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
    };

    let result;
    if (isEdit) {
      result = await updateMutation.mutate(formattedData);
    } else {
      result = await createMutation.mutate(formattedData);
    }

    if (result.success) {
      setParams(null);
      window.location.reload();
    }
  };

  const isSubmitting = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

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
