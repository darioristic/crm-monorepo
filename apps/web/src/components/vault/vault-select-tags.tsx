"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Trash, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { documentTagsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export type TagOption = {
  id: string;
  value: string;
  label: string;
};

type Props = {
  tags: TagOption[];
  onSelect?: (tag: TagOption) => void;
  onRemove?: (tag: TagOption) => void;
  onChange?: (tags: TagOption[]) => void;
};

export function VaultSelectTags({ tags, onSelect, onRemove, onChange }: Props) {
  const [selected, setSelected] = useState<TagOption[]>(tags ?? []);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const queryClient = useQueryClient();

  const { data: tagsData } = useQuery({
    queryKey: ["document-tags"],
    queryFn: async () => {
      const response = await documentTagsApi.getAll();
      return response.data ?? [];
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => documentTagsApi.create({ name }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
      if (response.data) {
        const newTag: TagOption = {
          id: response.data.id,
          value: response.data.id,
          label: response.data.name,
        };
        const newSelected = [...selected, newTag];
        setSelected(newSelected);
        onSelect?.(newTag);
        onChange?.(newSelected);
      }
      setInputValue("");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => documentTagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
    },
  });

  const availableTags: TagOption[] =
    tagsData
      ?.map((tag) => ({
        id: tag.id,
        value: tag.id,
        label: tag.name,
      }))
      .filter((tag) => !selected.some((s) => s.id === tag.id)) ?? [];

  const handleSelect = useCallback(
    (tag: TagOption) => {
      const newSelected = [...selected, tag];
      setSelected(newSelected);
      onSelect?.(tag);
      onChange?.(newSelected);
    },
    [selected, onSelect, onChange]
  );

  const handleRemove = useCallback(
    (tag: TagOption) => {
      const newSelected = selected.filter((t) => t.id !== tag.id);
      setSelected(newSelected);
      onRemove?.(tag);
      onChange?.(newSelected);
    },
    [selected, onRemove, onChange]
  );

  const handleCreate = useCallback(() => {
    if (inputValue.trim()) {
      createTagMutation.mutate(inputValue.trim());
    }
  }, [inputValue, createTagMutation]);

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              {tag.label}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="ml-1 hover:text-destructive rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="justify-between text-muted-foreground"
          >
            <span>Select tags...</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create "{inputValue}"
                  </button>
                ) : (
                  <span className="text-muted-foreground">No tags found</span>
                )}
              </CommandEmpty>

              <CommandGroup heading="Available Tags">
                {availableTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.label}
                    onSelect={() => handleSelect(tag)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selected.some((s) => s.id === tag.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {tag.label}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTagMutation.mutate(tag.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>

              {inputValue.trim() &&
                !availableTags.some((t) => t.label.toLowerCase() === inputValue.toLowerCase()) && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create "{inputValue}"
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
