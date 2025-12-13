"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Download, Eye, FileText, Loader2, Pencil, Plus, Share2, Upload } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { documentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  documentId: string;
};

const actionIcons: Record<string, React.ElementType> = {
  CREATE_DOCUMENT: Plus,
  UPDATE_DOCUMENT: Pencil,
  VIEW_DOCUMENT: Eye,
  DOWNLOAD_DOCUMENT: Download,
  PROCESS_DOCUMENT: FileText,
  CREATE_DOCUMENT_SHARE: Share2,
  DELETE_DOCUMENT_SHARE: Share2,
  DOCUMENT_UPLOADED: Upload,
};

const actionLabels: Record<string, string> = {
  CREATE_DOCUMENT: "Created document",
  UPDATE_DOCUMENT: "Updated document",
  VIEW_DOCUMENT: "Viewed document",
  DOWNLOAD_DOCUMENT: "Downloaded document",
  PROCESS_DOCUMENT: "Processed document",
  CREATE_DOCUMENT_SHARE: "Created share link",
  DELETE_DOCUMENT_SHARE: "Removed share link",
  DOCUMENT_UPLOADED: "Uploaded document",
  DOCUMENT_FAILED: "Processing failed",
};

export function DocumentActivity({ documentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["document-activity", documentId],
    queryFn: async () => {
      const response = await documentsApi.getActivity(documentId, { pageSize: 10 });
      return response.data ?? { activities: [], totalCount: 0 };
    },
    enabled: !!documentId,
    staleTime: 30000, // 30 seconds
  });

  const hasActivity = data?.activities && data.activities.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if no activity
  if (!hasActivity) {
    return null;
  }

  return (
    <Accordion className="relative" type="single" collapsible>
      <AccordionItem value="recent-activity" className="border-b-0">
        <AccordionTrigger className="text-sm font-medium py-2">
          Recent Activity ({data.totalCount})
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            {data.activities.map((activity) => {
              const Icon = actionIcons[activity.action] || Eye;
              const label = actionLabels[activity.action] || activity.action;

              return (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                      "bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {activity.userName || "Anonymous"}
                      </span>
                      <span className="text-muted-foreground truncate">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
            {data.totalCount > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{data.totalCount - 10} more activities
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
