"use client";

import { Filter, Search } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInboxParams } from "@/hooks/use-inbox-params";

const statusFilters = [
  { id: "all", name: "All" },
  { id: "done", name: "Matched" },
  { id: "pending", name: "Pending" },
  { id: "suggested_match", name: "Suggested Match" },
  { id: "no_match", name: "Unmatched" },
];

export function InboxSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const { params, setParams } = useInboxParams();
  const [searchQuery, setSearchQuery] = useState("");

  const hasFilter = Boolean(params.status);

  const handleSearch = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const value = evt.target.value;
    setSearchQuery(value);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex space-x-4 items-center w-full">
        <form
          className="relative w-full"
          onSubmit={(e) => {
            e.preventDefault();
            setIsOpen(false);
          }}
        >
          <Search className="absolute pointer-events-none left-3 top-[11px] size-4" />
          <Input
            placeholder="Search or filter"
            className="pl-9 w-full"
            value={searchQuery}
            onChange={handleSearch}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />

          <DropdownMenuTrigger asChild>
            <button
              onClick={() => setIsOpen((prev) => !prev)}
              type="button"
              className={cn(
                "absolute z-10 right-3 top-[10px] opacity-50 transition-opacity duration-300 hover:opacity-100",
                hasFilter && "opacity-100",
                isOpen && "opacity-100",
              )}
            >
              <Filter className="size-4" />
            </button>
          </DropdownMenuTrigger>
        </form>
      </div>

      <DropdownMenuContent
        className="w-[350px]"
        align="end"
        sideOffset={19}
        alignOffset={-11}
        side="bottom"
      >
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span>Status</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                sideOffset={14}
                alignOffset={-4}
                className="p-0"
              >
                <DropdownMenuRadioGroup
                  value={params.status ?? "all"}
                  onValueChange={(value) =>
                    setParams({
                      status:
                        value === "all"
                          ? null
                          : (value as
                              | "done"
                              | "pending"
                              | "suggested_match"
                              | "no_match"),
                    })
                  }
                >
                  {statusFilters.map(({ id, name }) => (
                    <DropdownMenuRadioItem key={id} value={id}>
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
