"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Inbox,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Receipt,
  CreditCard,
  Trash2,
  Eye,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { inboxApi, type InboxItem, type InboxStatus } from "@/lib/api/inbox";
import { InboxItemSheet } from "./inbox-item-sheet";
import { formatCurrency } from "@/lib/utils";

const statusConfig: Record<
  InboxStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  new: { label: "New", color: "bg-blue-500", icon: AlertCircle },
  processing: { label: "Processing", color: "bg-yellow-500", icon: Clock },
  analyzing: { label: "Analyzing", color: "bg-purple-500", icon: Clock },
  pending: { label: "Pending", color: "bg-orange-500", icon: Clock },
  suggested_match: { label: "Match Found", color: "bg-green-500", icon: CheckCircle2 },
  no_match: { label: "No Match", color: "bg-gray-500", icon: XCircle },
  done: { label: "Done", color: "bg-green-600", icon: CheckCircle2 },
  archived: { label: "Archived", color: "bg-gray-400", icon: FileText },
  deleted: { label: "Deleted", color: "bg-red-500", icon: Trash2 },
};

const typeIcons: Record<string, React.ElementType> = {
  invoice: FileText,
  expense: CreditCard,
  receipt: Receipt,
  other: FileText,
};

export function InboxView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InboxStatus | "all">("all");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch inbox items
  const { data, isLoading, error } = useQuery({
    queryKey: ["inbox", search, statusFilter],
    queryFn: () =>
      inboxApi.getAll({
        q: search || null,
        status: statusFilter === "all" ? null : statusFilter,
        pageSize: 50,
      }),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["inbox-stats"],
    queryFn: () => inboxApi.getStats(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => inboxApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Item deleted");
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  // Update mutation (for archiving)
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InboxStatus }) =>
      inboxApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Item updated");
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });

  const handleItemClick = (item: InboxItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    updateMutation.mutate({ id, status: "archived" });
  };

  const items = data?.data || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Magic Inbox</h1>
          <p className="text-muted-foreground">
            Documents automatically matched with your transactions
          </p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matches Found</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.suggestedMatches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Done</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.doneItems}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inbox..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as InboxStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="suggested_match">Match Found</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="no_match">No Match</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inbox List */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">Failed to load inbox</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["inbox"] })}
            >
              Try Again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No items in inbox</p>
            <p className="text-muted-foreground">
              Upload documents or connect your email to get started
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => {
              const status = statusConfig[item.status];
              const StatusIcon = status.icon;
              const TypeIcon = typeIcons[item.contentType?.includes("invoice") ? "invoice" : "expense"];

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleItemClick(item)}
                >
                  {/* Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                    <TypeIcon className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {item.displayName || item.fileName || "Unknown"}
                      </p>
                      {item.suggestion && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(item.suggestion.confidenceScore * 100)}% match
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {item.amount && (
                        <span>{formatCurrency(item.amount, item.currency || "RSD")}</span>
                      )}
                      {item.date && (
                        <>
                          <span>•</span>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                        </>
                      )}
                      {item.senderEmail && (
                        <>
                          <span>•</span>
                          <span className="truncate">{item.senderEmail}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 whitespace-nowrap"
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>

                  {/* Time */}
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleArchive(e, item.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(e, item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Sheet */}
      <InboxItemSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["inbox"] });
          queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
        }}
      />
    </div>
  );
}
