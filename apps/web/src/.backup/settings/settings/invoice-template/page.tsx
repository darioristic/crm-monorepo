"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
import { logger } from '@/lib/logger';
  FileText,
  Save,
  Loader2,
  ImageIcon,
  Palette,
  Globe,
  DollarSign,
  Receipt,
} from "lucide-react";

const templateSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  title: z.string().min(1, "Title is required"),
  fromLabel: z.string().min(1),
  customerLabel: z.string().min(1),
  invoiceNoLabel: z.string().min(1),
  issueDateLabel: z.string().min(1),
  dueDateLabel: z.string().min(1),
  descriptionLabel: z.string().min(1),
  priceLabel: z.string().min(1),
  quantityLabel: z.string().min(1),
  totalLabel: z.string().min(1),
  subtotalLabel: z.string().min(1),
  vatLabel: z.string().min(1),
  taxLabel: z.string().min(1),
  discountLabel: z.string().min(1),
  paymentLabel: z.string().min(1),
  noteLabel: z.string().min(1),
  currency: z.string().min(1),
  dateFormat: z.string().min(1),
  includeVat: z.boolean(),
  includeTax: z.boolean(),
  includeDiscount: z.boolean(),
  includeDecimals: z.boolean(),
  includeQr: z.boolean(),
  vatRate: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
  pageSize: z.enum(["a4", "letter"]),
  locale: z.string().min(1),
  timezone: z.string().min(1),
  paymentDetails: z.string().optional(),
  fromDetails: z.string().optional(),
  noteDetails: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

const defaultValues: TemplateFormValues = {
  logoUrl: "",
  title: "Invoice",
  fromLabel: "From",
  customerLabel: "Bill To",
  invoiceNoLabel: "Invoice No",
  issueDateLabel: "Issue Date",
  dueDateLabel: "Due Date",
  descriptionLabel: "Description",
  priceLabel: "Price",
  quantityLabel: "Qty",
  totalLabel: "Total",
  subtotalLabel: "Subtotal",
  vatLabel: "VAT",
  taxLabel: "Tax",
  discountLabel: "Discount",
  paymentLabel: "Payment Details",
  noteLabel: "Notes",
  currency: "EUR",
  dateFormat: "dd/MM/yyyy",
  includeVat: true,
  includeTax: false,
  includeDiscount: false,
  includeDecimals: true,
  includeQr: false,
  vatRate: 20,
  taxRate: 0,
  pageSize: "a4",
  locale: "sr-RS",
  timezone: "Europe/Belgrade",
  paymentDetails: "",
  fromDetails: "",
  noteDetails: "",
};

const currencies = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "RSD", label: "Serbian Dinar (RSD)" },
  { value: "CHF", label: "Swiss Franc (CHF)" },
];

const dateFormats = [
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2024-12-31)" },
  { value: "dd.MM.yyyy", label: "DD.MM.YYYY (31.12.2024)" },
];

const locales = [
  { value: "sr-RS", label: "Serbian (Srpski)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German (Deutsch)" },
  { value: "fr-FR", label: "French (Français)" },
];

const _timezones = [
  { value: "Europe/Belgrade", label: "Belgrade (CET)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "America/New_York", label: "New York (EST)" },
];

export default function InvoiceTemplateSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema) as any,
    defaultValues,
  });

  // Load existing template settings
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        // TODO: Replace with actual company ID from auth context
        const companyId = "default";
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/invoice-templates/${companyId}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data) {
            form.reset({
              logoUrl: data.logoUrl || "",
              title: data.title || defaultValues.title,
              fromLabel: data.fromLabel || defaultValues.fromLabel,
              customerLabel: data.customerLabel || defaultValues.customerLabel,
              invoiceNoLabel: data.invoiceNoLabel || defaultValues.invoiceNoLabel,
              issueDateLabel: data.issueDateLabel || defaultValues.issueDateLabel,
              dueDateLabel: data.dueDateLabel || defaultValues.dueDateLabel,
              descriptionLabel: data.descriptionLabel || defaultValues.descriptionLabel,
              priceLabel: data.priceLabel || defaultValues.priceLabel,
              quantityLabel: data.quantityLabel || defaultValues.quantityLabel,
              totalLabel: data.totalLabel || defaultValues.totalLabel,
              subtotalLabel: data.subtotalLabel || defaultValues.subtotalLabel,
              vatLabel: data.vatLabel || defaultValues.vatLabel,
              taxLabel: data.taxLabel || defaultValues.taxLabel,
              discountLabel: data.discountLabel || defaultValues.discountLabel,
              paymentLabel: data.paymentLabel || defaultValues.paymentLabel,
              noteLabel: data.noteLabel || defaultValues.noteLabel,
              currency: data.currency || defaultValues.currency,
              dateFormat: data.dateFormat || defaultValues.dateFormat,
              includeVat: data.includeVat ?? defaultValues.includeVat,
              includeTax: data.includeTax ?? defaultValues.includeTax,
              includeDiscount: data.includeDiscount ?? defaultValues.includeDiscount,
              includeDecimals: data.includeDecimals ?? defaultValues.includeDecimals,
              includeQr: data.includeQr ?? defaultValues.includeQr,
              vatRate: data.vatRate ?? defaultValues.vatRate,
              taxRate: data.taxRate ?? defaultValues.taxRate,
              pageSize: data.pageSize || defaultValues.pageSize,
              locale: data.locale || defaultValues.locale,
              timezone: data.timezone || defaultValues.timezone,
              paymentDetails: data.paymentDetails || "",
              fromDetails: data.fromDetails || "",
              noteDetails: data.noteDetails || "",
            });
          }
        }
      } catch (error) {
        logger.error("Failed to load template:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [form]);

  const onSubmit = async (values: TemplateFormValues) => {
    setIsSaving(true);
    try {
      // TODO: Replace with actual company ID from auth context
      const companyId = "default";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/invoice-templates/${companyId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      if (response.ok) {
        toast.success("Invoice template saved successfully");
      } else {
        throw new Error("Failed to save template");
      }
    } catch (_error) {
      toast.error("Failed to save invoice template");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Invoice Template Settings
        </h1>
        <p className="text-muted-foreground">
          Customize how your invoices look when printed or exported to PDF
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Branding Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Branding
                </CardTitle>
                <CardDescription>
                  Your company logo and invoice title
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/logo.png"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        URL to your company logo (recommended size: 200x60px)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Regional Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Regional Settings
                </CardTitle>
                <CardDescription>
                  Currency, date format, and localization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Format</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dateFormats.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="locale"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Locale</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locales.map((locale) => (
                              <SelectItem key={locale.value} value={locale.value}>
                                {locale.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page Size</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="a4">A4</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tax & Calculations
                </CardTitle>
                <CardDescription>
                  Configure VAT, tax rates, and display options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Include VAT</FormLabel>
                    <FormDescription>
                      Show VAT calculation on invoices
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeVat"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("includeVat") && (
                  <FormField
                    control={form.control}
                    name="vatRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default VAT Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Include Tax</FormLabel>
                    <FormDescription>
                      Show additional tax calculation
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeTax"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Show Discount Column</FormLabel>
                    <FormDescription>
                      Display discount per line item
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeDiscount"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Show Decimals</FormLabel>
                    <FormDescription>
                      Display decimal places in amounts
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeDecimals"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Include QR Code</FormLabel>
                    <FormDescription>
                      Add payment QR code to invoice
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeQr"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Default Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Default Content
                </CardTitle>
                <CardDescription>
                  Pre-fill payment details and notes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="fromDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Details (From)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Your Company Name&#10;Address Line 1&#10;City, Country&#10;VAT: XX123456789"
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your company info that appears in the "From" section
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Bank: Your Bank Name&#10;IBAN: RS35123456789012345678&#10;SWIFT: BANKRSBG"
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Bank account and payment instructions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="noteDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Thank you for your business!&#10;Payment is due within 30 days."
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Default note that appears on every invoice
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Labels Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Label Customization
              </CardTitle>
              <CardDescription>
                Customize labels for multilingual support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="fromLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoiceNoLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice No Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="issueDateLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDateLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="descriptionLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantityLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subtotalLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="noteLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Template Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

