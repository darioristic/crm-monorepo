"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type DocumentTag, documentTagAssignmentsApi, documentTagsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type DroppableTagProps = {
  tag: DocumentTag;
  onDrop: (documentId: string, tagId: string) => void;
};

function DroppableTag({ tag, onDrop }: DroppableTagProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const documentId = e.dataTransfer.getData("application/x-document-id");
    if (documentId) {
      onDrop(documentId, tag.id);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200 cursor-default",
        "hover:bg-muted",
        isDragOver && "bg-primary/10 ring-2 ring-primary ring-inset scale-105"
      )}
    >
      <Tag className="h-4 w-4 text-muted-foreground" />
      <span>{tag.name}</span>
    </div>
  );
}

export function DroppableTagList() {
  const queryClient = useQueryClient();

  const { data: tags, isLoading } = useQuery({
    queryKey: ["document-tags"],
    queryFn: async () => {
      const response = await documentTagsApi.getAll();
      return response.data ?? [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ documentId, tagId }: { documentId: string; tagId: string }) =>
      documentTagAssignmentsApi.assign({ documentId, tagId }),
    onSuccess: (_result, { tagId }) => {
      const tag = tags?.find((t) => t.id === tagId);
      toast.success(`Tagged with "${tag?.name || "tag"}"`);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document"] });
    },
    onError: () => {
      toast.error("Failed to assign tag");
    },
  });

  const handleDrop = (documentId: string, tagId: string) => {
    assignMutation.mutate({ documentId, tagId });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-2">Loading tags...</div>;
  }

  if (!tags?.length) {
    return (
      <div className="text-sm text-muted-foreground p-2">
        No tags available. Create tags to organize your documents.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground uppercase tracking-wider px-3 py-1">
        Drag documents to tag
      </div>
      {tags.map((tag) => (
        <DroppableTag key={tag.id} tag={tag} onDrop={handleDrop} />
      ))}
    </div>
  );
}
