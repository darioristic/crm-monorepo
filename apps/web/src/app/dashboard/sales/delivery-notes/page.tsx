"use client";

import { PlusCircledIcon } from "@radix-ui/react-icons";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DeliveryNotesDataTable } from "@/components/sales/delivery-notes-data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeliveryNoteSettings } from "@/hooks/use-delivery-note-settings";

// Dynamic import for DeliveryNoteSheet to reduce initial bundle size
const DeliveryNoteSheet = dynamic(
  () =>
    import("@/components/delivery-note/delivery-note-sheet").then((mod) => ({
      default: mod.DeliveryNoteSheet,
    })),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

export default function DeliveryNotesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  const { defaultSettings } = useDeliveryNoteSettings();

  const handleCreateDeliveryNote = () => {
    router.push(`${pathname}?type=create`);
  };

  const handleDeliveryNoteCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground">Track and manage product deliveries</p>
        </div>
        <Button onClick={handleCreateDeliveryNote}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Delivery Note
        </Button>
      </div>
      <DeliveryNotesDataTable refreshSignal={refreshKey} />
      <DeliveryNoteSheet
        defaultSettings={defaultSettings}
        onDeliveryNoteCreated={handleDeliveryNoteCreated}
      />
    </div>
  );
}
