"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag } from "@/lib/api";
import { cn } from "@/lib/utils";

// Predefined tag colors
const TAG_COLORS = [
  "#6366F1", // Indigo
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#14B8A6", // Teal
];

interface TransactionTagManagerProps {
  assignedTags: Tag[];
  availableTags: Tag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string, color?: string) => void;
  isLoading?: boolean;
}

export function TransactionTagManager({
  assignedTags,
  availableTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isLoading,
}: TransactionTagManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), selectedColor);
      setNewTagName("");
      setIsCreating(false);
      setOpen(false);
    }
  };

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption =
    search.trim() !== "" &&
    !availableTags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  return (
    <div className="space-y-2">
      {/* Assigned Tags */}
      <div className="flex flex-wrap gap-2">
        {assignedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="pl-2 pr-1 py-1 flex items-center gap-1"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : undefined,
              borderColor: tag.color || undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: tag.color || "#6366F1" }}
            />
            {tag.name}
            <button
              onClick={() => onRemoveTag(tag.id)}
              className="ml-1 rounded-full hover:bg-muted p-0.5"
              disabled={isLoading}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add Tag Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 border-dashed">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            {isCreating ? (
              <div className="p-3 space-y-3">
                <p className="text-sm font-medium">Create New Tag</p>
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-all",
                        selectedColor === color && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreating(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    className="flex-1"
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <Command>
                <CommandInput
                  placeholder="Search tags..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {showCreateOption ? (
                      <button
                        onClick={() => {
                          setNewTagName(search);
                          setIsCreating(true);
                        }}
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create "{search}"
                      </button>
                    ) : (
                      <p className="text-muted-foreground text-sm py-2">No tags found</p>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          onAddTag(tag.id);
                          setSearch("");
                          setOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || "#6366F1" }}
                        />
                        <span>{tag.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {filteredTags.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => setIsCreating(true)}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Create new tag
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Empty State */}
      {assignedTags.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No tags assigned. Click "Add Tag" to organize this transaction.
        </p>
      )}
    </div>
  );
}
