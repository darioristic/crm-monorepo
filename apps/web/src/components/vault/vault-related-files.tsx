"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useDocumentParams } from "@/hooks/use-document-params";
import { documentsApi } from "@/lib/api";
import { VaultItem } from "./vault-item";
import { VaultRelatedFilesSkeleton } from "./vault-related-files-skeleton";

export function VaultRelatedFiles() {
  const { params } = useDocumentParams();

  const { data, isLoading } = useQuery({
    queryKey: ["related-documents", params.documentId],
    queryFn: async () => {
      if (!params.documentId) return [];
      const response = await documentsApi.getRelated(params.documentId, {
        threshold: 0.3,
        limit: 6,
      });
      return response.data ?? [];
    },
    enabled: !!params.documentId,
  });

  if (isLoading) {
    return <VaultRelatedFilesSkeleton />;
  }

  if (!data?.length) {
    return null;
  }

  return (
    <Accordion className="relative mt-4" type="single" collapsible>
      <AccordionItem value="related-files" className="border-b-0">
        <AccordionTrigger className="text-sm font-medium py-2">
          Related Files ({data.length})
        </AccordionTrigger>
        <AccordionContent>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-4">
              {data.map((document) => (
                <div key={document.id} className="w-[160px] flex-shrink-0">
                  <VaultItem data={document} small />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
