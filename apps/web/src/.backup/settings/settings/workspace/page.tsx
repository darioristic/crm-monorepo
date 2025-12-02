"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Building2Icon, ImageIcon, Trash2Icon } from "lucide-react";

import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const currencies = [
  { label: "RSD - Srpski dinar", value: "RSD" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "USD - US Dollar", value: "USD" },
  { label: "GBP - British Pound", value: "GBP" },
  { label: "CHF - Swiss Franc", value: "CHF" },
] as const;

const timezones = [
  { label: "(UTC+01:00) Belgrade", value: "Europe/Belgrade" },
  { label: "(UTC+00:00) London", value: "Europe/London" },
  { label: "(UTC+01:00) Berlin", value: "Europe/Berlin" },
  { label: "(UTC+02:00) Athens", value: "Europe/Athens" },
  { label: "(UTC-05:00) New York", value: "America/New_York" },
  { label: "(UTC-08:00) Los Angeles", value: "America/Los_Angeles" },
] as const;

const languages = [
  { label: "Srpski", value: "sr" },
  { label: "English", value: "en" },
  { label: "Deutsch", value: "de" },
  { label: "Français", value: "fr" },
  { label: "Italiano", value: "it" },
] as const;

const workspaceFormSchema = z.object({
  companyName: z.string().min(2, {
    message: "Naziv kompanije mora imati najmanje 2 karaktera.",
  }),
  companyDescription: z.string().max(500).optional(),
  street: z.string().min(1, { message: "Ulica je obavezna." }),
  city: z.string().min(1, { message: "Grad je obavezan." }),
  postalCode: z.string().min(1, { message: "Poštanski broj je obavezan." }),
  country: z.string().min(1, { message: "Država je obavezna." }),
  email: z.string().email({ message: "Unesite validnu email adresu." }),
  phone: z.string().min(1, { message: "Telefon je obavezan." }),
  website: z.string().url({ message: "Unesite validan URL." }).optional().or(z.literal("")),
  pib: z.string().min(9, { message: "PIB mora imati najmanje 9 cifara." }),
  maticniBroj: z.string().min(8, { message: "Matični broj mora imati najmanje 8 cifara." }),
  ziroRacun: z.string().min(1, { message: "Žiro račun je obavezan." }),
  banka: z.string().min(1, { message: "Naziv banke je obavezan." }),
  currency: z.string({ required_error: "Izaberite valutu." }),
  timezone: z.string({ required_error: "Izaberite vremensku zonu." }),
  language: z.string({ required_error: "Izaberite jezik." }),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: "Unesite validnu HEX boju.",
  }),
  footerText: z.string().max(200).optional(),
});

type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

const defaultValues: Partial<WorkspaceFormValues> = {
  companyName: "",
  companyDescription: "",
  street: "",
  city: "",
  postalCode: "",
  country: "Srbija",
  email: "",
  phone: "",
  website: "",
  pib: "",
  maticniBroj: "",
  ziroRacun: "",
  banka: "",
  currency: "RSD",
  timezone: "Europe/Belgrade",
  language: "sr",
  brandColor: "#3B82F6",
  footerText: "",
};

export default function WorkspacePage() {
  const [logoUpload, logoActions] = useFileUpload({
    accept: "image/*",
  });
  const [faviconUpload, faviconActions] = useFileUpload({
    accept: "image/*",
  });

  const logoPreview = logoUpload.files[0]?.preview || null;
  const faviconPreview = faviconUpload.files[0]?.preview || null;

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema) as any,
    defaultValues,
    mode: "onChange",
  });

  function onSubmit(data: WorkspaceFormValues) {
    toast.success("Podešavanja su sačuvana!", {
      description: "Workspace podešavanja su uspešno ažurirana.",
    });
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Osnovne informacije */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Osnovne informacije</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4">
                <FormLabel>Logo kompanije</FormLabel>
                <div className="inline-flex items-center gap-4">
                  <Avatar className="h-24 w-24 rounded-lg">
                    <AvatarImage src={logoPreview || ""} className="object-cover" />
                    <AvatarFallback className="rounded-lg">
                      <Building2Icon className="h-10 w-10 opacity-45" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={logoActions.openFileDialog}
                    >
                      {logoPreview ? "Promeni logo" : "Otpremi logo"}
                    </Button>
                    <input
                      {...logoActions.getInputProps()}
                      className="sr-only"
                      aria-label="Otpremi logo"
                      tabIndex={-1}
                    />
                    {logoPreview && (
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        onClick={() => logoActions.removeFile(logoUpload.files[0]?.id)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <FormDescription>
                  Preporučena veličina: 256x256px. Podržani formati: PNG, JPG, SVG.
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naziv kompanije</FormLabel>
                    <FormControl>
                      <Input placeholder="Vaša kompanija d.o.o." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opis kompanije</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Kratak opis vaše kompanije..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Maksimalno 500 karaktera.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Kontakt podaci */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kontakt podaci</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica i broj</FormLabel>
                    <FormControl>
                      <Input placeholder="Bulevar oslobođenja 123" {...field} />
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
                      <FormLabel>Grad</FormLabel>
                      <FormControl>
                        <Input placeholder="Beograd" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poštanski broj</FormLabel>
                      <FormControl>
                        <Input placeholder="11000" {...field} />
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
                    <FormLabel>Država</FormLabel>
                    <FormControl>
                      <Input placeholder="Srbija" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="kontakt@kompanija.rs" {...field} />
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
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input placeholder="+381 11 123 4567" {...field} />
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
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.kompanija.rs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pravne informacije */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pravne informacije</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pib"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIB</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} />
                      </FormControl>
                      <FormDescription>
                        Poreski identifikacioni broj
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maticniBroj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matični broj</FormLabel>
                      <FormControl>
                        <Input placeholder="12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ziroRacun"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Žiro račun</FormLabel>
                    <FormControl>
                      <Input placeholder="123-1234567890123-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="banka"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banka</FormLabel>
                    <FormControl>
                      <Input placeholder="Naziv banke" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Lokalizacija */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lokalizacija</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valuta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Izaberite valutu" />
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
                    <FormDescription>
                      Podrazumevana valuta za fakture i cene.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vremenska zona</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Izaberite vremensku zonu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
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
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jezik</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Izaberite jezik" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Podrazumevani jezik za dashboard i dokumente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Brending */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brending</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="brandColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primarna boja brenda</FormLabel>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Input
                          type="color"
                          className="h-10 w-16 cursor-pointer p-1"
                          {...field}
                        />
                      </FormControl>
                      <Input
                        placeholder="#3B82F6"
                        value={field.value}
                        onChange={field.onChange}
                        className="w-32"
                      />
                    </div>
                    <FormDescription>
                      Koristi se za akcente i elemente brenda.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-4">
                <FormLabel>Favicon</FormLabel>
                <div className="inline-flex items-center gap-4">
                  <Avatar className="h-12 w-12 rounded">
                    <AvatarImage src={faviconPreview || ""} className="object-cover" />
                    <AvatarFallback className="rounded">
                      <ImageIcon className="h-5 w-5 opacity-45" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={faviconActions.openFileDialog}
                    >
                      {faviconPreview ? "Promeni" : "Otpremi"}
                    </Button>
                    <input
                      {...faviconActions.getInputProps()}
                      className="sr-only"
                      aria-label="Otpremi favicon"
                      tabIndex={-1}
                    />
                    {faviconPreview && (
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        onClick={() => faviconActions.removeFile(faviconUpload.files[0]?.id)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <FormDescription>
                  Preporučena veličina: 32x32px ili 64x64px. Format: ICO, PNG.
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="footerText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Footer tekst</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="© 2024 Vaša kompanija. Sva prava zadržana."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Tekst koji se prikazuje u footeru dokumenata.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full sm:w-auto">
            Sačuvaj podešavanja
          </Button>
        </form>
      </Form>
    </div>
  );
}

