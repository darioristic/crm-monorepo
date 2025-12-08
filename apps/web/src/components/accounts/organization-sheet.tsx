"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { organizationsApi } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  pib: z.string().optional(),
  companyNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  status: z.enum(["lead", "active", "inactive"]).optional(),
  roles: z.array(z.enum(["customer", "partner", "vendor", "supplier", "prospect"])).optional(),
  tagsCsv: z.string().optional(),
});

type OrganizationSheetProps = {
  onSaved?: () => void;
};

export function OrganizationSheet({ onSaved }: OrganizationSheetProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | "success" | null;
  const organizationId = searchParams.get("organizationId");
  const isOpen = type === "create" || type === "edit" || type === "success";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      pib: "",
      companyNumber: "",
      contactPerson: "",
      status: "active",
      roles: [],
      tagsCsv: "",
    },
  });

  useEffect(() => {
    async function load() {
      if (!organizationId || type !== "edit") return;
      const res = await organizationsApi.getById(organizationId);
      if (res.success && res.data) {
        form.reset({
          name: res.data.name,
          email: res.data.email || "",
          phone: res.data.phone || "",
          pib: res.data.pib || "",
          companyNumber: res.data.companyNumber || "",
          contactPerson: res.data.contactPerson || "",
          status: (res.data as any).status || "active",
          roles:
            ((res.data as any).roles as (
              | "customer"
              | "partner"
              | "vendor"
              | "supplier"
              | "prospect"
            )[]) || [],
          tagsCsv: Array.isArray((res.data as any).tags)
            ? ((res.data as any).tags as string[]).join(", ")
            : "",
        });
      }
    }
    load();
  }, [organizationId, type]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        router.push(pathname);
      }
    },
    [router, pathname]
  );

  const handleSuccess = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("type", "success");
      params.set("organizationId", id);
      router.push(`${pathname}?${params.toString()}`);
      onSaved?.();
    },
    [router, pathname, searchParams, onSaved]
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {type === "success" ? (
        <SheetContent className="sm:max-w-[600px]">
          <SheetTitle>Organization Created</SheetTitle>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              The organization has been created successfully.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push(pathname)}>Close</Button>
              <Button variant="outline" onClick={() => router.push(`${pathname}?type=create`)}>
                Create Another
              </Button>
            </div>
          </div>
        </SheetContent>
      ) : type === "create" ? (
        <SheetContent className="sm:max-w-[600px]">
          <VisuallyHidden>
            <SheetTitle>Add Organization</SheetTitle>
          </VisuallyHidden>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Add Organization</h2>
              <p className="text-sm text-muted-foreground">Create a new organization</p>
            </div>
            <CreateCompanyInlineForm
              onSuccess={(id) => handleSuccess(id)}
              onCancel={() => handleOpenChange(false)}
            />
          </div>
        </SheetContent>
      ) : (
        <SheetContent className="sm:max-w-[600px]">
          <VisuallyHidden>
            <SheetTitle>Edit Organization</SheetTitle>
          </VisuallyHidden>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Edit Organization</h2>
              <p className="text-sm text-muted-foreground">Update organization details</p>
            </div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(async (data) => {
                  if (organizationId) {
                    const res = await organizationsApi.update(organizationId, {
                      name: data.name,
                      email: data.email || "",
                      phone: data.phone,
                      pib: data.pib,
                      companyNumber: data.companyNumber,
                      contactPerson: data.contactPerson,
                      status: data.status,
                      roles: data.roles,
                      tags: (data.tagsCsv || "")
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t.length > 0),
                    } as any);
                    if (res.success) {
                      handleSuccess(organizationId);
                    }
                  }
                })}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Organization Name</FormLabel>
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
                          <Input {...field} />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tagsCsv"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Tags</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="tag1, tag2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="roles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Roles</FormLabel>
                      <div className="flex flex-wrap gap-3">
                        {["customer", "partner", "vendor", "supplier", "prospect"].map((role) => (
                          <label key={role} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={field.value?.includes(role)}
                              onCheckedChange={(checked) => {
                                const next = new Set(field.value || []);
                                if (checked) next.add(role as any);
                                else next.delete(role as any);
                                form.setValue("roles", Array.from(next));
                              }}
                            />
                            <span className="capitalize">{role}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="pib"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">PIB / VAT Number</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </Form>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
