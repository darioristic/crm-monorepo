// Frontend notification definitions
export interface NotificationDisplayInfo {
  type: string;
  name: string;
  description: string;
}

// Helper function to get display info for a notification type
export function getNotificationDisplayInfo(type: string): NotificationDisplayInfo | undefined {
  // Simple mapping for common notification types
  const notificationMap: Record<string, NotificationDisplayInfo> = {
    "invoice.created": {
      type: "invoice.created",
      name: "Invoice Created",
      description: "Get notified when a new invoice is created",
    },
    "invoice.paid": {
      type: "invoice.paid",
      name: "Invoice Paid",
      description: "Get notified when an invoice is paid",
    },
    "transaction.created": {
      type: "transaction.created",
      name: "Transaction Created",
      description: "Get notified when a new transaction is created",
    },
    "team.member.invited": {
      type: "team.member.invited",
      name: "Team Member Invited",
      description: "Get notified when a team member is invited",
    },
    "team.member.joined": {
      type: "team.member.joined",
      name: "Team Member Joined",
      description: "Get notified when a team member joins",
    },
  };

  return notificationMap[type];
}

// Helper function to get display info with fallback
export function getNotificationDisplayInfoWithFallback(type: string): NotificationDisplayInfo {
  const displayInfo = getNotificationDisplayInfo(type);

  if (displayInfo) {
    return displayInfo;
  }

  // Fallback for unknown notification types
  return {
    type,
    name: type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `Notifications for ${type.replace(/_/g, " ")}`,
  };
}

// Helper function to get category display title
export function getCategoryDisplayTitle(category: string): string {
  const categoryMap: Record<string, string> = {
    invoices: "Invoices",
    transactions: "Transactions",
    team: "Team",
    general: "General",
    other: "Other",
  };

  return (
    categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ")
  );
}
