/**
 * Request Validation Middleware
 *
 * Pruža funkcije za validaciju request body-ja, query parametara i URL parametara
 * korišćenjem Zod shema.
 */

import type { z } from "zod";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface ValidationError {
  code: "VALIDATION_ERROR";
  message: string;
  details?: Array<{
    path: string;
    message: string;
  }>;
}

export interface ValidationMiddlewareResult<T> {
  success: boolean;
  data?: T;
  error?: Response;
}

// ============================================
// Error Response Helpers
// ============================================

function createValidationErrorResponse(error: ValidationError): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validira JSON body request-a
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ValidationMiddlewareResult<T>> {
  try {
    // Proveri Content-Type
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return {
        success: false,
        error: createValidationErrorResponse({
          code: "VALIDATION_ERROR",
          message: "Content-Type must be application/json",
        }),
      };
    }

    // Parsiraj JSON
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return {
        success: false,
        error: createValidationErrorResponse({
          code: "VALIDATION_ERROR",
          message: "Invalid JSON body",
        }),
      };
    }

    // Validiraj sa Zod shemom
    const result = schema.safeParse(body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      logger.warn({ issues: details }, "Request body validation failed");

      return {
        success: false,
        error: createValidationErrorResponse({
          code: "VALIDATION_ERROR",
          message: details[0]?.message || "Validation failed",
          details,
        }),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error({ error }, "Unexpected error during body validation");
    return {
      success: false,
      error: createValidationErrorResponse({
        code: "VALIDATION_ERROR",
        message: "Failed to validate request body",
      }),
    };
  }
}

/**
 * Validira query parametre iz URL-a
 */
export function validateQuery<T>(url: URL, schema: z.ZodType<T>): ValidationMiddlewareResult<T> {
  try {
    // Konvertuj URLSearchParams u objekat
    const queryParams: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      const existing = queryParams[key];
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          queryParams[key] = [existing, value];
        }
      } else {
        queryParams[key] = value;
      }
    });

    // Validiraj sa Zod shemom
    const result = schema.safeParse(queryParams);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      logger.warn({ issues: details }, "Query params validation failed");

      return {
        success: false,
        error: createValidationErrorResponse({
          code: "VALIDATION_ERROR",
          message: details[0]?.message || "Invalid query parameters",
          details,
        }),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error({ error }, "Unexpected error during query validation");
    return {
      success: false,
      error: createValidationErrorResponse({
        code: "VALIDATION_ERROR",
        message: "Failed to validate query parameters",
      }),
    };
  }
}

/**
 * Validira URL parametre (npr. :id)
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: z.ZodType<T>
): ValidationMiddlewareResult<T> {
  try {
    const result = schema.safeParse(params);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      logger.warn({ issues: details }, "URL params validation failed");

      return {
        success: false,
        error: createValidationErrorResponse({
          code: "VALIDATION_ERROR",
          message: details[0]?.message || "Invalid URL parameters",
          details,
        }),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    logger.error({ error }, "Unexpected error during params validation");
    return {
      success: false,
      error: createValidationErrorResponse({
        code: "VALIDATION_ERROR",
        message: "Failed to validate URL parameters",
      }),
    };
  }
}

/**
 * Validira UUID parametar
 */
export function validateUuidParam(id: string | undefined): ValidationMiddlewareResult<string> {
  if (!id) {
    return {
      success: false,
      error: createValidationErrorResponse({
        code: "VALIDATION_ERROR",
        message: "ID parameter is required",
      }),
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return {
      success: false,
      error: createValidationErrorResponse({
        code: "VALIDATION_ERROR",
        message: "Invalid UUID format",
        details: [{ path: "id", message: "Must be a valid UUID" }],
      }),
    };
  }

  return {
    success: true,
    data: id,
  };
}

// ============================================
// Pagination & Filter Validation
// ============================================

import {
  type FilterInput,
  filterSchema,
  type PaginationInput,
  paginationSchema,
} from "../validators";

/**
 * Validira i parsira pagination parametre iz URL query-ja
 */
export function validatePagination(url: URL): ValidationMiddlewareResult<PaginationInput> {
  const res = validateQuery(url, paginationSchema);
  if (!res.success) return res as ValidationMiddlewareResult<PaginationInput>;
  const data = res.data as Partial<PaginationInput>;
  const normalized: PaginationInput = {
    sortOrder: data.sortOrder ?? "desc",
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 20,
    sortBy: data.sortBy,
  };
  return { success: true, data: normalized };
}

/**
 * Validira i parsira filter parametre iz URL query-ja
 */
export function validateFilters(url: URL): ValidationMiddlewareResult<FilterInput> {
  return validateQuery(url, filterSchema);
}

/**
 * Kombinovana funkcija za validaciju pagination + filters
 */
export function validateListParams(url: URL): ValidationMiddlewareResult<{
  pagination: PaginationInput;
  filters: FilterInput;
}> {
  const paginationResult = validatePagination(url);
  if (!paginationResult.success) {
    return {
      success: false,
      error: paginationResult.error,
    };
  }

  const filtersResult = validateFilters(url);
  if (!filtersResult.success) {
    return {
      success: false,
      error: filtersResult.error,
    };
  }

  return {
    success: true,
    data: {
      pagination: paginationResult.data!,
      filters: filtersResult.data!,
    },
  };
}

// ============================================
// Typed Route Handler Helper
// ============================================

/**
 * Wrapper za route handlere koji automatski validira request
 */
export function withValidation<TBody, TQuery, TParams>(options: {
  bodySchema?: z.ZodType<TBody>;
  querySchema?: z.ZodType<TQuery>;
  paramsSchema?: z.ZodType<TParams>;
}) {
  return async (
    request: Request,
    url: URL,
    params: Record<string, string>
  ): Promise<
    | { success: false; error: Response }
    | {
        success: true;
        body: TBody | undefined;
        query: TQuery | undefined;
        params: TParams | undefined;
      }
  > => {
    // Validate body if schema provided
    let body: TBody | undefined;
    if (options.bodySchema) {
      const result = await validateBody(request, options.bodySchema);
      if (!result.success) {
        return { success: false, error: result.error! };
      }
      body = result.data;
    }

    // Validate query if schema provided
    let query: TQuery | undefined;
    if (options.querySchema) {
      const result = validateQuery(url, options.querySchema);
      if (!result.success) {
        return { success: false, error: result.error! };
      }
      query = result.data;
    }

    // Validate params if schema provided
    let validatedParams: TParams | undefined;
    if (options.paramsSchema) {
      const result = validateParams(params, options.paramsSchema);
      if (!result.success) {
        return { success: false, error: result.error! };
      }
      validatedParams = result.data;
    }

    return {
      success: true,
      body,
      query,
      params: validatedParams,
    };
  };
}
