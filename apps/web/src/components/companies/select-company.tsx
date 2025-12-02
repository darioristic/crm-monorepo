"use client";

console.log("🚀🚀🚀 SELECT-COMPANY.TSX FILE LOADED 🚀🚀🚀");

import { useState, useEffect, useMemo } from "react";
import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Plus, Pencil } from "lucide-react";

interface SelectCompanyProps {
  onSelect?: (companyId: string) => void;
  placeholder?: string;
  value?: string;
}

export function SelectCompany({
  onSelect,
  placeholder = "Select company",
  value,
}: SelectCompanyProps) {
  console.log("🏢 [SelectCompany] Component rendered with value:", value);

  const { setParams: setCompanyParams } = useCompanyParams();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    console.log("🏢 [SelectCompany] Dropdown", open ? "OPENED" : "closed");
  }, [open]);

  // Debounce search - čeka 300ms nakon što korisnik prestane da kuca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
      console.log("🔍 Debounced search value:", searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Server-side search - API pretražuje celu bazu
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true);
      console.log("🔄 Fetching companies with search:", debouncedSearch || "(no search)");

      try {
        const response = await companiesApi.getAll({
          pageSize: 100,
          search: debouncedSearch || undefined
        });

        if (response.success) {
          setCompaniesList(response.data || []);
          console.log("📊 Companies received:", response.data?.length || 0);
          if (debouncedSearch) {
            console.log("🔎 Search term:", debouncedSearch);
            console.log("📋 Companies:", response.data?.map((c: Company) => c.name).join(", ") || "none");
          }
        }
      } catch (error) {
        console.error("❌ Error fetching companies:", error);
        setCompaniesList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, [debouncedSearch]);

  const formatData = useMemo(() =>
    companiesList.map((item) => ({
      value: item.id,
      label: item.name,
      id: item.id,
    })),
    [companiesList]
  );

  const handleSelect = (id: string) => {
    if (id === "create-company") {
      setCompanyParams({ createCompany: true, name: searchValue });
    } else {
      onSelect?.(id);
    }
    setOpen(false);
  };

  if (!companiesList.length && !isLoading) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setCompanyParams({ createCompany: true })}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Company
      </Button>
    );
  }

  const selectedCompany = companiesList.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start gap-2"
        >
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className={!selectedCompany ? "text-muted-foreground" : ""}>
            {selectedCompany?.name || placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder="Search company..."
            className="h-9"
          />
          <CommandGroup>
            <CommandList className="max-h-[250px] overflow-auto">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading companies...
                </div>
              ) : formatData.length === 0 && !searchValue ? (
                <CommandEmpty className="py-4 text-center text-sm">
                  <p className="text-muted-foreground mb-2">No companies yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCompanyParams({ createCompany: true });
                      setOpen(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create first company
                  </Button>
                </CommandEmpty>
              ) : searchValue && formatData.length === 0 ? (
                <CommandEmpty className="py-4 text-center text-sm">
                  <p className="text-muted-foreground mb-2">No companies found</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCompanyParams({ createCompany: true, name: searchValue });
                      setOpen(false);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create "{searchValue}"
                  </Button>
                </CommandEmpty>
              ) : (
                <>
                  {formatData.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.value}
                      onSelect={() => handleSelect(item.id)}
                      className="group cursor-pointer"
                    >
                      <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompanyParams({ companyId: item.id });
                          setOpen(false);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </CommandItem>
                  ))}

                  <CommandItem
                    value="create-company"
                    onSelect={() => handleSelect("create-company")}
                    className="cursor-pointer border-t mt-1"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new company
                  </CommandItem>
                </>
              )}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

