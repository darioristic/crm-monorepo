"use client";

import { useCallback, useMemo, useState } from "react";

export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationType =
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  | "order_created"
  | "order_updated"
  | "quote_created"
  | "quote_accepted"
  | "customer_created"
  | "document_uploaded"
  | "system"
  | string;

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  status: NotificationStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

interface UseNotificationsOptions {
  initialNotifications?: Notification[];
  onMarkAsRead?: (id: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onArchiveAll?: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    initialNotifications = [],
    onMarkAsRead,
    onMarkAllAsRead,
    onArchive,
    onArchiveAll,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => n.status === "unread" || n.status === "read"),
    [notifications]
  );

  const archivedNotifications = useMemo(
    () => notifications.filter((n) => n.status === "archived"),
    [notifications]
  );

  const hasUnseenNotifications = useMemo(
    () => notifications.some((n) => n.status === "unread"),
    [notifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "unread").length,
    [notifications]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        setIsLoading(true);
        if (onMarkAsRead) {
          await onMarkAsRead(id);
        }
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "read" as const, readAt: new Date().toISOString() } : n
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to mark as read"));
      } finally {
        setIsLoading(false);
      }
    },
    [onMarkAsRead]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      setIsLoading(true);
      if (onMarkAllAsRead) {
        await onMarkAllAsRead();
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.status === "unread"
            ? { ...n, status: "read" as const, readAt: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to mark all as read"));
    } finally {
      setIsLoading(false);
    }
  }, [onMarkAllAsRead]);

  const archive = useCallback(
    async (id: string) => {
      try {
        setIsLoading(true);
        if (onArchive) {
          await onArchive(id);
        }
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "archived" as const } : n))
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to archive"));
      } finally {
        setIsLoading(false);
      }
    },
    [onArchive]
  );

  const archiveAll = useCallback(async () => {
    try {
      setIsLoading(true);
      if (onArchiveAll) {
        await onArchiveAll();
      }
      setNotifications((prev) =>
        prev.map((n) => (n.status !== "archived" ? { ...n, status: "archived" as const } : n))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to archive all"));
    } finally {
      setIsLoading(false);
    }
  }, [onArchiveAll]);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "createdAt" | "status">) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        status: "unread",
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNotification, ...prev]);
      return newNotification;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications: unreadNotifications,
    archived: archivedNotifications,
    allNotifications: notifications,
    hasUnseenNotifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    archive,
    archiveAll,
    addNotification,
    removeNotification,
    clearAll,
    setNotifications,
  };
}

export function getNotificationIcon(type: NotificationType): string {
  const iconMap: Record<string, string> = {
    invoice_created: "FileText",
    invoice_sent: "Send",
    invoice_paid: "CheckCircle",
    invoice_overdue: "AlertCircle",
    order_created: "ShoppingCart",
    order_updated: "RefreshCw",
    quote_created: "FileText",
    quote_accepted: "CheckCircle",
    customer_created: "UserPlus",
    document_uploaded: "Upload",
    system: "Bell",
  };
  return iconMap[type] || "Bell";
}

export function getNotificationLink(
  type: NotificationType,
  metadata?: Record<string, unknown>
): string | null {
  const recordId = metadata?.recordId as string | undefined;

  if (!recordId) return null;

  const linkMap: Record<string, string> = {
    invoice_created: `/invoices/${recordId}`,
    invoice_sent: `/invoices/${recordId}`,
    invoice_paid: `/invoices/${recordId}`,
    invoice_overdue: `/invoices/${recordId}`,
    order_created: `/orders/${recordId}`,
    order_updated: `/orders/${recordId}`,
    quote_created: `/quotes/${recordId}`,
    quote_accepted: `/quotes/${recordId}`,
    customer_created: `/accounts/organizations?organizationId=${recordId}`,
    document_uploaded: `/vault/${recordId}`,
  };

  return linkMap[type] || null;
}
