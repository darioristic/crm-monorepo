"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { request } from "@/lib/api";

type BankAccount = {
  id: string;
  accountName?: string;
  bankName?: string;
  iban?: string;
  balance?: number;
  currency?: string;
};

function BankAccountListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function BankAccountList() {
  const { data, isLoading } = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: async () => {
      const response = await request("/api/v1/connected-accounts");
      return (
        response.success && response.data ? (response.data as BankAccount[]) : []
      ) as BankAccount[];
    },
  });
  const accounts: BankAccount[] = Array.isArray(data) ? data : [];

  if (isLoading) {
    return <BankAccountListSkeleton />;
  }

  if (accounts.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No bank accounts connected.</div>;
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div key={account.id} className="border p-4 rounded">
          <div className="font-medium">{account.accountName}</div>
          {account.bankName && (
            <div className="text-sm text-muted-foreground">{account.bankName}</div>
          )}
          {account.iban && (
            <div className="text-sm text-muted-foreground">IBAN: {account.iban}</div>
          )}
          <div className="text-sm font-medium mt-2">
            Balance: {account.balance} {account.currency}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConnectedAccounts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>Manage bank accounts, update or connect new ones.</CardDescription>
      </CardHeader>

      <Suspense fallback={<BankAccountListSkeleton />}>
        <BankAccountList />
      </Suspense>

      <CardFooter className="flex justify-between">
        <div />

        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add account
        </Button>
      </CardFooter>
    </Card>
  );
}
