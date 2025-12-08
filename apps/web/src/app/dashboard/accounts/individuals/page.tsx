"use client";

import { useState } from "react";
import { ContactFormSheet } from "@/components/accounts/contact-form-sheet";
import { IndividualsDataTable } from "@/components/accounts/individuals-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePaginatedApi } from "@/hooks/use-api";
import { contactsApi } from "@/lib/api";

export default function IndividualsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = useState(false);

  const {
    data: contacts,
    isLoading,
    error,
    page,
    totalPages,
    setPage,
    setFilters,
    refetch,
  } = usePaginatedApi<any>((params) => contactsApi.getAll(params), { search: "" });

  const handleSearch = (value: string) => {
    setSearchValue(value);
    const timer = setTimeout(() => {
      setFilters({ search: value || undefined });
    }, 300);
    return () => clearTimeout(timer);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search individuals..."
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="md:max-w-sm"
        />
        <Button onClick={() => setOpen(true)}>Add Individual</Button>
      </div>
      <IndividualsDataTable
        data={contacts || []}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRefresh={refetch}
      />

      <ContactFormSheet open={open} onOpenChange={setOpen} onSaved={refetch} />
    </div>
  );
}
