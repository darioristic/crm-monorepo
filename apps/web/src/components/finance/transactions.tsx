"use client";

import { CreditCardIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard";
import { cn } from "@/lib/utils";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getInitials(text: string): string {
  return text
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const colors = [
  "bg-pink-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-green-600",
  "bg-red-500",
  "bg-indigo-500",
];

export default function Transactions() {
  const { data, isLoading, error } = useFinanceDashboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error || "No transactions available"}
        </CardContent>
      </Card>
    );
  }

  const { transactions } = data;

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CreditCardIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No transactions recorded yet</p>
          <p className="text-sm mt-2">Payments will appear here when invoices are paid</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <a href="/sales/invoices">View All</a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Transaction</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-end">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => {
              const isIncome = transaction.type === "income";
              const amount = isIncome ? transaction.amount : -transaction.amount;
              const color = colors[index % colors.length];

              return (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className={cn("text-white", color)}>
                          {transaction.companyName
                            ? getInitials(transaction.companyName)
                            : getInitials(transaction.description)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px]">{transaction.description}</span>
                        {transaction.companyName && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {transaction.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell suppressHydrationWarning>{formatDate(transaction.date)}</TableCell>
                  <TableCell>
                    <Badge variant={isIncome ? "default" : "outline"}>
                      {isIncome ? "Income" : "Expense"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-end ${amount > 0 ? "text-emerald-600" : "text-red-600"}`}
                    suppressHydrationWarning
                  >
                    {amount > 0 ? "+" : ""}
                    {formatCurrency(Math.abs(amount))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
