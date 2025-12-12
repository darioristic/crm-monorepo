"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { contactsApi } from "@/lib/api";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  jmbg: z.string().optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;
  onSaved?: () => void;
};

export function ContactFormSheet({ open, onOpenChange, contactId, onSaved }: Props) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", jmbg: "" },
  });

  useEffect(() => {
    async function load() {
      if (!contactId) return;
      const res = await contactsApi.getById(contactId);
      if (res.success && res.data) {
        form.reset({
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          email: res.data.email || "",
          phone: res.data.phone || "",
          jmbg: res.data.jmbg || "",
        });
      }
    }
    load();
  }, [contactId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader className="mb-4">
          <h2 className="text-lg">{contactId ? "Edit Individual" : "Add Individual"}</h2>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (data) => {
              if (contactId) {
                const res = await contactsApi.update(contactId, {
                  firstName: data.firstName,
                  lastName: data.lastName,
                  email: data.email || "",
                  phone: data.phone,
                  jmbg: data.jmbg,
                });
                if (res.success) {
                  onSaved?.();
                  onOpenChange(false);
                }
              } else {
                const res = await contactsApi.create({
                  firstName: data.firstName,
                  lastName: data.lastName,
                  email: data.email || "",
                  phone: data.phone,
                  jmbg: data.jmbg,
                });
                if (res.success) {
                  onSaved?.();
                  onOpenChange(false);
                }
              }
            })}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">First Name</FormLabel>
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
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Last Name</FormLabel>
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
              name="jmbg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">JMBG</FormLabel>
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
