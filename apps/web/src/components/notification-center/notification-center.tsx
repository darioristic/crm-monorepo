"use client";

import { Bell, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Notification, useNotifications } from "@/hooks/use-notifications";
import { EmptyState } from "./empty-state";
import { NotificationItem } from "./notification-item";

interface NotificationCenterProps {
  initialNotifications?: Notification[];
  settingsLink?: string;
}

export function NotificationCenter({
  initialNotifications = [],
  settingsLink = "/settings/notifications",
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    notifications,
    archived,
    hasUnseenNotifications,
    isLoading,
    markAllAsRead,
    archive,
    archiveAll,
  } = useNotifications({ initialNotifications });

  useEffect(() => {
    if (isOpen && hasUnseenNotifications) {
      markAllAsRead();
    }
  }, [isOpen, hasUnseenNotifications, markAllAsRead]);

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-8 h-8 flex items-center relative"
        >
          {hasUnseenNotifications && (
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full absolute top-0 right-0" />
          )}
          <Bell className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="h-[535px] w-screen md:w-[400px] p-0 overflow-hidden relative"
        align="end"
        sideOffset={10}
      >
        <Tabs defaultValue="inbox">
          <TabsList className="w-full justify-between bg-transparent border-b rounded-none py-6">
            <div className="flex">
              <TabsTrigger value="inbox" className="font-normal">
                Inbox
              </TabsTrigger>
              <TabsTrigger value="archive" className="font-normal">
                Archive
              </TabsTrigger>
            </div>
            <Link href={settingsLink} onClick={() => setIsOpen(false)}>
              <Button variant="ghost" size="icon" className="rounded-full mr-2">
                <Settings className="size-4" />
              </Button>
            </Link>
          </TabsList>

          <TabsContent value="inbox" className="relative mt-0">
            {!isLoading && !notifications.length && (
              <EmptyState description="No new notifications" />
            )}

            {!isLoading && notifications.length > 0 && (
              <ScrollArea className="pb-12 h-[485px]">
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onArchive={archive}
                      onClose={() => setIsOpen(false)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {!isLoading && notifications.length > 0 && (
              <div className="h-12 w-full absolute bottom-0 flex items-center justify-center border-t bg-background">
                <Button variant="ghost" onClick={archiveAll}>
                  Archive all
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="archive" className="mt-0">
            {!isLoading && !archived.length && <EmptyState description="Nothing in the archive" />}

            {!isLoading && archived.length > 0 && (
              <ScrollArea className="h-[490px]">
                <div className="divide-y">
                  {archived.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClose={() => setIsOpen(false)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
