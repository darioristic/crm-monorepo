import type {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  ApiResponse,
  PaginationParams,
  FilterParams,
} from "@crm/types";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  generateUUID,
  now,
  isEmpty,
  Errors,
} from "@crm/utils";
import { companyQueries } from "../db/queries/companies";
import { cache } from "../cache/redis";

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = "companies";

class CompaniesService {
  // ============================================
  // List Companies
  // ============================================

  async getCompanies(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Company[]>> {
    try {
      // Always exclude inline companies unless explicitly requested
      const effectiveFilters = {
        ...filters,
        source: filters.source || undefined, // Don't set source if not provided, let query handle it
      };

      const cacheKey = `${CACHE_PREFIX}:list:${JSON.stringify({ pagination, effectiveFilters })}`;
      const cached = await cache.get<{ data: Company[]; total: number }>(cacheKey);

      if (cached) {
        return paginatedResponse(cached.data, cached.total, pagination);
      }

      const { data, total } = await companyQueries.findAll(pagination, effectiveFilters);
      await cache.set(cacheKey, { data, total }, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      console.error("Error fetching companies:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch companies");
    }
  }

  // ============================================
  // Get Single Company
  // ============================================

  async getCompanyById(id: string): Promise<ApiResponse<Company>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:${id}`;
      const cached = await cache.get<Company>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const company = await companyQueries.findById(id);

      if (!company) {
        return Errors.NotFound("Company").toResponse();
      }

      await cache.set(cacheKey, company, CACHE_TTL);
      return successResponse(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch company");
    }
  }

  // ============================================
  // Create Company
  // ============================================

  async createCompany(data: CreateCompanyRequest): Promise<ApiResponse<Company>> {
    try {
      // Validation
      const validationError = this.validateCompanyData(data);
      if (validationError) {
        return errorResponse("VALIDATION_ERROR", validationError);
      }

      // Check for duplicate name
      const existing = await companyQueries.findByName(data.name);
      if (existing) {
        return errorResponse("CONFLICT", `Company with name "${data.name}" already exists`);
      }

      const company: Company = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        name: data.name.trim(),
        industry: data.industry.trim(),
        address: data.address.trim(),
      };

      const created = await companyQueries.createWithId(company);

      // Invalidate list cache
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);

      return successResponse(created);
    } catch (error) {
      console.error("Error creating company:", error);
      return errorResponse("DATABASE_ERROR", "Failed to create company");
    }
  }

  // ============================================
  // Update Company
  // ============================================

  async updateCompany(id: string, data: UpdateCompanyRequest): Promise<ApiResponse<Company>> {
    try {
      // Check if company exists
      const existing = await companyQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Company").toResponse();
      }

      // Validate update data
      if (data.name !== undefined && isEmpty(data.name)) {
        return errorResponse("VALIDATION_ERROR", "Company name cannot be empty");
      }

      // Check for duplicate name if changing
      if (data.name && data.name !== existing.name) {
        const duplicate = await companyQueries.findByName(data.name);
        if (duplicate) {
          return errorResponse("CONFLICT", `Company with name "${data.name}" already exists`);
        }
      }

      const updated = await companyQueries.update(id, {
        name: data.name?.trim(),
        industry: data.industry?.trim(),
        address: data.address?.trim(),
      });

      // Invalidate caches
      await cache.del(`${CACHE_PREFIX}:${id}`);
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);

      return successResponse(updated);
    } catch (error) {
      console.error("Error updating company:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update company");
    }
  }

  // ============================================
  // Delete Company
  // ============================================

  async deleteCompany(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await companyQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Company").toResponse();
      }

      await companyQueries.delete(id);

      // Invalidate caches
      await cache.del(`${CACHE_PREFIX}:${id}`);
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);
      // Also invalidate users cache since they may reference this company
      await cache.invalidatePattern("users:*");

      return successResponse({ deleted: true });
    } catch (error) {
      console.error("Error deleting company:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete company");
    }
  }

  // ============================================
  // Get Companies by Industry
  // ============================================

  async getCompaniesByIndustry(industry: string): Promise<ApiResponse<Company[]>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:industry:${industry}`;
      const cached = await cache.get<Company[]>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const companies = await companyQueries.findByIndustry(industry);
      await cache.set(cacheKey, companies, CACHE_TTL);

      return successResponse(companies);
    } catch (error) {
      console.error("Error fetching companies by industry:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch companies");
    }
  }

  // ============================================
  // Get Available Industries
  // ============================================

  async getIndustries(): Promise<ApiResponse<string[]>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:industries`;
      const cached = await cache.get<string[]>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const industries = await companyQueries.getIndustries();
      await cache.set(cacheKey, industries, CACHE_TTL);

      return successResponse(industries);
    } catch (error) {
      console.error("Error fetching industries:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch industries");
    }
  }

  // ============================================
  // Validation Helper
  // ============================================

  private validateCompanyData(data: CreateCompanyRequest): string | null {
    if (!data.name || isEmpty(data.name)) {
      return "Company name is required";
    }
    if (!data.industry || isEmpty(data.industry)) {
      return "Industry is required";
    }
    if (!data.address || isEmpty(data.address)) {
      return "Address is required";
    }
    return null;
  }
}

export const companiesService = new CompaniesService();
