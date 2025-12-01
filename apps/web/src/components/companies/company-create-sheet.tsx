"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { CompanyForm } from "./company-form";

export function CompanyCreateSheet() {
  const { setParams, createCompany } = useCompanyParams();

  const isOpen = Boolean(createCompany);

  return (
    <Sheet open={isOpen} onOpenChange={() => setParams(null)}>
      <SheetContent>
        <SheetHeader className="mb-6 flex justify-between items-center flex-row">
          <h2 className="text-xl">Create Company</h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setParams(null)}
            className="p-0 m-0 size-auto hover:bg-transparent"
          >
            <X className="size-5" />
          </Button>
        </SheetHeader>

        <CompanyForm />
      </SheetContent>
    </Sheet>
  );
}
