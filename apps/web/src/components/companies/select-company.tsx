"use client";

import { useState } from "react";
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
  const { setParams: setCompanyParams } = useCompanyParams();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { data: companies, isLoading } = useApi(() =>
    companiesApi.getAll({ pageSize: 100 })
  );

  const companiesList = companies || [];

  const formatData = companiesList.map((item) => ({
    value: item.name,
    label: item.name,
    id: item.id,
  }));

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
        <Command>
          <CommandInput
            value={searchValue}
            onValueChange={setSearchValue}
            placeholder="Search company..."
            className="h-9"
          />
          <CommandList className="max-h-[250px] overflow-auto">
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
            <CommandGroup>
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
            </CommandGroup>
            <CommandGroup className="border-t">
              <CommandItem
                value="create-company"
                onSelect={() => handleSelect("create-company")}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new company
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

