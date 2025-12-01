"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CompanyFormEnhanced } from "./company-form-enhanced";

export function CompanyCreateSheet() {
  const { setParams, createCompany } = useCompanyParams();

  const isOpen = Boolean(createCompany);

  return (
    <Sheet open={isOpen} onOpenChange={() => setParams(null)}>
      <SheetContent className="sm:max-w-[540px] overflow-hidden">
        <SheetHeader className="mb-6 flex flex-row justify-between items-center">
          <SheetTitle className="text-xl">Create Company</SheetTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setParams(null)}
            className="p-0 m-0 h-auto w-auto hover:bg-transparent"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <CompanyFormEnhanced />
      </SheetContent>
    </Sheet>
  );
}

