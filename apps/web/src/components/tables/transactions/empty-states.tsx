"use client";

import { CreditCard, FileSearch, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NoTransactions() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <CreditCard className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">No transactions yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Start by recording your first payment or connect your bank account to import transactions
        automatically.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/dashboard/sales/invoices">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function NoResults() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileSearch className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">No results found</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Try adjusting your search or filter criteria to find what you're looking for.
      </p>
    </div>
  );
}
