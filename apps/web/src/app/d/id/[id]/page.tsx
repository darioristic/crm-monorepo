"use client";

import type { DeliveryNoteWithRelations } from "@crm/types";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeliveryNotePublicView } from "../../[token]/delivery-note-public-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default function DeliveryNoteByIdPage({ params }: Props) {
  const { id } = use(params);
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNoteWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDeliveryNote() {
      try {
        // Use public API endpoint that doesn't require authentication
        const response = await fetch(`/api/delivery-notes/public/${id}`);

        if (!response.ok) {
          throw new Error("Delivery note not found");
        }

        const data = await response.json();
        setDeliveryNote(data.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load delivery note"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchDeliveryNote();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen dotted-bg p-4">
        <div className="flex flex-col w-full max-w-[595px] py-6">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-[842px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !deliveryNote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 dotted-bg">
        <h2 className="text-xl font-semibold mb-2">Delivery Note Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The delivery note you're looking for doesn't exist or has been removed.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales/delivery-notes">Go to Delivery Notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <DeliveryNotePublicView deliveryNote={deliveryNote} token={id} />;
}
