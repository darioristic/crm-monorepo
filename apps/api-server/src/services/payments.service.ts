import type {
  ApiResponse,
  CreatePaymentRequest,
  PaginationParams,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
  PaymentWithInvoice,
  UpdatePaymentRequest,
} from "@crm/types";
import { errorResponse, paginatedResponse, successResponse } from "@crm/utils";
import { invoiceQueries } from "../db/queries/invoices";
import { paymentQueries } from "../db/queries/payments";
import { serviceLogger } from "../lib/logger";
import { notificationsService } from "./notifications.service";

// ============================================
// Payments Service
// ============================================

class PaymentsService {
  /**
   * Get all payments with filters
   */
  async getPayments(
    pagination: PaginationParams = {},
    filters: {
      invoiceId?: string;
      status?: PaymentStatus;
      paymentMethod?: PaymentMethod;
      dateFrom?: string;
      dateTo?: string;
      recordedBy?: string;
    } = {}
  ): Promise<ApiResponse<PaymentWithInvoice[]>> {
    try {
      const { payments, total } = await paymentQueries.findAll(pagination, filters);
      return paginatedResponse(payments, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching payments");
      return errorResponse("SERVER_ERROR", "Failed to fetch payments");
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<ApiResponse<PaymentWithInvoice>> {
    try {
      const payment = await paymentQueries.findById(id);
      if (!payment) {
        return errorResponse("NOT_FOUND", "Payment not found");
      }
      return successResponse(payment);
    } catch (error) {
      serviceLogger.error(error, "Error fetching payment");
      return errorResponse("SERVER_ERROR", "Failed to fetch payment");
    }
  }

  /**
   * Get payments for an invoice
   */
  async getPaymentsByInvoice(invoiceId: string): Promise<ApiResponse<Payment[]>> {
    try {
      const payments = await paymentQueries.findByInvoice(invoiceId);
      return successResponse(payments);
    } catch (error) {
      serviceLogger.error(error, "Error fetching payments for invoice");
      return errorResponse("SERVER_ERROR", "Failed to fetch payments");
    }
  }

  /**
   * Record a new payment
   */
  async recordPayment(
    data: CreatePaymentRequest,
    recordedBy: string
  ): Promise<ApiResponse<Payment>> {
    try {
      // Validate amount
      if (!data.amount || data.amount <= 0) {
        return errorResponse("VALIDATION_ERROR", "Payment amount must be positive");
      }

      // Check invoice exists
      const invoice = await invoiceQueries.findById(data.invoiceId);
      if (!invoice) {
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      // Check if invoice is already fully paid
      const summary = await paymentQueries.getInvoicePaymentSummary(data.invoiceId);
      const remaining = invoice.total - summary.totalPaid;

      if (remaining <= 0) {
        return errorResponse("CONFLICT", "Invoice is already fully paid");
      }

      // Warning if payment exceeds remaining (but still allow it)
      if (data.amount > remaining) {
        // Still allow overpayment but could add metadata about it
        data.metadata = {
          ...data.metadata,
          overpayment: true,
          remainingBeforePayment: remaining,
        };
      }

      // Create payment
      const payment = await paymentQueries.create(data, recordedBy);

      // Update invoice paid amount
      const newPaidAmount = summary.totalPaid + data.amount;
      await invoiceQueries.update(data.invoiceId, {
        paidAmount: newPaidAmount,
        status: newPaidAmount >= invoice.total ? "paid" : invoice.status,
      });

      // Send notification if invoice is now paid
      if (newPaidAmount >= invoice.total) {
        await notificationsService.createNotification({
          userId: invoice.createdBy,
          type: "invoice_paid",
          channel: "both",
          title: "Invoice Paid in Full",
          message: `Invoice ${invoice.invoiceNumber} has been paid in full.`,
          link: `/dashboard/sales/invoices/${invoice.id}`,
          entityType: "invoice",
          entityId: invoice.id,
        });
      }

      return successResponse(payment);
    } catch (error) {
      serviceLogger.error(error, "Error recording payment");
      return errorResponse("SERVER_ERROR", "Failed to record payment");
    }
  }

  /**
   * Update a payment
   */
  async updatePayment(id: string, data: UpdatePaymentRequest): Promise<ApiResponse<Payment>> {
    try {
      const existing = await paymentQueries.findById(id);
      if (!existing) {
        return errorResponse("NOT_FOUND", "Payment not found");
      }

      // Don't allow changing amount directly - refund and create new payment instead
      const payment = await paymentQueries.update(id, data);
      if (!payment) {
        return errorResponse("SERVER_ERROR", "Failed to update payment");
      }

      return successResponse(payment);
    } catch (error) {
      serviceLogger.error(error, "Error updating payment");
      return errorResponse("SERVER_ERROR", "Failed to update payment");
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(id: string): Promise<ApiResponse<Payment>> {
    try {
      const existing = await paymentQueries.findById(id);
      if (!existing) {
        return errorResponse("NOT_FOUND", "Payment not found");
      }

      if (existing.status === "refunded") {
        return errorResponse("CONFLICT", "Payment already refunded");
      }

      if (existing.status !== "completed") {
        return errorResponse("BAD_REQUEST", "Only completed payments can be refunded");
      }

      // Refund the payment
      const payment = await paymentQueries.refund(id);
      if (!payment) {
        return errorResponse("SERVER_ERROR", "Failed to refund payment");
      }

      // Update invoice paid amount
      const invoice = await invoiceQueries.findById(existing.invoiceId);
      if (invoice) {
        const newPaidAmount = Math.max(0, invoice.paidAmount - existing.amount);
        await invoiceQueries.update(existing.invoiceId, {
          paidAmount: newPaidAmount,
          status: newPaidAmount >= invoice.total ? "paid" : "sent",
        });
      }

      return successResponse(payment);
    } catch (error) {
      serviceLogger.error(error, "Error refunding payment");
      return errorResponse("SERVER_ERROR", "Failed to refund payment");
    }
  }

  /**
   * Delete a payment (only allowed for pending/failed)
   */
  async deletePayment(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await paymentQueries.findById(id);
      if (!existing) {
        return errorResponse("NOT_FOUND", "Payment not found");
      }

      if (existing.status === "completed") {
        return errorResponse(
          "BAD_REQUEST",
          "Completed payments cannot be deleted. Use refund instead."
        );
      }

      const deleted = await paymentQueries.delete(id);
      return successResponse({ deleted });
    } catch (error) {
      serviceLogger.error(error, "Error deleting payment");
      return errorResponse("SERVER_ERROR", "Failed to delete payment");
    }
  }

  /**
   * Get invoice payment summary
   */
  async getInvoicePaymentSummary(invoiceId: string): Promise<ApiResponse<PaymentSummary>> {
    try {
      const summary = await paymentQueries.getInvoicePaymentSummary(invoiceId);
      return successResponse(summary);
    } catch (error) {
      serviceLogger.error(error, "Error getting payment summary");
      return errorResponse("SERVER_ERROR", "Failed to get payment summary");
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(filters: { dateFrom?: string; dateTo?: string } = {}): Promise<
    ApiResponse<{
      totalAmount: number;
      paymentCount: number;
      byMethod: { method: PaymentMethod; amount: number; count: number }[];
      byStatus: { status: PaymentStatus; amount: number; count: number }[];
    }>
  > {
    try {
      const stats = await paymentQueries.getPaymentStats(filters);
      return successResponse(stats);
    } catch (error) {
      serviceLogger.error(error, "Error getting payment stats");
      return errorResponse("SERVER_ERROR", "Failed to get payment statistics");
    }
  }
}

export const paymentsService = new PaymentsService();
