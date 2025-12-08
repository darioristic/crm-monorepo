"use client";

import type { PaymentMethod, PaymentStatus, PaymentWithInvoice } from "@crm/types";
import {
  CalendarIcon,
  Clock,
  CreditCard,
  DollarSign,
  FilterIcon,
  RefreshCwIcon,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paymentsApi } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

const paymentMethods: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "All Methods" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const paymentStatuses: { value: PaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function getStatusBadge(status: PaymentStatus) {
  const variants: Record<PaymentStatus, "success" | "warning" | "destructive" | "secondary"> = {
    completed: "success",
    pending: "warning",
    failed: "destructive",
    refunded: "secondary",
    cancelled: "destructive",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalPending: 0,
    totalRefunded: 0,
    count: 0,
  });
  const [filters, setFilters] = useState({
    method: "all" as PaymentMethod | "all",
    status: "all" as PaymentStatus | "all",
    search: "",
  });

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { pageSize: 50 };
      if (filters.method !== "all") params.paymentMethod = filters.method;
      if (filters.status !== "all") params.status = filters.status;

      const [paymentsResult, statsResult] = await Promise.all([
        paymentsApi.getAll(params),
        paymentsApi.getStats(),
      ]);

      if (paymentsResult.success && paymentsResult.data) {
        setPayments(paymentsResult.data);
      }
      if (statsResult.success && statsResult.data) {
        setStats({
          totalCompleted: statsResult.data.totalPaid || 0,
          totalPending: statsResult.data.totalPending || 0,
          totalRefunded: statsResult.data.totalRefunded || 0,
          count: statsResult.data.paymentCount || 0,
        });
      }
    } catch (error) {
      logger.error("Failed to fetch payments:", error);
      toast.error("Failed to load payments");
    } finally {
      setIsLoading(false);
    }
  }, [filters.method, filters.status]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = payments.filter((payment) => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      payment.reference?.toLowerCase().includes(search) ||
      payment.transactionId?.toLowerCase().includes(search) ||
      payment.invoice?.invoiceNumber?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">View and manage all payment transactions</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchPayments}>
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCompleted)}</div>
            <p className="text-muted-foreground text-xs">Completed payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.totalPending)}
            </div>
            <p className="text-muted-foreground text-xs">Awaiting confirmation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Refunded</CardTitle>
            <RotateCcw className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalRefunded)}
            </div>
            <p className="text-muted-foreground text-xs">Total refunds</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
            <p className="text-muted-foreground text-xs">Total payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Payments</CardTitle>
              <CardDescription>Complete history of all payment transactions</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search reference, invoice..."
                className="w-[200px]"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
              <Select
                value={filters.method}
                onValueChange={(value: any) => setFilters((prev) => ({ ...prev, method: value }))}
              >
                <SelectTrigger className="w-[150px]">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value: any) => setFilters((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-[140px]">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
              <CreditCard className="mb-4 h-16 w-16" />
              <h3 className="text-lg font-medium">No payments found</h3>
              <p>
                {filters.search || filters.method !== "all" || filters.status !== "all"
                  ? "Try adjusting your filters"
                  : "Payments will appear here once recorded"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="text-muted-foreground h-4 w-4" />
                        {formatDate(payment.paymentDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.invoice ? (
                        <Link
                          href={`/dashboard/sales/invoices/${payment.invoiceId}`}
                          className="text-primary hover:underline"
                        >
                          {payment.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {payment.invoiceId.slice(0, 8)}...
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 capitalize">
                        <CreditCard className="text-muted-foreground h-4 w-4" />
                        {payment.paymentMethod.replace("_", " ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.reference || payment.transactionId || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${
                          payment.status === "refunded"
                            ? "text-red-600"
                            : payment.status === "completed"
                              ? "text-green-600"
                              : ""
                        }`}
                      >
                        {payment.status === "refunded" && "-"}
                        {formatCurrency(Number(payment.amount), payment.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
