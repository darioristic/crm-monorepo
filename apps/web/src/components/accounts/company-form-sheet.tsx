"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { organizationsApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pib: z.string().optional(),
  companyNumber: z.string().optional(),
  contactPerson: z.string().optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  onSaved?: () => void;
};

export function CompanyFormSheet({ open, onOpenChange, companyId, onSaved }: Props) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      pib: "",
      companyNumber: "",
      contactPerson: "",
    },
  });

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      const res = await organizationsApi.getById(companyId);
      if (res.success && res.data) {
        form.reset({
          name: res.data.name,
          email: res.data.email || "",
          phone: res.data.phone || "",
          pib: res.data.pib || "",
          companyNumber: res.data.companyNumber || "",
          contactPerson: res.data.contactPerson || "",
        });
      }
    }
    load();
  }, [companyId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader className="mb-4">
          <h2 className="text-lg">{companyId ? "Edit Organization" : "Add Organization"}</h2>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              if (companyId) {
                const res = await organizationsApi.update(companyId, {
                  name: data.name,
                  email: data.email || "",
                  phone: data.phone,
                  pib: data.pib,
                  companyNumber: data.companyNumber,
                  contactPerson: data.contactPerson,
                } as any);
                if (res.success) {
                  onSaved?.();
                  onOpenChange(false);
                }
              } else {
                const res = await organizationsApi.create({
                  id: crypto.randomUUID(),
                  name: data.name,
                  email: data.email || "",
                  phone: data.phone,
                  pib: data.pib,
                  companyNumber: data.companyNumber,
                  contactPerson: data.contactPerson,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as any);
                if (res.success) {
                  onSaved?.();
                  onOpenChange(false);
                }
              }
            })}
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
                            <FormLabel className="text-xs">Organization Name *</FormLabel>
                            <FormControl>
                              <InputGroup>
                                <InputGroupInput {...field} />
                              </InputGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Email</FormLabel>
                              <FormControl>
                                <InputGroup>
                                  <InputGroupInput type="email" {...field} />
                                </InputGroup>
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
                              <FormLabel className="text-xs">Phone</FormLabel>
                              <FormControl>
                                <InputGroup>
                                  <InputGroupInput {...field} />
                                </InputGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger className="text-sm font-medium py-2">
                    Identifiers & Contact
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="pib"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">PIB / VAT Number</FormLabel>
                              <FormControl>
                                <InputGroup>
                                  <InputGroupInput {...field} />
                                </InputGroup>
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
                              <FormLabel className="text-xs">Matični broj</FormLabel>
                              <FormControl>
                                <InputGroup>
                                  <InputGroupInput {...field} />
                                </InputGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Kontakt osoba</FormLabel>
                            <FormControl>
                              <InputGroup>
                                <InputGroupInput {...field} />
                              </InputGroup>
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
                <Button type="submit">{companyId ? "Save" : "Create & Close"}</Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
