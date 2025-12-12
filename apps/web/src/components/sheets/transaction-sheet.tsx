"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { TransactionDetails } from "../transactions/transaction-details";

export function TransactionSheet() {
  const { transactionId, setParams } = useTransactionParams();
  const isOpen = Boolean(transactionId);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setParams({ transactionId: null });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent style={{ maxWidth: 540 }} title="Transaction Details">
        <TransactionDetails />
      </SheetContent>
    </Sheet>
  );
}
