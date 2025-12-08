"use client";

import { BaseCurrency } from "@/components/base-currency/base-currency";
import { CompanyCountry } from "@/components/company-country";
import { CompanyEmail } from "@/components/company-email";
import { CompanyFiscalYear } from "@/components/company-fiscal-year";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyName } from "@/components/company-name";
import { CreateCompanyCard } from "@/components/create-company-card";
import { DeleteTeam } from "@/components/delete-team";

export default function SettingsClient() {
  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Company Information</h2>
          <p className="text-sm text-muted-foreground">Manage your company details and branding.</p>
        </div>
        <div className="space-y-4">
          <CompanyLogo />
          <CompanyName />
          <CompanyEmail />
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Regional Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure location, currency, and fiscal year preferences.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CompanyCountry />
          <BaseCurrency />
        </div>
        <CompanyFiscalYear />
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Company Management</h2>
          <p className="text-sm text-muted-foreground">
            Create new companies or manage existing ones.
          </p>
        </div>
        <div className="space-y-4">
          <CreateCompanyCard />
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1 text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">Irreversible and destructive actions.</p>
        </div>
        <DeleteTeam />
      </section>
    </div>
  );
}
