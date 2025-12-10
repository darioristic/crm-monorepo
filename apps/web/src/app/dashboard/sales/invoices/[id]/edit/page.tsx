"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface PageProps {
  params: Promise<{ id: string }>;
}

// This page redirects to the invoices list with the edit sheet open
export default function EditInvoicePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/sales/invoices?type=edit&invoiceId=${id}`);
  }, [router, id]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="animate-pulse text-muted-foreground">Loading editor...</div>
    </div>
  );
}
