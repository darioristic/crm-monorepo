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
import { serviceLogger } from "../lib/logger";

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
      serviceLogger.error({ error }, "Error fetching deals:");
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
      serviceLogger.error({ error }, "Error fetching deal:");
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
      serviceLogger.error({ error }, "Error creating deal:");
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
      serviceLogger.error({ error }, "Error updating deal:");
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
      serviceLogger.error({ error }, "Error deleting deal:");
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
      serviceLogger.error({ error }, "Error fetching pipeline summary:");
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
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Quote[]>> {
    try {
      const cacheKey = `quotes:list:${JSON.stringify({ companyId, pagination, filters })}`;
      const cached = await cache.get<Quote[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await quoteQueries.findAll(companyId, pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error({ error }, "Error fetching quotes:");
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
      serviceLogger.error({ error }, "Error fetching quote:");
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
      serviceLogger.error({ error }, "Error creating quote:");
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

      const { items: _quoteItemsToExclude, ...rest } = data;
      const quoteUpdatePayload = {
        ...rest,
        subtotal,
        tax,
        total,
      } as Partial<Quote>;
      const updated = await quoteQueries.update(id, quoteUpdatePayload, items);

      // Invalidate cache
      await cache.del(`quotes:${id}`);
      await cache.invalidatePattern("quotes:list:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error({ error }, "Error updating quote:");
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
      serviceLogger.error({ error }, "Error deleting quote:");
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
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Invoice[]>> {
    try {
      const cacheKey = `invoices:list:${JSON.stringify({ companyId, pagination, filters })}`;
      const cached = await cache.get<Invoice[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await invoiceQueries.findAll(companyId, pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error({ 
        error, 
        companyId, 
        pagination, 
        filters,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }, "Error fetching invoices");
      // Always return a valid JSON response, never throw
      return paginatedResponse([], 0, pagination);
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
      serviceLogger.error({ error }, "Error fetching invoice:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoice");
    }
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    try {
      // Validate required fields with specific error messages
      const errors: string[] = [];
      
      if (!data.companyId || typeof data.companyId !== 'string' || data.companyId.trim() === '') {
        errors.push("Company ID is required");
      }
      
      if (!data.dueDate) {
        errors.push("Due date is required");
      }
      
      if (!data.items || !Array.isArray(data.items)) {
        errors.push("Items are required");
      } else if (data.items.length === 0) {
        errors.push("At least one item is required");
      }
      
      if (errors.length > 0) {
        return errorResponse("VALIDATION_ERROR", errors.join(", "));
      }

      // Calculate totals
      const items: Omit<InvoiceItem, "id" | "invoiceId">[] = data.items.map((item) => ({
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        unit: item.unit || "pcs",
        vatRate: item.vatRate ?? data.vatRate ?? 20,
        total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      }));

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = data.taxRate || 0;
      const vatRate = data.vatRate || 20;
      const tax = subtotal * (taxRate / 100);
      const vat = subtotal * (vatRate / 100);
      const total = subtotal + tax + vat;

      // Retry logic for duplicate invoice numbers (race condition protection)
      let retries = 5;
      let created: Invoice | null = null;
      
      while (retries > 0 && !created) {
        try {
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
            fromDetails: data.fromDetails || null,
            customerDetails: data.customerDetails || null,
            logoUrl: data.logoUrl ?? undefined,
            vatRate: vatRate,
            currency: data.currency || "EUR",
            templateSettings: data.templateSettings || null,
          };

          created = await invoiceQueries.create(invoice, items);
        } catch (err: any) {
          // Check if it's a duplicate key error
          const isDuplicateError =
            (err.code === '23505' || err.code === 23505) &&
            (err.constraint === 'invoices_invoice_number_unique' ||
             err.constraint_name === 'invoices_invoice_number_unique' ||
             err.message?.includes('invoices_invoice_number_unique'));

          if (isDuplicateError) {
            retries--;
            if (retries === 0) {
              throw err; // Throw the error if we've run out of retries
            }
            // Wait a small random time before retrying to reduce collision chance
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          } else {
            throw err; // Re-throw if it's a different error
          }
        }
      }

      if (!created) {
        return errorResponse("DATABASE_ERROR", "Failed to generate unique invoice number after retries");
      }

      // Invalidate cache
      await cache.invalidatePattern("invoices:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error({ error }, "Error creating invoice:");
      return errorResponse("DATABASE_ERROR", "Failed to create invoice");
    }
  }

  async updateInvoice(id: string, data: UpdateInvoiceRequest): Promise<ApiResponse<Invoice>> {
    try {
      const existing = await invoiceQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Invoice").toResponse();
      }

      let items: Omit<InvoiceItem, "invoiceId">[] | undefined;
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
          unit: item.unit || "pcs",
          vatRate: item.vatRate ?? data.vatRate ?? 20,
          total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
        }));
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = data.taxRate ?? existing.taxRate ?? 0;
        const vatRate = data.vatRate ?? existing.vatRate ?? 20;
        tax = subtotal * (taxRate / 100);
        const vat = subtotal * (vatRate / 100);
        total = subtotal + tax + vat;
      }

      const { items: _itemsToExclude, ...rest } = data;
      const updatePayload: Partial<Invoice> = {
        ...rest,
        subtotal,
        tax,
        total,
        fromDetails: data.fromDetails,
        customerDetails: data.customerDetails,
        logoUrl: data.logoUrl,
        vatRate: data.vatRate,
        currency: data.currency,
        templateSettings: data.templateSettings,
      };

      const updated = await invoiceQueries.update(id, updatePayload, items);

      // Invalidate cache
      await cache.del(`invoices:${id}`);
      await cache.invalidatePattern("invoices:list:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error({ error }, "Error updating invoice:");
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
      serviceLogger.error({ error }, "Error deleting invoice:");
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
      serviceLogger.error({ error }, "Error recording payment:");
      return errorResponse("DATABASE_ERROR", "Failed to record payment");
    }
  }

  async getOverdueInvoices(companyId: string | null): Promise<ApiResponse<Invoice[]>> {
    try {
      const cacheKey = `invoices:overdue:${companyId || 'all'}`;
      const cached = await cache.get<Invoice[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const invoices = await invoiceQueries.getOverdue(companyId);
      await cache.set(cacheKey, invoices, 60); // Shorter TTL for overdue

      return successResponse(invoices);
    } catch (error) {
      serviceLogger.error({ error }, "Error fetching overdue invoices:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch overdue invoices");
    }
  }

  // ============================================
  // Delivery Note (Otpremnica) Operations
  // ============================================

  async getDeliveryNotes(
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = `delivery-notes:list:${JSON.stringify({ companyId, pagination, filters })}`;
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await deliveryNoteQueries.findAll(companyId, pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error({ error }, "Error fetching delivery notes:");
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
      serviceLogger.error({ error }, "Error fetching delivery note:");
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
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
      }));

      // Calculate totals
      const subtotal = items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.unitPrice;
        const discountAmount = lineTotal * (item.discount / 100);
        return sum + (lineTotal - discountAmount);
      }, 0);
      const taxRate = data.taxRate || 0;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

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
        taxRate,
        subtotal,
        tax,
        total,
        notes: data.notes,
        terms: data.terms,
        customerDetails: data.customerDetails || null,
        createdBy: data.createdBy,
      };

      const created = await deliveryNoteQueries.create(note, items);

      // Invalidate cache
      await cache.invalidatePattern("delivery-notes:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error({ error }, "Error creating delivery note:");
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
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
        }));

        // Recalculate totals if items are updated
        const subtotal = items.reduce((sum, item) => {
          const lineTotal = item.quantity * item.unitPrice;
          const discountAmount = lineTotal * (item.discount / 100);
          return sum + (lineTotal - discountAmount);
        }, 0);
        const taxRate = data.taxRate ?? existing.taxRate;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        data.subtotal = subtotal;
        data.tax = tax;
        data.total = total;
      }

      const { items: _dnItemsToExclude, ...rest } = data;
      const updatePayload: Partial<DeliveryNote> = {
        ...rest,
      };
      const updated = await deliveryNoteQueries.update(id, updatePayload, items);

      // Invalidate cache
      await cache.del(`delivery-notes:${id}`);
      await cache.invalidatePattern("delivery-notes:list:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error({ error }, "Error updating delivery note:");
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
      serviceLogger.error({ error }, "Error deleting delivery note:");
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

  async getPendingDeliveries(companyId: string | null): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = `delivery-notes:pending:${companyId || 'all'}`;
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const notes = await deliveryNoteQueries.getPending(companyId);
      await cache.set(cacheKey, notes, 60);

      return successResponse(notes);
    } catch (error) {
      serviceLogger.error({ error }, "Error fetching pending deliveries:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch pending deliveries");
    }
  }

  async getInTransitDeliveries(companyId: string | null): Promise<ApiResponse<DeliveryNote[]>> {
    try {
      const cacheKey = `delivery-notes:in-transit:${companyId || 'all'}`;
      const cached = await cache.get<DeliveryNote[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const notes = await deliveryNoteQueries.getInTransit(companyId);
      await cache.set(cacheKey, notes, 60);

      return successResponse(notes);
    } catch (error) {
      serviceLogger.error({ error }, "Error fetching in-transit deliveries:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch in-transit deliveries");
    }
  }
}

export const salesService = new SalesService();
