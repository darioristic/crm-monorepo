"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type Props = {
  companies: any[];
  onSelect: (customerId: string) => void;
};

export function SelectCustomer({ companies, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCompanies = query.length >= 2
    ? companies.filter((company) =>
        company.name?.toLowerCase().includes(query.toLowerCase())
      )
    : companies.slice(0, 5);

  const handleSelect = (company: any) => {
    onSelect(company.id);
    setQuery("");
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredCompanies.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCompanies.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCompanies.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(filteredCompanies[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredCompanies.length]);

  return (
    <div className="relative">
      <div className="flex items-center border-b border-transparent focus-within:border-border">
        <Search className="h-3 w-3 text-[#878787] mr-2" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search or select customer..."
          className={cn(
            "border-0 p-0 h-6 text-[11px] bg-transparent outline-none w-full",
            "placeholder:text-[#878787]",
            !query && "bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]"
          )}
        />
      </div>

      {isOpen && filteredCompanies.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-background border shadow-md max-h-64 overflow-y-auto">
          {filteredCompanies.map((company, index) => (
            <div
              key={company.id}
              className={cn(
                "px-3 py-2 cursor-pointer text-xs",
                selectedIndex === index && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(company);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="font-medium">{company.name}</div>
              {company.email && (
                <div className="text-muted-foreground text-[10px]">
                  {company.email}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

