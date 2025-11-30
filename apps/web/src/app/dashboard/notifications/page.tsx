"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BellIcon,
  ClockIcon,
  CheckCheckIcon,
  FileTextIcon,
  DollarSignIcon,
  FolderIcon,
  ListTodoIcon,
  UsersIcon,
  AlertTriangleIcon,
  InfoIcon,
  CheckCircleIcon,
  Trash2Icon,
  RefreshCwIcon,
  FilterIcon,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import type { Notification as NotificationType } from "@crm/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

function getNotificationIcon(type: NotificationType["type"]) {
  switch (type) {
    case "invoice_created":
    case "invoice_paid":
    case "invoice_overdue":
      return <FileTextIcon className="h-4 w-4" />;
    case "quote_created":
    case "quote_accepted":
    case "quote_rejected":
      return <DollarSignIcon className="h-4 w-4" />;
    case "project_created":
    case "project_completed":
      return <FolderIcon className="h-4 w-4" />;
    case "task_assigned":
    case "task_completed":
    case "task_overdue":
      return <ListTodoIcon className="h-4 w-4" />;
    case "lead_assigned":
    case "deal_won":
    case "deal_lost":
      return <UsersIcon className="h-4 w-4" />;
    case "warning":
      return <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <AlertTriangleIcon className="h-4 w-4 text-red-500" />;
    case "success":
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    default:
      return <InfoIcon className="h-4 w-4" />;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { pageSize: 50 };
      if (filter === "unread") params.isRead = false;
      if (filter === "read") params.isRead = true;

      const result = await notificationsApi.getAll(params);
      if (result.success && result.data) {
        setNotifications(result.data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    const result = await notificationsApi.markAsRead(id);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await notificationsApi.markAllAsRead();
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    }
  };

  const handleDelete = async (id: string) => {
    const result = await notificationsApi.delete(id);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Notification deleted");
    }
  };

  const handleDeleteSelected = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      notificationsApi.delete(id)
    );
    await Promise.all(promises);
    setNotifications((prev) =>
      prev.filter((n) => !selectedIds.has(n.id))
    );
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} notifications deleted`);
  };

  const handleMarkSelectedAsRead = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      notificationsApi.markAsRead(id)
    );
    await Promise.all(promises);
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, isRead: true } : n))
    );
    setSelectedIds(new Set());
    toast.success("Selected notifications marked as read");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Manage your notifications and stay up to date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchNotifications}>
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-base">All Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filter}
                onValueChange={(value: any) => setFilter(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheckIcon className="mr-2 h-4 w-4" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkSelectedAsRead}
                >
                  <CheckCheckIcon className="mr-2 h-4 w-4" />
                  Mark as read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={handleDeleteSelected}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellIcon className="text-muted-foreground mb-4 h-16 w-16" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-muted-foreground">
                You&apos;re all caught up! Check back later.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-2">
                <Checkbox
                  checked={selectedIds.size === notifications.length && notifications.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-muted-foreground text-sm">Select all</span>
              </div>

              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                    !notification.isRead ? "bg-muted/30" : ""
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(notification.id)}
                    onCheckedChange={() => toggleSelect(notification.id)}
                  />
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      !notification.isRead
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4
                          className={`truncate ${
                            !notification.isRead
                              ? "font-semibold"
                              : "font-medium"
                          }`}
                        >
                          {notification.title}
                        </h4>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {notification.message}
                        </p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                          <ClockIcon className="h-3 w-3" />
                          {formatDate(notification.createdAt)}
                          {!notification.isRead && (
                            <Badge variant="secondary" className="ml-2">
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <span className="sr-only">Actions</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!notification.isRead && (
                            <DropdownMenuItem
                              onClick={() => handleMarkAsRead(notification.id)}
                            >
                              <CheckCheckIcon className="mr-2 h-4 w-4" />
                              Mark as read
                            </DropdownMenuItem>
                          )}
                          {notification.link && (
                            <DropdownMenuItem asChild>
                              <a href={notification.link}>View details</a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2Icon className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

