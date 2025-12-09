"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
import { Button } from "@/components/ui/button";
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
            <CreateCompanyInlineForm
              mode="edit"
              companyId={organizationId || undefined}
              initialValues={{
                name: form.getValues("name"),
                email: form.getValues("email"),
                phone: form.getValues("phone"),
                vatNumber: form.getValues("pib"),
                companyNumber: form.getValues("companyNumber"),
                contact: form.getValues("contactPerson"),
              }}
              onSuccess={(id) => handleSuccess(id)}
              onCancel={() => handleOpenChange(false)}
            />
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
