"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import type { DocumentTag } from "@/lib/api";

type Props = {
  tags: Array<{
    documentTag: DocumentTag;
  }>;
  isLoading: boolean;
};

export function VaultItemTags({ tags, isLoading }: Props) {
  const { setFilter } = useDocumentFilterParams();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-auto">
        {[...Array(3)].map((_, index) => (
          <Skeleton
            key={index.toString()}
            className={`h-5 rounded-full ${
              index % 3 === 0 ? "w-14" : index % 3 === 1 ? "w-16" : "w-20"
            }`}
          />
        ))}
      </div>
    );
  }

  if (!tags?.length) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mt-auto">
      {tags?.map((tag) => (
        <button
          key={tag.documentTag.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFilter({
              tags: [tag.documentTag.id],
            });
          }}
        >
          <Badge
            variant="secondary"
            className="whitespace-nowrap shrink-0 text-[10px] hover:bg-secondary/80"
          >
            {tag.documentTag.name}
          </Badge>
        </button>
      ))}
    </div>
  );
}
