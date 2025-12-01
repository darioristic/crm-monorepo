"use client";

import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, CalendarIcon, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { formatISO, format } from "date-fns";
import { documentTagsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function VaultSearchFilter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { filter, setFilter } = useDocumentFilterParams();
  const [input, setInput] = useState(filter.q ?? "");

  const { data: tagsData } = useQuery({
    queryKey: ["document-tags"],
    queryFn: async () => {
      const response = await documentTagsApi.getAll();
      return response.data ?? [];
    },
    enabled: isOpen || Boolean(filter.tags?.length),
  });

  const handleSearch = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const value = evt.target.value;

    if (value) {
      setInput(value);
    } else {
      setFilter({ q: null });
      setInput("");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilter({ q: input.length > 0 ? input : null });
  };

  const validFilters = Object.fromEntries(
    Object.entries(filter).filter(([key]) => key !== "q")
  );

  const hasValidFilters = Object.values(validFilters).some(
    (value) => value !== null
  );

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex space-x-2 items-center">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <Search className="absolute pointer-events-none left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search documents..."
              className="pl-9 w-full md:w-[350px] pr-8"
              value={input}
              onChange={handleSearch}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />

            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "absolute z-10 right-3 top-1/2 -translate-y-1/2 opacity-50 transition-opacity duration-300 hover:opacity-100",
                  hasValidFilters && "opacity-100",
                  isOpen && "opacity-100"
                )}
              >
                <Filter className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
          </form>
        </div>

        <DropdownMenuContent
          className="w-[350px]"
          align="end"
          sideOffset={8}
          alignOffset={-11}
          side="bottom"
        >
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>Date</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                sideOffset={14}
                alignOffset={-4}
                className="p-0"
              >
                <Calendar
                  mode="range"
                  initialFocus
                  toDate={new Date()}
                  selected={
                    filter.start || filter.end
                      ? {
                          from: filter.start
                            ? new Date(filter.start)
                            : undefined,
                          to: filter.end ? new Date(filter.end) : undefined,
                        }
                      : undefined
                  }
                  onSelect={(range) => {
                    if (!range) return;

                    const newRange = {
                      start: range.from
                        ? formatISO(range.from, { representation: "date" })
                        : filter.start,
                      end: range.to
                        ? formatISO(range.to, { representation: "date" })
                        : filter.end,
                    };

                    setFilter(newRange);
                  }}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="mr-2 h-4 w-4" />
                <span>Tags</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                sideOffset={14}
                alignOffset={-4}
                className="p-0 max-h-[300px] overflow-y-auto"
              >
                {tagsData?.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={filter.tags?.includes(tag.id)}
                    onCheckedChange={() => {
                      setFilter({
                        tags: filter?.tags?.includes(tag.id)
                          ? filter.tags.filter((s) => s !== tag.id)
                          : [...(filter?.tags ?? []), tag.id],
                      });
                    }}
                  >
                    {tag.name}
                  </DropdownMenuCheckboxItem>
                ))}

                {!tagsData?.length && (
                  <DropdownMenuItem disabled>No tags found</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active filters */}
      {hasValidFilters && (
        <div className="flex flex-wrap gap-2">
          {filter.start && filter.end && (
            <Badge variant="secondary" className="gap-1">
              {format(new Date(filter.start), "MMM d")} -{" "}
              {format(new Date(filter.end), "MMM d, yyyy")}
              <button
                type="button"
                onClick={() => {
                  setFilter({ start: null, end: null });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filter.tags?.map((tagId) => {
            const tag = tagsData?.find((t) => t.id === tagId);
            return (
              <Badge key={tagId} variant="secondary" className="gap-1">
                {tag?.name || tagId}
                <button
                  type="button"
                  onClick={() => {
                    setFilter({
                      tags: filter.tags?.filter((t) => t !== tagId) ?? null,
                    });
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilter({ q: null, tags: null, start: null, end: null })
            }
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
