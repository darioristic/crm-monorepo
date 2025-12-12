"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Archive,
  Bell,
  CheckCircle,
  FileText,
  RefreshCw,
  Send,
  ShoppingCart,
  Upload,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Notification, NotificationType } from "@/hooks/use-notifications";
import { getNotificationLink } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onArchive?: (id: string) => void;
  onClose?: () => void;
}

const iconMap: Record<string, React.ElementType> = {
  invoice_created: FileText,
  invoice_sent: Send,
  invoice_paid: CheckCircle,
  invoice_overdue: AlertCircle,
  order_created: ShoppingCart,
  order_updated: RefreshCw,
  quote_created: FileText,
  quote_accepted: CheckCircle,
  customer_created: UserPlus,
  document_uploaded: Upload,
  system: Bell,
};

function getIcon(type: NotificationType) {
  const Icon = iconMap[type] || Bell;
  return <Icon className="size-4" />;
}

export function NotificationItem({ notification, onArchive, onClose }: NotificationItemProps) {
  const link = getNotificationLink(notification.type, notification.metadata);
  const isUnread = notification.status === "unread";

  const content = (
    <div className="flex items-start space-x-4 flex-1">
      <div className="h-9 w-9 flex items-center justify-center border rounded-full shrink-0">
        {getIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm truncate", isUnread && "font-medium")}>{notification.title}</p>
        <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );

  const archiveButton = onArchive && notification.status !== "archived" && (
    <Button
      size="icon"
      variant="ghost"
      className="rounded-full shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onArchive(notification.id);
      }}
      title="Archive"
    >
      <Archive className="size-4" />
    </Button>
  );

  if (link) {
    return (
      <Link
        href={link}
        onClick={onClose}
        className="group flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        {content}
        {archiveButton}
      </Link>
    );
  }

  return (
    <div className="group flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
      {content}
      {archiveButton}
    </div>
  );
}
