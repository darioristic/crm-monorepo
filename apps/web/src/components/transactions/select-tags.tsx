"use client";

import { useEffect, useState } from "react";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";

type TagOption = {
  id?: string;
  value: string;
  label: string;
};

type Props = {
  tags?: TagOption[];
  availableTags?: TagOption[];
  onSelect?: (tag: TagOption) => void;
  onRemove?: (tag: TagOption) => void;
  onCreate?: (name: string) => void;
};

export function SelectTags({ tags = [], availableTags = [], onSelect, onRemove, onCreate }: Props) {
  const [selected, setSelected] = useState<Option[]>(
    tags.map((t) => ({ id: t.id, value: t.value, label: t.label }))
  );

  // Sync with external tags prop
  useEffect(() => {
    setSelected(tags.map((t) => ({ id: t.id, value: t.value, label: t.label })));
  }, [tags]);

  // Convert availableTags to options (excluding already selected)
  const options: Option[] = availableTags
    .filter((t) => !selected.some((s) => s.id === t.id))
    .map((t) => ({ id: t.id, value: t.value, label: t.label }));

  return (
    <div className="w-full">
      <MultipleSelector
        options={options}
        value={selected}
        placeholder="Select tags"
        creatable
        emptyIndicator={<p className="text-sm">No results found.</p>}
        renderOption={(option) => (
          <div className="flex items-center justify-between w-full group">
            <span>{option.label}</span>
          </div>
        )}
        onCreate={(option) => {
          onCreate?.(option.value);
        }}
        onChange={(newOptions) => {
          // Find newly added tag
          const newTag = newOptions.find((opt) => !selected.find((s) => s.value === opt.value));

          // Find removed tag
          const removedTag = selected.find((s) => !newOptions.find((opt) => opt.value === s.value));

          setSelected(newOptions);

          if (newTag) {
            onSelect?.({ id: newTag.id, value: newTag.value, label: newTag.label });
          }

          if (removedTag) {
            onRemove?.({ id: removedTag.id, value: removedTag.value, label: removedTag.label });
          }
        }}
      />
    </div>
  );
}
