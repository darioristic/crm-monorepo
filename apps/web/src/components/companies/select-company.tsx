"use client";

logger.info("🚀🚀🚀 SELECT-COMPANY.TSX FILE LOADED 🚀🚀🚀");

import type { Company } from "@crm/types";
import { Building2, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { logger } from "@/lib/logger";

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
  logger.info("🏢 [SelectCompany] Component rendered with value:", value);

  const { setParams: setCompanyParams, createCompany } = useCompanyParams();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [prefillName, setPrefillName] = useState("");

  useEffect(() => {
    logger.info("🏢 [SelectCompany] Dropdown", open ? "OPENED" : "closed");
  }, [open]);

  // Debounce search - čeka 300ms nakon što korisnik prestane da kuca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
      logger.info("🔍 Debounced search value:", searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Server-side search - API pretražuje celu bazu
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true);
      logger.info("🔄 Fetching companies with search:", debouncedSearch || "(no search)");

      try {
        const response = await companiesApi.getAll({
          pageSize: 100,
          search: debouncedSearch || undefined,
          source: "customer",
        });

        if (response.success) {
          setCompaniesList(response.data || []);
          logger.info("📊 Companies received:", response.data?.length || 0);
          try {
            const lastId =
              typeof window !== "undefined"
                ? window.localStorage?.getItem("lastCreatedCompanyId")
                : null;
            if (lastId) {
              const exists = (response.data || []).some((c: Company) => c.id === lastId);
              if (exists) {
                onSelect?.(lastId);
                window.localStorage?.removeItem("lastCreatedCompanyId");
              }
            }
          } catch {}
          if (debouncedSearch) {
            logger.info("🔎 Search term:", debouncedSearch);
            logger.info(
              "📋 Companies:",
              response.data?.map((c: Company) => c.name).join(", ") || "none"
            );
          }
        }
      } catch (error) {
        logger.error("❌ Error fetching companies:", error);
        setCompaniesList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, [debouncedSearch, createCompany]);

  const formatData = useMemo(
    () =>
      companiesList.map((item) => ({
        value: item.id,
        label: item.name,
        id: item.id,
      })),
    [companiesList]
  );

  const handleSelect = (id: string) => {
    if (id === "create-company") {
      setPrefillName(searchValue);
      setShowCreateSheet(true);
      setOpen(false);
    } else {
      onSelect?.(id);
      setOpen(false);
    }
  };

  if (!companiesList.length && !isLoading) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setPrefillName("");
          setShowCreateSheet(true);
        }}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Company
      </Button>
    );
  }

  const selectedCompany = companiesList.find((c) => c.id === value);

  return (
    <>
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
                        setPrefillName("");
                        setShowCreateSheet(true);
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
                        setPrefillName(searchValue);
                        setShowCreateSheet(true);
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

      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader className="mb-6 flex justify-between items-center flex-row">
            <h2 className="text-xl">Create Customer</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCreateSheet(false)}
              className="p-0 m-0 size-auto hover:bg-transparent"
            >
              <X className="size-5" />
            </Button>
          </SheetHeader>
          <CreateCompanyInlineForm
            prefillName={prefillName}
            onSuccess={(newCompanyId) => {
              setShowCreateSheet(false);
              setPrefillName("");
              onSelect?.(newCompanyId);
            }}
            onCancel={() => setShowCreateSheet(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
