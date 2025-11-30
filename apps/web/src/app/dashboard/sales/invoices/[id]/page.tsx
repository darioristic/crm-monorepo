"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Invoice, Payment, PaymentMethod } from "@crm/types";
import { invoicesApi, paymentsApi } from "@/lib/api";
import { useApi, useMutation } from "@/hooks/use-api";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  ArrowLeft,
  Pencil,
  PlusIcon,
  CreditCard,
  DollarSign,
  Building2,
  CalendarIcon,
  FileTextIcon,
  Loader2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface PageProps {
  params: Promise<{ id: string }>;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  reference: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

function getStatusBadge(status: Invoice["status"]) {
  const variants: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
    paid: "success",
    partial: "warning",
    sent: "secondary",
    draft: "outline",
    overdue: "destructive",
    cancelled: "destructive",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("sr-RS", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useApi<Invoice>(() => invoicesApi.getById(id), { autoFetch: true });

  const {
    data: payments,
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useApi<Payment[]>(() => paymentsApi.getByInvoice(id), { autoFetch: true });

  const balance = invoice ? Number(invoice.total) - Number(invoice.paidAmount) : 0;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      amount: balance,
      paymentMethod: "bank_transfer",
      reference: "",
      transactionId: "",
      notes: "",
    },
  });

  // Reset form when balance changes
  useEffect(() => {
    if (invoice) {
      form.setValue("amount", Number(invoice.total) - Number(invoice.paidAmount));
    }
  }, [invoice, form]);

  const recordPaymentMutation = useMutation<Payment, any>((data) =>
    paymentsApi.record(data)
  );

  const refundPaymentMutation = useMutation<Payment, string>((paymentId) =>
    paymentsApi.refund(paymentId)
  );

  const deletePaymentMutation = useMutation<void, string>((paymentId) =>
    paymentsApi.delete(paymentId)
  );

  const handleRecordPayment = async (values: PaymentFormValues) => {
    if (!invoice) return;

    const result = await recordPaymentMutation.mutate({
      invoiceId: invoice.id,
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      reference: values.reference || undefined,
      transactionId: values.transactionId || undefined,
      notes: values.notes || undefined,
    });

    if (result.success) {
      toast.success("Payment recorded successfully");
      setPaymentDialogOpen(false);
      form.reset();
      refetch();
      refetchPayments();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to record payment"));
    }
  };

  const handleRefund = async (paymentId: string) => {
    const result = await refundPaymentMutation.mutate(paymentId);
    if (result.success) {
      toast.success("Payment refunded");
      refetch();
      refetchPayments();
    } else {
      toast.error("Failed to refund payment");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const result = await deletePaymentMutation.mutate(paymentId);
    if (result.success) {
      toast.success("Payment deleted");
      refetch();
      refetchPayments();
    } else {
      toast.error("Failed to delete payment");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[400px] md:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Button onClick={() => refetch()}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sales/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Invoice not found</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashboard/sales/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/sales/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {invoice.invoiceNumber}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-muted-foreground">Invoice Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {balance > 0 && (
            <Button onClick={() => setPaymentDialogOpen(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/dashboard/sales/invoices/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 md:col-span-2">
          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items?.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.description && (
                            <p className="text-muted-foreground text-sm">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.discount) > 0
                          ? formatCurrency(Number(item.discount))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(item.total))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex flex-col items-end space-y-2">
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(Number(invoice.subtotal))}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">
                    Tax ({Number(invoice.taxRate)}%):
                  </span>
                  <span>{formatCurrency(Number(invoice.tax))}</span>
                </div>
                <Separator className="w-48" />
                <div className="flex justify-between gap-8 text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(Number(invoice.total))}</span>
                </div>
                <div className="flex justify-between gap-8 text-green-600">
                  <span>Paid:</span>
                  <span>{formatCurrency(Number(invoice.paidAmount))}</span>
                </div>
                {balance > 0 && (
                  <div className="flex justify-between gap-8 font-bold text-destructive">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payments History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription>
                    All payments recorded for this invoice
                  </CardDescription>
                </div>
                {balance > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPaymentDialogOpen(true)}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Payment
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !payments || payments.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
                  <DollarSign className="mb-3 h-10 w-10" />
                  <p>No payments recorded yet</p>
                  {balance > 0 && (
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setPaymentDialogOpen(true)}
                    >
                      Record first payment
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.paymentMethod.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.reference || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "completed"
                                ? "success"
                                : payment.status === "refunded"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(payment.amount))}
                        </TableCell>
                        <TableCell>
                          {payment.status === "completed" && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRefund(payment.id)}
                                disabled={refundPaymentMutation.isLoading}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-8 w-8"
                                onClick={() => handleDeletePayment(payment.id)}
                                disabled={deletePaymentMutation.isLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <FileTextIcon className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="text-muted-foreground text-sm">Invoice Number</p>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="text-muted-foreground text-sm">Issue Date</p>
                  <p className="font-medium">{formatDate(invoice.issueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="text-muted-foreground text-sm">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.total))}
                </span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span className="font-medium">
                  {formatCurrency(Number(invoice.paidAmount))}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Balance</span>
                <span
                  className={`font-bold ${
                    balance > 0 ? "text-destructive" : "text-green-600"
                  }`}
                >
                  {formatCurrency(balance)}
                </span>
              </div>
              {balance > 0 && (
                <Button
                  className="mt-2 w-full"
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
              {balance === 0 && (
                <Badge className="w-full justify-center" variant="success">
                  Fully Paid
                </Badge>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoice.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total:</span>
              <span className="font-medium">
                {formatCurrency(Number(invoice.total))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Already Paid:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(Number(invoice.paidAmount))}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Balance Due:</span>
              <span className="font-bold text-destructive">
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleRecordPayment)}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          max={balance}
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Max: {formatCurrency(balance)}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Check #, Wire ID..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input placeholder="TXN123456..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about this payment..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isLoading}
                >
                  {recordPaymentMutation.isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
