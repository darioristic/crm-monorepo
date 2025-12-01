import type {
  Deal,
  CreateDealRequest,
  UpdateDealRequest,
  Quote,
  QuoteItem,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  Invoice,
  InvoiceItem,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  DeliveryNote,
  DeliveryNoteItem,
  CreateDeliveryNoteRequest,
  UpdateDeliveryNoteRequest,
  ApiResponse,
  PaginationParams,
  FilterParams,
  DealStage,
  QuoteStatus,
  DeliveryNoteStatus,
} from "@crm/types";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  generateUUID,
  now,
  Errors,
} from "@crm/utils";
import { dealQueries, quoteQueries, invoiceQueries, deliveryNoteQueries } from "../db/queries";
import { cache } from "../cache/redis";

const CACHE_TTL = 300;

interface PipelineSummary {
  stages: {
    stage: DealStage;
    count: number;
    totalValue: number;
  }[];
  totalDeals: number;
  totalValue: number;
  avgDealValue: number;
}

class SalesService {
  // ============================================
  // Deal Operations
  // ============================================

  async getDeals(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Deal[]>> {
    try {
      const cacheKey = `deals:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Deal[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await dealQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      console.error("Error fetching deals:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch deals");
    }
  }

  async getDealById(id: string): Promise<ApiResponse<Deal>> {
    try {
      const cacheKey = `deals:${id}`;
      const cached = await cache.get<Deal>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const deal = await dealQueries.findById(id);
      if (!deal) {
        return Errors.NotFound("Deal").toResponse();
      }

      await cache.set(cacheKey, deal, CACHE_TTL);
      return successResponse(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch deal");
    }
  }

  async createDeal(data: CreateDealRequest): Promise<ApiResponse<Deal>> {
    try {
      // Validate required fields
      if (!data.title || !data.value || !data.assignedTo) {
        return errorResponse("VALIDATION_ERROR", "Title, value, and assignedTo are required");
      }

      const deal: Deal = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        stage: data.stage || "discovery",
        priority: data.priority || "medium",
        probability: data.probability ?? 20,
        currency: data.currency || "USD",
      };

      const created = await dealQueries.create(deal);

      // Invalidate cache
      await cache.invalidatePattern("deals:list:*");
      await cache.del("deals:pipeline:summary");

      return successResponse(created);
    } catch (error) {
      console.error("Error creating deal:", error);
      return errorResponse("DATABASE_ERROR", "Failed to create deal");
    }
  }

  async updateDeal(id: string, data: UpdateDealRequest): Promise<ApiResponse<Deal>> {
    try {
      const existing = await dealQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Deal").toResponse();
      }

      const updated = await dealQueries.update(id, {
        ...data,
        updatedAt: now(),
      });

      // Invalidate cache
      await cache.del(`deals:${id}`);
      await cache.invalidatePattern("deals:list:*");
      await cache.del("deals:pipeline:summary");

      return successResponse(updated);
    } catch (error) {
      console.error("Error updating deal:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update deal");
    }
  }

  async deleteDeal(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await dealQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Deal").toResponse();
      }

      await dealQueries.delete(id);

      // Invalidate cache
      await cache.del(`deals:${id}`);
      await cache.invalidatePattern("deals:list:*");
      await cache.del("deals:pipeline:summary");

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("Error deleting deal:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete deal");
    }
  }

  // ============================================
  // Pipeline Operations
  // ============================================

  async getPipelineSummary(): Promise<ApiResponse<PipelineSummary>> {
    try {
      const cacheKey = "deals:pipeline:summary";
      const cached = await cache.get<PipelineSummary>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const summary = await dealQueries.getPipelineSummary();
      await cache.set(cacheKey, summary, CACHE_TTL);

      return successResponse(summary);
    } catch (error) {
      console.error("Error fetching pipeline summary:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch pipeline summary");
    }
  }

  async moveDealToStage(id: string, stage: DealStage): Promise<ApiResponse<Deal>> {
    // Update probability based on stage
    const stageProbabilities: Record<DealStage, number> = {
      discovery: 20,
      proposal: 40,
      negotiation: 60,
      contract: 80,
      closed_won: 100,
      closed_lost: 0,
    };

    const updates: UpdateDealRequest = {
      stage,
      probability: stageProbabilities[stage],
    };

    // Set actual close date for closed deals
    if (stage === "closed_won" || stage === "closed_lost") {
      updates.actualCloseDate = now();
    }

    return this.updateDeal(id, updates);
  }

  async getDealsByStage(stage: DealStage): Promise<ApiResponse<Deal[]>> {
    return this.getDeals({ page: 1, pageSize: 100 }, { status: stage });
  }

  // ============================================
  // Quote (Ponuda) Operations
  // ============================================

  async getQuotes(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Quote[]>> {
    try {
      const cacheKey = `quotes:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Quote[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await quoteQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch quotes");
    }
  }

  async getQuoteById(id: string): Promise<ApiResponse<Quote>> {
    try {
      const cacheKey = `quotes:${id}`;
      const cached = await cache.get<Quote>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const quote = await quoteQueries.findById(id);
      if (!quote) {
        return Errors.NotFound("Quote").toResponse();
      }

      await cache.set(cacheKey, quote, CACHE_TTL);
      return successResponse(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch quote");
    }
  }

  async createQuote(data: CreateQuoteRequest): Promise<ApiResponse<Quote>> {
    try {
      // Validate required fields
      if (!data.companyId || !data.validUntil || !data.items || data.items.length === 0) {
        return errorResponse("VALIDATION_ERROR", "Company, validUntil, and items are required");
      }

      // Calculate totals
      const items: Omit<QuoteItem, "id" | "quoteId">[] = data.items.map((item) => ({
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      }));

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = data.taxRate || 0;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      const quoteNumber = await quoteQueries.generateNumber();

      const quote: Omit<Quote, "items"> = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        quoteNumber,
        companyId: data.companyId,
        contactId: data.contactId,
        status: data.status || "draft",
        issueDate: data.issueDate || now(),
        validUntil: data.validUntil,
        subtotal,
        taxRate,
        tax,
        total,
        notes: data.notes,
        terms: data.terms,
        createdBy: data.createdBy,
      };

      const created = await quoteQueries.create(quote, items);

      // Invalidate cache
      await cache.invalidatePattern("quotes:list:*");

      return successResponse(created);
    } catch (error) {
      console.error("Error creating quote:", error);
      return errorResponse("DATABASE_ERROR", "Failed to create quote");
    }
  }

  async updateQuote(id: string, data: UpdateQuoteRequest): Promise<ApiResponse<Quote>> {
    try {
      const existing = await quoteQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Quote").toResponse();
      }

      let items: Omit<QuoteItem, "quoteId">[] | undefined;
      let subtotal = existing.subtotal;
      let tax = existing.tax;
      let total = existing.total;

      if (data.items) {
        items = data.items.map((item) => ({
          id: item.id || generateUUID(),
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        }));
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = data.taxRate ?? existing.taxRate;
        tax = subtotal * (taxRate / 100);
        total = subtotal + tax;
      }

      const updated = await quoteQueries.update(id, {
        ...data,
        subtotal,
        tax,
        total,
      }, items);

      // Invalidate cache
      await cache.del(`quotes:${id}`);
      await cache.invalidatePattern("quotes:list:*");

      return successResponse(updated);
    } catch (error) {
      console.error("Error updating quote:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update quote");
    }
  }

  async deleteQuote(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await quoteQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Quote").toResponse();
      }

      await quoteQueries.delete(id);

      // Invalidate cache
      await cache.del(`quotes:${id}`);
      await cache.invalidatePattern("quotes:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("Error deleting quote:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete quote");
    }
  }

  async updateQuoteStatus(id: string, status: QuoteStatus): Promise<ApiResponse<Quote>> {
    return this.updateQuote(id, { status });
  }

  // ============================================
  // Invoice (Faktura) Operations
  // ============================================

  async getInvoices(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Invoice[]>> {
    try {
      const cacheKey = `invoices:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Invoice[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await invoiceQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoices");
    }
  }

  async getInvoiceById(id: string): Promise<ApiResponse<Invoice>> {
    try {
      const cacheKey = `invoices:${id}`;
      const cached = await cache.get<Invoice>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const invoice = await invoiceQueries.findById(id);
      if (!invoice) {
        return Errors.NotFound("Invoice").toResponse();
      }

      await cache.set(cacheKey, invoice, CACHE_TTL);
      return successResponse(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoice");
    }
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    try {
      // Validate required fields
      if (!data.companyId || !data.dueDate || !data.items || data.items.length === 0) {
        return errorResponse("VALIDATION_ERROR", "Company, dueDate, and items are required");
      }

      // Calculate totals
      const extData = data as any;
      const items: Omit<InvoiceItem, "id" | "invoiceId">[] = data.items.map((item: any) => ({
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        unit: item.unit || "pcs",
        vatRate: item.vatRate ?? extData.vatRate ?? 20,
        total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      }));

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = data.taxRate || 0;
      const vatRate = extData.vatRate || 20;
      const tax = subtotal * (taxRate / 100);
      const vat = subtotal * (vatRate / 100);
      const total = subtotal + tax + vat;

      const invoiceNumber = await invoiceQueries.generateNumber();

      const invoice: Omit<Invoice, "items"> = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        invoiceNumber,
        quoteId: data.quoteId,
        companyId: data.companyId,
        contactId: data.contactId,
        status: data.status || "draft",
        issueDate: data.issueDate || now(),
        dueDate: data.dueDate,
        subtotal,
        taxRate,
        tax,
        total,
        paidAmount: 0,
        notes: data.notes,
        terms: data.terms,
        createdBy: data.createdBy,
        // New fields for PDF generation
        fromDetails: extData.fromDetails || null,
        customerDetails: extData.customerDetails || null,
        logoUrl: extData.logoUrl || null,
        vatRate: vatRate,
        currency: extData.currency || "EUR",
        templateSettings: extData.templateSettings || null,
      } as any;

      const created = await invoiceQueries.create(invoice, items);

      // Invalidate cache
      await cache.invalidatePattern("invoices:list:*");

      return successResponse(created);
    } catch (error) {
      console.error("Error creating invoice:", error);
      return errorResponse("DATABASE_ERROR", "Failed to create invoice");
    }
  }

  async updateInvoice(id: string, data: UpdateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    try {
      const existing = await invoiceQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Invoice").toResponse();
      }

      const extData = data as any;
      let items: Omit<InvoiceItem, "invoiceId">[] | undefined;
      let subtotal = existing.subtotal;
      let tax = existing.tax;
      let total = existing.total;

      if (data.items) {
        items = data.items.map((item: any) => ({
          id: item.id || generateUUID(),
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          unit: item.unit || "pcs",
          vatRate: item.vatRate ?? extData.vatRate ?? 20,
          total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        }));
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = data.taxRate ?? existing.taxRate ?? 0;
        const vatRate = extData.vatRate ?? (existing as any).vatRate ?? 20;
        tax = subtotal * (taxRate / 100);
        const vat = subtotal * (vatRate / 100);
        total = subtotal + tax + vat;
      }

      const updated = await invoiceQueries.update(id, {
        ...data,
        subtotal,
        tax,
        total,
        // Ensure new fields are passed
        fromDetails: extData.fromDetails,
        customerDetails: extData.customerDetails,
        logoUrl: extData.logoUrl,
        vatRate: extData.vatRate,
        currency: extData.currency,
        templateSettings: extData.templateSettings,
      }, items);

      // Invalidate cache
      await cache.del(`invoices:${id}`);
      await cache.invalidatePattern("invoices:list:*");

      return successResponse(updated);
    } catch (error) {
      console.error("Error updating invoice:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update invoice");
    }
  }

  async deleteInvoice(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await invoiceQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Invoice").toResponse();
      }

      await invoiceQueries.delete(id);

      // Invalidate cache
      await cache.del(`invoices:${id}`);
      await cache.invalidatePattern("invoices:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete invoice");
    }
  }

  async recordPayment(id: string, amount: number): Promise<ApiResponse<Invoice>> {
    try {
      const invoice = await invoiceQueries.findById(id);
      if (!invoice) {
        return Errors.NotFound("Invoice").toResponse();
      }

      const updated = await invoiceQueries.recordPayment(id, amount);

      // Invalidate cache
      await cache.del(`invoices:${id}`);
      await cache.invalidatePattern("invoices:list:*");

      return successResponse(updated);
    } catch (error) {
      console.error("Error recording payment:", error);
      return errorResponse("DATABASE_ERROR", "Failed to record payment");
    }
  }

  async getOverdueInvoices(): Promise<ApiResponse<Invoice[]>> {
    try {
      const cacheKey = "invoices:overdue";
      const cached = await cache.get<Invoice[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const invoices = await invoiceQueries.getOverdue();
      await cache.set(cacheKey, invoices, 60); // Shorter TTL for overdue

      return successResponse(invoices);
    } catch (error) {
      console.error("Error fetching overdue invoices:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch overdue invoices");
    }
  }

  // ============================================
  // Delivery Note (Otpremnica) Operations
  // ============================================

  async getDeliveryNotes(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = `delivery-notes:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await deliveryNoteQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      console.error("Error fetching delivery notes:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch delivery notes");
    }
  }

  async getDeliveryNoteById(id: string): Promise<ApiResponse<DeliveryNote>> {
    try {
      const cacheKey = `delivery-notes:${id}`;
      const cached = await cache.get<DeliveryNote>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const note = await deliveryNoteQueries.findById(id);
      if (!note) {
        return Errors.NotFound("Delivery Note").toResponse();
      }

      await cache.set(cacheKey, note, CACHE_TTL);
      return successResponse(note);
    } catch (error) {
      console.error("Error fetching delivery note:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch delivery note");
    }
  }

  async createDeliveryNote(data: CreateDeliveryNoteRequest): Promise<ApiResponse<DeliveryNote>> {
    try {
      // Validate required fields
      if (!data.companyId || !data.shippingAddress || !data.items || data.items.length === 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Company, shippingAddress, and items are required"
        );
      }

      const items: Omit<DeliveryNoteItem, "id" | "deliveryNoteId">[] = data.items.map((item) => ({
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || "pcs",
      }));

      const deliveryNumber = await deliveryNoteQueries.generateNumber();

      const note: Omit<DeliveryNote, "items"> = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        deliveryNumber,
        invoiceId: data.invoiceId,
        companyId: data.companyId,
        contactId: data.contactId,
        status: data.status || "pending",
        shipDate: data.shipDate,
        deliveryDate: data.deliveryDate,
        shippingAddress: data.shippingAddress,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        notes: data.notes,
        createdBy: data.createdBy,
      };

      const created = await deliveryNoteQueries.create(note, items);

      // Invalidate cache
      await cache.invalidatePattern("delivery-notes:list:*");

      return successResponse(created);
    } catch (error) {
      console.error("Error creating delivery note:", error);
      return errorResponse("DATABASE_ERROR", "Failed to create delivery note");
    }
  }

  async updateDeliveryNote(
    id: string,
    data: UpdateDeliveryNoteRequest
  ): Promise<ApiResponse<DeliveryNote>> {
    try {
      const existing = await deliveryNoteQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Delivery Note").toResponse();
      }

      let items: Omit<DeliveryNoteItem, "deliveryNoteId">[] | undefined;

      if (data.items) {
        items = data.items.map((item) => ({
          id: item.id || generateUUID(),
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "pcs",
        }));
      }

      const updated = await deliveryNoteQueries.update(id, data, items);

      // Invalidate cache
      await cache.del(`delivery-notes:${id}`);
      await cache.invalidatePattern("delivery-notes:list:*");

      return successResponse(updated);
    } catch (error) {
      console.error("Error updating delivery note:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update delivery note");
    }
  }

  async deleteDeliveryNote(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await deliveryNoteQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Delivery Note").toResponse();
      }

      await deliveryNoteQueries.delete(id);

      // Invalidate cache
      await cache.del(`delivery-notes:${id}`);
      await cache.invalidatePattern("delivery-notes:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("Error deleting delivery note:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete delivery note");
    }
  }

  async updateDeliveryNoteStatus(
    id: string,
    status: DeliveryNoteStatus
  ): Promise<ApiResponse<DeliveryNote>> {
    const updates: Partial<DeliveryNote> = { status };

    if (status === "in_transit" && !updates.shipDate) {
      updates.shipDate = now();
    }
    if (status === "delivered" && !updates.deliveryDate) {
      updates.deliveryDate = now();
    }

    return this.updateDeliveryNote(id, updates);
  }

  async getPendingDeliveries(): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = "delivery-notes:pending";
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const notes = await deliveryNoteQueries.getPending();
      await cache.set(cacheKey, notes, 60);

      return successResponse(notes);
    } catch (error) {
      console.error("Error fetching pending deliveries:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch pending deliveries");
    }
  }

  async getInTransitDeliveries(): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = "delivery-notes:in-transit";
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const notes = await deliveryNoteQueries.getInTransit();
      await cache.set(cacheKey, notes, 60);

      return successResponse(notes);
    } catch (error) {
      console.error("Error fetching in-transit deliveries:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch in-transit deliveries");
    }
  }
}

export const salesService = new SalesService();
