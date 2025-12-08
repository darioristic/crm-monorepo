"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { OrganizationSheet } from "@/components/accounts/organization-sheet";
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
  } = usePaginatedApi<any>((params) => organizationsApi.getAll(params), {
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search organizations..."
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="md:max-w-sm"
        />
        <Button onClick={() => router.push(`${pathname}?type=create`)}>Add Organization</Button>
      </div>
      <OrganizationsDataTable
        data={companies || []}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRefresh={refetch}
      />

      <OrganizationSheet
        onSaved={() => {
          refetch();
        }}
      />
    </div>
  );
}
