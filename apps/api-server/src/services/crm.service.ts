import type {
  ApiResponse,
  Contact,
  CreateContactRequest,
  CreateLeadRequest,
  FilterParams,
  Lead,
  PaginationParams,
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
import { contactQueries, leadQueries } from "../db/queries";
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
    filters: FilterParams
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

  async getContactById(id: string): Promise<ApiResponse<Contact>> {
    try {
      const cacheKey = `contacts:${id}`;
      const cached = await cache.get<Contact>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const contact = await contactQueries.findById(id);
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

  async createContact(data: CreateContactRequest): Promise<ApiResponse<Contact>> {
    try {
      if (!isValidEmail(data.email)) {
        return errorResponse("VALIDATION_ERROR", "Invalid email address");
      }

      const contact: Contact = {
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
}

export const crmService = new CRMService();
