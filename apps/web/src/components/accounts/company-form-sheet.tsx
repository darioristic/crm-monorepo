"use client";

import type { CustomerOrganization } from "@crm/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { organizationsApi } from "@/lib/api";

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

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z
    .string()
    .optional()
    .transform((url) => url?.replace(/^https?:\/\//, "")),
  pib: z.string().optional(),
  companyNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  zip: z.string().optional(),
  note: z.string().optional(),
  tags: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  onSaved?: () => void;
};

export function CompanyFormSheet({ open, onOpenChange, companyId, onSaved }: Props) {
  const [tagInput, setTagInput] = useState("");
  const isEdit = !!companyId;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      website: "",
      pib: "",
      companyNumber: "",
      contactPerson: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "",
      countryCode: "",
      zip: "",
      note: "",
      tags: [],
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

  useEffect(() => {
    async function load() {
      if (!companyId) {
        form.reset({
          name: "",
          email: "",
          phone: "",
          website: "",
          pib: "",
          companyNumber: "",
          contactPerson: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          country: "",
          countryCode: "",
          zip: "",
          note: "",
          tags: [],
        });
        return;
      }
      const res = await organizationsApi.getById(companyId);
      if (res.success && res.data) {
        const org = res.data as CustomerOrganization;
        form.reset({
          name: org.name,
          email: org.email || "",
          phone: org.phone || "",
          website: org.website || "",
          pib: org.pib || "",
          companyNumber: org.companyNumber || "",
          contactPerson: org.contactPerson || "",
          addressLine1: org.addressLine1 || "",
          addressLine2: org.addressLine2 || "",
          city: org.city || "",
          state: org.state || "",
          country: org.country || "",
          countryCode: org.countryCode || "",
          zip: org.zip || "",
          note: org.note || "",
          tags: org.tags || [],
        });
      }
    }
    if (open) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, open]);

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

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    const currentTags = form.getValues("tags") || [];
    if (currentTags.some((t) => t.name.toLowerCase() === value.toLowerCase())) return;
    form.setValue("tags", [...currentTags, { id: crypto.randomUUID(), name: value }], {
      shouldDirty: true,
    });
    setTagInput("");
  };

  const removeTag = (id: string) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue(
      "tags",
      currentTags.filter((t) => t.id !== id),
      { shouldDirty: true }
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        email: data.email || "",
        phone: data.phone || "",
        website: data.website || "",
        pib: data.pib || "",
        companyNumber: data.companyNumber || "",
        contactPerson: data.contactPerson || "",
        addressLine1: data.addressLine1 || "",
        addressLine2: data.addressLine2 || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "",
        countryCode: data.countryCode || "",
        zip: data.zip || "",
        note: data.note || "",
        tags: data.tags || [],
      };

      if (companyId) {
        const res = await organizationsApi.update(companyId, payload);
        if (res.success) {
          onSaved?.();
          onOpenChange(false);
        } else {
          console.error("Failed to update organization:", res);
        }
      } else {
        const res = await organizationsApi.create({
          id: crypto.randomUUID(),
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        if (res.success) {
          onSaved?.();
          onOpenChange(false);
        } else {
          console.error("Failed to create organization:", res);
        }
      }
    } catch (error) {
      console.error("Error submitting organization:", error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-lg font-medium">
            {isEdit ? "Edit Organization" : "Add Organization"}
          </SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col h-[calc(100vh-120px)]"
          >
            <div className="flex-1 overflow-y-auto pr-2">
              <Accordion
                type="multiple"
                defaultValue={["general", "details"]}
                className="space-y-4"
              >
                <AccordionItem value="general" className="border-none">
                  <AccordionTrigger className="text-sm font-medium py-2">General</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Name *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
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
                            <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="info@example.com"
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
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="tel"
                                placeholder="+381 11 123 4567"
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
                            <FormLabel className="text-xs text-muted-foreground">Website</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="example.com" autoComplete="off" />
                            </FormControl>
                            <FormDescription>
                              Used to fetch company logo automatically
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Contact Person
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Marko Marković" autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger className="text-sm font-medium py-2">Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Address Line 1
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  placeholder="Bulevar oslobođenja 123"
                                  autoComplete="off"
                                  onFocus={() => setShowAddrSuggestions(true)}
                                  onBlur={() => {
                                    // delay hiding to allow click selection
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
                                          // Only update suggestions if input hasn't changed
                                          if (form.getValues("addressLine1") === v) {
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
                                {showAddrSuggestions &&
                                  (addrLoading || addrSuggestions.length > 0) && (
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
                                              form.setValue("addressLine1", s.addressLine1 || "", {
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
                                              if (s.state)
                                                form.setValue("state", s.state, {
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
                                            <div className="font-medium truncate">
                                              {s.addressLine1}
                                            </div>
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

                      <FormField
                        control={form.control}
                        name="addressLine2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              Address Line 2
                            </FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Sprat 5, Stan 10" autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Beograd" autoComplete="off" />
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
                                <Input {...field} placeholder="11000" autoComplete="off" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                State / Region
                              </FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Grad Beograd" autoComplete="off" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                Country
                              </FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Srbija" autoComplete="off" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="pib"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                PIB / VAT Number
                              </FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="123456789" autoComplete="off" />
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
                              <FormLabel className="text-xs text-muted-foreground">
                                Matični broj
                              </FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="12345678" autoComplete="off" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormLabel className="text-xs text-muted-foreground mb-2 block">
                          Tags
                        </FormLabel>
                        <div className="flex gap-2 mb-2">
                          <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            placeholder="Add a tag..."
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag();
                              }
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={addTag}>
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(form.watch("tags") || []).map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                              {tag.name}
                              <button
                                type="button"
                                onClick={() => removeTag(tag.id)}
                                className="ml-1 hover:bg-muted rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <FormDescription className="mt-2">
                          Tags help categorize and filter organizations
                        </FormDescription>
                      </div>

                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Note</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Additional information..."
                                className="min-h-[80px] resize-none"
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
            <div className="flex-shrink-0 pt-4 mt-4 border-t bg-background">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">{isEdit ? "Update" : "Create"}</Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
