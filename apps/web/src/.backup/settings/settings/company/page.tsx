"use client";

import { CompanyEmail } from "@/components/settings/company-email";
import { CompanyLogo } from "@/components/settings/company-logo";
import { CompanyName } from "@/components/settings/company-name";
import { DeleteCompany } from "@/components/settings/delete-company";

export default function CompanySettingsPage() {
  return (
    <div className="space-y-6">
      <CompanyLogo />
      <CompanyName />
      <CompanyEmail />
      <DeleteCompany />
    </div>
  );
}
