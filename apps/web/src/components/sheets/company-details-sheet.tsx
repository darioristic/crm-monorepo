"use client";

import { CompanyDetails } from "@/components/company/company-details";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCompanyParams } from "@/hooks/use-company-params";

export function CompanyDetailsSheet() {
  const { companyId, details, setParams } = useCompanyParams();

  const isOpen = Boolean(companyId && details);

  return (
    <Sheet open={isOpen} onOpenChange={() => setParams({ companyId: null, details: null })}>
      <SheetContent style={{ maxWidth: 620 }} className="pb-4">
        <CompanyDetails />
      </SheetContent>
    </Sheet>
  );
}
