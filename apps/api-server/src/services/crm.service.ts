import type {
  ApiResponse,
  Contact,
  CreateContactRequest,
  CreateDealRequest,
  CreateLeadRequest,
  Deal,
  DealStage,
  FilterParams,
  Lead,
  PaginationParams,
  UpdateDealRequest,
  UpdateLeadRequest,
} from "@crm/types";
import {
  Errors,
  errorResponse,
  generateUUID,
  isValidEmail,
  now,
  paginatedResponse,
  successResponse,
} from "@crm/utils";
import { cache } from "../cache/redis";
import { contactQueries, dealQueries, leadQueries } from "../db/queries";
import { serviceLogger } from "../lib/logger";

const CACHE_TTL = 300; // 5 minutes

class CRMService {
  // ============================================
  // Lead Operations
  // ============================================

  async getLeads(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Lead[]>> {
    try {
      const cacheKey = `leads:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Lead[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await leadQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching leads:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch leads");
    }
  }

  async getLeadById(id: string): Promise<ApiResponse<Lead>> {
    try {
      const cacheKey = `leads:${id}`;
      const cached = await cache.get<Lead>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const lead = await leadQueries.findById(id);
      if (!lead) {
        return Errors.NotFound("Lead").toResponse();
      }

      await cache.set(cacheKey, lead, CACHE_TTL);
      return successResponse(lead);
    } catch (error) {
      serviceLogger.error(error, "Error fetching lead:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch lead");
    }
  }

  async createLead(data: CreateLeadRequest): Promise<ApiResponse<Lead>> {
    try {
      // Validate email
      if (!isValidEmail(data.email)) {
        return errorResponse("VALIDATION_ERROR", "Invalid email address");
      }

      const lead: Lead = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        status: data.status || "new",
        source: data.source || "website",
      };

      const created = await leadQueries.create(lead);
      await cache.invalidatePattern("leads:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating lead:");
      return errorResponse("DATABASE_ERROR", "Failed to create lead");
    }
  }

  async updateLead(id: string, data: UpdateLeadRequest): Promise<ApiResponse<Lead>> {
    try {
      const existing = await leadQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Lead").toResponse();
      }

      if (data.email && !isValidEmail(data.email)) {
        return errorResponse("VALIDATION_ERROR", "Invalid email address");
      }

      const updated = await leadQueries.update(id, {
        ...data,
        updatedAt: now(),
      });

      // Invalidate cache
      await cache.del(`leads:${id}`);
      await cache.invalidatePattern("leads:list:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating lead:");
      return errorResponse("DATABASE_ERROR", "Failed to update lead");
    }
  }

  async deleteLead(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await leadQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Lead").toResponse();
      }

      await leadQueries.delete(id);

      // Invalidate cache
      await cache.del(`leads:${id}`);
      await cache.invalidatePattern("leads:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting lead:");
      return errorResponse("DATABASE_ERROR", "Failed to delete lead");
    }
  }

  // ============================================
  // Contact Operations
  // ============================================

  async getContacts(
    pagination: PaginationParams,
    filters: FilterParams & { tenantId?: string }
  ): Promise<ApiResponse<Contact[]>> {
    try {
      const cacheKey = `contacts:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Contact[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await contactQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching contacts:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch contacts");
    }
  }

  async getContactById(id: string, tenantId?: string): Promise<ApiResponse<Contact>> {
    try {
      const cacheKey = `contacts:${id}:${tenantId || "all"}`;
      const cached = await cache.get<Contact>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const contact = await contactQueries.findById(id, tenantId);
      if (!contact) {
        return Errors.NotFound("Contact").toResponse();
      }

      await cache.set(cacheKey, contact, CACHE_TTL);
      return successResponse(contact);
    } catch (error) {
      serviceLogger.error(error, "Error fetching contact:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch contact");
    }
  }

  async createContact(
    data: CreateContactRequest & { tenantId?: string }
  ): Promise<ApiResponse<Contact>> {
    try {
      if (!isValidEmail(data.email)) {
        return errorResponse("VALIDATION_ERROR", "Invalid email address");
      }

      const contact = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
      };

      const created = await contactQueries.create(contact);
      await cache.invalidatePattern("contacts:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating contact:");
      return errorResponse("DATABASE_ERROR", "Failed to create contact");
    }
  }

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
      serviceLogger.error(error, "Error fetching deals:");
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
      serviceLogger.error(error, "Error fetching deal:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch deal");
    }
  }

  async createDeal(data: CreateDealRequest): Promise<ApiResponse<Deal>> {
    try {
      const deal: Deal = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        stage: data.stage || "discovery",
        priority: data.priority || "medium",
        probability: data.probability ?? 20,
      };

      const created = await dealQueries.create(deal);
      await cache.invalidatePattern("deals:list:*");
      await cache.invalidatePattern("deals:pipeline:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating deal:");
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
      await cache.invalidatePattern("deals:pipeline:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating deal:");
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
      await cache.invalidatePattern("deals:pipeline:*");

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting deal:");
      return errorResponse("DATABASE_ERROR", "Failed to delete deal");
    }
  }

  async getPipelineSummary(): Promise<
    ApiResponse<{
      stages: { stage: DealStage; count: number; totalValue: number }[];
      totalDeals: number;
      totalValue: number;
      avgDealValue: number;
    }>
  > {
    try {
      const cacheKey = "deals:pipeline:summary";
      const cached = await cache.get<{
        stages: { stage: DealStage; count: number; totalValue: number }[];
        totalDeals: number;
        totalValue: number;
        avgDealValue: number;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const summary = await dealQueries.getPipelineSummary();
      await cache.set(cacheKey, summary, CACHE_TTL);

      return successResponse(summary);
    } catch (error) {
      serviceLogger.error(error, "Error fetching pipeline summary:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch pipeline summary");
    }
  }
}

export const crmService = new CRMService();
