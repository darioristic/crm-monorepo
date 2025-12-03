"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { DeliveryNotesDataTable } from "@/components/sales/delivery-notes-data-table";
import { DeliveryNoteSheet } from "@/components/delivery-note/delivery-note-sheet";

function DeliveryNotesPageContent() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNewDeliveryNote = () => {
    router.push(`${pathname}?type=create`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground">
            Track and manage product deliveries
          </p>
        </div>
        <Button onClick={handleNewDeliveryNote}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Delivery Note
        </Button>
      </div>
      <DeliveryNotesDataTable />

      {/* Delivery Note Sheet for URL-based opening */}
      <DeliveryNoteSheet />
    </div>
  );
}

export default function DeliveryNotesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <DeliveryNotesPageContent />
    </Suspense>
  );
}
