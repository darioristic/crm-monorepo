"use client";

import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type InboxItem, inboxApi } from "@/lib/api/inbox";
import { formatCurrency } from "@/lib/utils";

interface InboxItemSheetProps {
  item: InboxItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function InboxItemSheet({ item, open, onOpenChange, onUpdate }: InboxItemSheetProps) {
  const [_isProcessing, _setIsProcessing] = useState(false);

  // Confirm match mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!item?.suggestion) return;
      return inboxApi.confirmMatch(item.id, item.suggestion.transactionId, item.suggestion.id);
    },
    onSuccess: () => {
      toast.success("Match confirmed");
      onUpdate();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to confirm match");
    },
  });

  // Decline match mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!item?.suggestion) return;
      return inboxApi.declineMatch(item.id, item.suggestion.id);
    },
    onSuccess: () => {
      toast.success("Match declined");
      onUpdate();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to decline match");
    },
  });

  if (!item) return null;

  const hasMatch = item.suggestion && item.status === "suggested_match";
  const confidencePercent = item.suggestion ? Math.round(item.suggestion.confidenceScore * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item.displayName || item.fileName || "Document"}</SheetTitle>
          <SheetDescription>{item.senderEmail && `From: ${item.senderEmail}`}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            {item.status === "suggested_match" ? (
              <Badge className="bg-green-500">Match Found</Badge>
            ) : item.status === "done" ? (
              <Badge className="bg-green-600">Done</Badge>
            ) : item.status === "pending" ? (
              <Badge variant="outline">Pending</Badge>
            ) : item.status === "no_match" ? (
              <Badge variant="secondary">No Match</Badge>
            ) : (
              <Badge variant="outline">{item.status}</Badge>
            )}
          </div>

          {/* Match Suggestion Card */}
          {hasMatch && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Match Suggestion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Confidence</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${confidencePercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{confidencePercent}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Match Type</span>
                  <Badge variant="outline">{item.suggestion?.matchType}</Badge>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending || declineMutation.isPending}
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Confirm Match
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => declineMutation.mutate()}
                    disabled={confirmMutation.isPending || declineMutation.isPending}
                  >
                    {declineMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Details */}
          <div className="space-y-4">
            <h3 className="font-semibold">Document Details</h3>

            <div className="grid gap-3">
              {item.amount && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="ml-auto font-medium">
                    {formatCurrency(item.amount, item.currency || "RSD")}
                  </span>
                </div>
              )}

              {item.date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="ml-auto">{format(new Date(item.date), "PP")}</span>
                </div>
              )}

              {item.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Website</span>
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {new URL(item.website).hostname}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {item.senderEmail && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">From</span>
                  <span className="ml-auto truncate max-w-[200px]">{item.senderEmail}</span>
                </div>
              )}

              {item.fileName && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">File</span>
                  <span className="ml-auto truncate max-w-[200px]">{item.fileName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="space-y-2">
              <h3 className="font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}

          {/* Source */}
          {item.inboxAccount && (
            <div className="space-y-2">
              <h3 className="font-semibold">Source</h3>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{item.inboxAccount.email}</span>
                <Badge variant="outline" className="text-xs">
                  {item.inboxAccount.provider}
                </Badge>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              Added {format(new Date(item.createdAt), "PPp")}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
