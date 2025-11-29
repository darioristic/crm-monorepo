"use client";

import { useEffect, useState } from "react";
import { Building2Icon, XIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { companiesApi } from "@/lib/api";
import type { Company } from "@crm/types";

interface CompanyFilterProps {
  value?: string;
  onChange: (companyId: string | undefined) => void;
  className?: string;
}

export function CompanyFilter({ value, onChange, className }: CompanyFilterProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompanies() {
      try {
        const response = await companiesApi.getAll({ pageSize: 100 });
        if (response.success && response.data) {
          setCompanies(response.data);
        }
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, []);

  const selectedCompany = companies.find((c) => c.id === value);

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <Select
          value={value || "all"}
          onValueChange={(v) => onChange(v === "all" ? undefined : v)}
          disabled={loading}
        >
          <SelectTrigger className="w-[200px]">
            <Building2Icon className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(undefined)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

