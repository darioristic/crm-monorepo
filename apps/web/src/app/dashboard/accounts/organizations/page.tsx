"use client";

import type { CustomerOrganization } from "@crm/types";
import { RefreshCwIcon, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { OrganizationSheet } from "@/components/accounts/organization-sheet";
import { OrganizationWidgets } from "@/components/accounts/organization-widgets";
import { OrganizationsDataTable } from "@/components/accounts/organizations-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePaginatedApi } from "@/hooks/use-api";
import { organizationsApi } from "@/lib/api";

export default function OrganizationsPage() {
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    data: companies,
    isLoading,
    error,
    page,
    totalPages,
    setPage,
    setFilters,
    refetch,
  } = usePaginatedApi<CustomerOrganization>((params) => organizationsApi.getAll(params), {
    search: "",
  });

  const handleSearch = (value: string) => {
    setSearchValue(value);
    const timer = setTimeout(() => {
      setFilters({ search: value || undefined });
    }, 300);
    return () => clearTimeout(timer);
  };

  const type = searchParams.get("type") as "create" | "edit" | null;
  const _organizationId = searchParams.get("organizationId") || undefined;
  const _isSheetOpen = type === "create" || type === "edit";

  const _handleOpenChange = (open: boolean) => {
    if (!open) {
      router.push(pathname);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizacije</h1>
          <p className="text-muted-foreground">
            Upravljajte organizacijama: kreiranje, uređivanje, favoriti i pretraga
          </p>
        </div>
      </div>

      <OrganizationWidgets organizations={companies || []} isLoading={isLoading} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 md:w-[300px]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push(`${pathname}?type=create`)}>Add Organization</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <OrganizationsDataTable
        data={companies || []}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRefresh={refetch}
        onSortChange={(key, order) => {
          setFilters({
            search: searchValue || undefined,
            sortBy: key,
            sortOrder: order,
          });
        }}
      />

      <OrganizationSheet
        onSaved={() => {
          refetch();
        }}
      />
    </div>
  );
}
