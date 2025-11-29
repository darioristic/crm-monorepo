"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Invoice } from "@crm/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (invoiceId: string, amount: number, reference?: string, notes?: string) => Promise<void>;
  isLoading?: boolean;
}

export function PaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: PaymentDialogProps) {
  const balance = invoice ? invoice.total - invoice.paidAmount : 0;

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: balance,
      reference: "",
      notes: "",
    },
  });

  const handleSubmit = async (values: PaymentFormValues) => {
    if (!invoice) return;
    await onSubmit(invoice.id, values.amount, values.reference, values.notes);
    form.reset();
  };

  // Reset form when invoice changes
  useState(() => {
    if (invoice) {
      form.reset({
        amount: invoice.total - invoice.paidAmount,
        reference: "",
        notes: "",
      });
    }
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for invoice {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice Total:</span>
            <span className="font-medium">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Paid:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(invoice.paidAmount)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-medium">Balance Due:</span>
            <span className="font-bold text-destructive">
              {formatCurrency(balance)}
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      max={balance}
                      step="0.01"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum: {formatCurrency(balance)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Check #1234, Wire transfer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

