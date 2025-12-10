"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import { documentTagsApi } from "@/lib/api";

type TagOption = Option & {
  id: string;
};

type Props = {
  tags: TagOption[];
  onSelect?: (tag: TagOption) => void;
  onRemove?: (tag: TagOption) => void;
  onChange?: (tags: TagOption[]) => void;
};

export function VaultSelectTags({ tags, onSelect, onRemove, onChange }: Props) {
  const [selected, setSelected] = useState<TagOption[]>(tags ?? []);

  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["document-tags"],
    queryFn: async () => {
      const response = await documentTagsApi.getAll();
      return response.data ?? [];
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => documentTagsApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => documentTagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-tags"] });
    },
  });

  const transformedTags: TagOption[] =
    data
      ?.map((tag) => ({
        value: tag.id,
        label: tag.name,
        id: tag.id,
      }))
      .filter((tag) => !selected.some((s) => s.id === tag.id)) ?? [];

  return (
    <div className="w-full">
      <MultipleSelector
        options={transformedTags}
        value={selected}
        placeholder="Select tags..."
        creatable
        renderOption={(option) => (
          <div className="flex w-full items-center justify-between">
            <span>{option.label}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteTagMutation.mutate(option.value);
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
        emptyIndicator={<p className="text-sm text-muted-foreground">No tags found.</p>}
        onCreate={(option) => {
          createTagMutation.mutate(option.value, {
            onSuccess: (response) => {
              if (response.data) {
                const newTag: TagOption = {
                  id: response.data.id,
                  label: response.data.name,
                  value: response.data.id,
                };

                setSelected([...selected, newTag]);
                onSelect?.(newTag);
              }
            },
          });
        }}
        onChange={(options) => {
          const typedOptions = options.map((opt) => ({
            ...opt,
            id: opt.value,
          })) as TagOption[];

          setSelected(typedOptions);
          onChange?.(typedOptions);

          const newTag = typedOptions.find(
            (tag) => !selected.find((opt) => opt.value === tag.value)
          );

          if (newTag) {
            onSelect?.(newTag);
            return;
          }

          if (typedOptions.length < selected.length) {
            const removedTag = selected.find(
              (tag) => !typedOptions.find((opt) => opt.value === tag.value)
            );

            if (removedTag) {
              onRemove?.(removedTag);
              setSelected(typedOptions);
            }
          }
        }}
      />
    </div>
  );
}

export type { TagOption };
