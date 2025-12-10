"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// This page redirects to the delivery notes list with the edit sheet open
export default function EditDeliveryNotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/dashboard/sales/delivery-notes?type=edit&deliveryNoteId=${id}`);
  }, [router, id]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
