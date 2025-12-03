"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This page redirects to the delivery notes page with the create sheet open
export default function NewDeliveryNotePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/sales/delivery-notes?type=create");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
