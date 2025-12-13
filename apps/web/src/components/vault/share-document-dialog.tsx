"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow } from "date-fns";
import {
  Calendar,
  Check,
  Copy,
  Eye,
  Link2,
  Loader2,
  Lock,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { type DocumentShare, documentSharesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  documentId: string;
  documentTitle?: string | null;
  trigger?: React.ReactNode;
};

export function ShareDocumentDialog({ documentId, documentTitle, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [copiedToken, copy] = useCopyToClipboard();

  // Form state for new share
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(addDays(new Date(), 7));
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [maxViewsEnabled, setMaxViewsEnabled] = useState(false);
  const [maxViews, setMaxViews] = useState(10);

  const queryClient = useQueryClient();

  // Fetch existing shares
  const { data: shares, isLoading } = useQuery({
    queryKey: ["document-shares", documentId],
    queryFn: async () => {
      const response = await documentSharesApi.getForDocument(documentId);
      return response.data ?? [];
    },
    enabled: isOpen,
  });

  // Create share mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const options: {
        expiresAt?: string;
        password?: string;
        maxViews?: number;
      } = {};

      if (expiresEnabled && expiresAt) {
        options.expiresAt = expiresAt.toISOString();
      }
      if (passwordEnabled && password) {
        options.password = password;
      }
      if (maxViewsEnabled) {
        options.maxViews = maxViews;
      }

      return documentSharesApi.create(documentId, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares", documentId] });
      resetForm();
    },
  });

  // Delete share mutation
  const deleteMutation = useMutation({
    mutationFn: (shareId: string) => documentSharesApi.delete(shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares", documentId] });
    },
  });

  // Toggle share mutation
  const toggleMutation = useMutation({
    mutationFn: ({ shareId, isActive }: { shareId: string; isActive: boolean }) =>
      documentSharesApi.toggle(shareId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-shares", documentId] });
    },
  });

  const resetForm = () => {
    setShowNewForm(false);
    setExpiresEnabled(false);
    setExpiresAt(addDays(new Date(), 7));
    setPasswordEnabled(false);
    setPassword("");
    setMaxViewsEnabled(false);
    setMaxViews(10);
  };

  const handleCopyLink = async (token: string) => {
    const fullUrl = `${window.location.origin}/share/${token}`;
    await copy(fullUrl);
  };

  const getShareUrl = (token: string) => `${window.location.origin}/share/${token}`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className="rounded-full h-7 w-7 bg-background">
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            {documentTitle
              ? `Create and manage share links for "${documentTitle}"`
              : "Create and manage share links for this document"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing shares */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shares && shares.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Active Links</h4>
              {shares.map((share) => (
                <ShareLinkItem
                  key={share.id}
                  share={share}
                  onCopy={() => handleCopyLink(share.token)}
                  onToggle={() =>
                    toggleMutation.mutate({ shareId: share.id, isActive: !share.isActive })
                  }
                  onDelete={() => deleteMutation.mutate(share.id)}
                  isCopied={copiedToken === getShareUrl(share.token)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          ) : !showNewForm ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No share links yet</p>
            </div>
          ) : null}

          {/* New share form */}
          {showNewForm ? (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">New Share Link</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Expiration */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Expiration</Label>
                  <p className="text-xs text-muted-foreground">Set an expiration date</p>
                </div>
                <Switch checked={expiresEnabled} onCheckedChange={setExpiresEnabled} />
              </div>

              {expiresEnabled && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expiresAt && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}

              {/* Password */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Password Protection</Label>
                  <p className="text-xs text-muted-foreground">Require password to view</p>
                </div>
                <Switch checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
              </div>

              {passwordEnabled && (
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}

              {/* Max Views */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">View Limit</Label>
                  <p className="text-xs text-muted-foreground">Limit number of views</p>
                </div>
                <Switch checked={maxViewsEnabled} onCheckedChange={setMaxViewsEnabled} />
              </div>

              {maxViewsEnabled && (
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxViews}
                  onChange={(e) => setMaxViews(parseInt(e.target.value, 10) || 1)}
                />
              )}

              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || (passwordEnabled && !password)}
                className="w-full"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Create Link
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowNewForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Link
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareLinkItem({
  share,
  onCopy,
  onToggle,
  onDelete,
  isCopied,
  isDeleting,
}: {
  share: DocumentShare;
  onCopy: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isCopied: boolean;
  isDeleting: boolean;
}) {
  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
  const isMaxViewsReached = share.maxViews !== null && share.viewCount >= share.maxViews;
  const isDisabled = !share.isActive || isExpired || isMaxViewsReached;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg",
        isDisabled && "opacity-60"
      )}
    >
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
            {share.token.slice(0, 20)}...
          </code>
          {share.expiresAt && (
            <span className="text-xs text-muted-foreground flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {isExpired
                ? "Expired"
                : formatDistanceToNow(new Date(share.expiresAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center">
            <Eye className="h-3 w-3 mr-1" />
            {share.viewCount}
            {share.maxViews !== null && ` / ${share.maxViews}`}
          </span>
          {share.expiresAt && !share.expiresAt && (
            <span className="flex items-center">
              <Lock className="h-3 w-3 mr-1" />
              Protected
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCopy}
          disabled={isDisabled}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          {share.isActive ? (
            <Link2 className="h-3.5 w-3.5" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
