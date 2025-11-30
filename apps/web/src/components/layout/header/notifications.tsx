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
} from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { notificationsApi } from "@/lib/api";
import type { Notification as NotificationType } from "@crm/types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

const Notifications = () => {
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifResult, countResult] = await Promise.all([
        notificationsApi.getAll({ pageSize: 10 }),
        notificationsApi.getUnreadCount(),
      ]);

      if (notifResult.success && notifResult.data) {
        setNotifications(notifResult.data.notifications || []);
      }
      if (countResult.success && countResult.data) {
        setUnreadCount(countResult.data.count);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notification: NotificationType) => {
    if (notification.isRead) return;

    const result = await notificationsApi.markAsRead(notification.id);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await notificationsApi.markAllAsRead();
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative">
          <BellIcon className={unreadCount > 0 ? "animate-tada" : ""} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isMobile ? "center" : "end"}
        className="ms-4 w-80 p-0"
      >
        <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheckIcon className="mr-1 h-3 w-3" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BellIcon className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">No notifications</p>
              <p className="text-muted-foreground text-xs">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`group flex cursor-pointer items-start gap-3 rounded-none border-b px-4 py-3 ${
                  !notification.isRead ? "bg-muted/50" : ""
                }`}
                onClick={() => handleMarkAsRead(notification)}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    !notification.isRead
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div
                    className={`truncate text-sm ${
                      !notification.isRead ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {notification.title}
                  </div>
                  <div className="text-muted-foreground line-clamp-2 text-xs">
                    {notification.message}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <ClockIcon className="h-3 w-3" />
                    {formatTimeAgo(notification.createdAt)}
                  </div>
                </div>
                {!notification.isRead && (
                  <div className="flex-0 mt-1">
                    <span className="bg-primary block h-2 w-2 rounded-full" />
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            asChild
            onClick={() => setIsOpen(false)}
          >
            <Link href="/dashboard/notifications">
              View all notifications
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
