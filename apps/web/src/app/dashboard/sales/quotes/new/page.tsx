"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// This page redirects to the quotes page with the create sheet open
export default function NewQuotePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/sales/quotes?type=create");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
