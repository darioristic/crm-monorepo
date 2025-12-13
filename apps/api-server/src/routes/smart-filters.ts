/**
 * Smart Filters API Routes
 * AI-powered natural language to filter conversion
 */

import { errorResponse, successResponse } from "@crm/utils";
import { z } from "zod";
import {
  generateCustomerFilters,
  generateDocumentFilters,
  generateGlobalSearchFilters,
  generateInvoiceFilters,
  generateProductFilters,
  generateTransactionFilters,
} from "../ai/filters";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// Request schema
const filterRequestSchema = z.object({
  query: z.string().min(1).max(500),
  timezone: z.string().optional(),
  context: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      customers: z.array(z.string()).optional(),
      industries: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
    })
    .optional(),
});

export const smartFiltersRoutes: Route[] = [
  // POST /api/v1/ai/filters/transactions - Generate transaction filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/transactions$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone, context } = validation.data;

        const filters = await generateTransactionFilters(query, {
          timezone,
          categories: context?.categories,
          tags: context?.tags,
        });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate transaction filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/ai/filters/invoices - Generate invoice filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/invoices$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone, context } = validation.data;

        const filters = await generateInvoiceFilters(query, {
          timezone,
          customers: context?.customers,
        });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate invoice filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/ai/filters/customers - Generate customer filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/customers$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone, context } = validation.data;

        const filters = await generateCustomerFilters(query, {
          timezone,
          industries: context?.industries,
          countries: context?.countries,
        });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate customer filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/ai/filters/documents - Generate document filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/documents$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone, context } = validation.data;

        const filters = await generateDocumentFilters(query, {
          timezone,
          tags: context?.tags,
        });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate document filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/ai/filters/products - Generate product filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/products$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone, context } = validation.data;

        const filters = await generateProductFilters(query, {
          timezone,
          categories: context?.categories,
        });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate product filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/ai/filters/search - Generate global search filters
  {
    method: "POST",
    pattern: /^\/api\/v1\/ai\/filters\/search$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        const validation = filterRequestSchema.safeParse(body);

        if (!validation.success) {
          return json(errorResponse("VALIDATION_ERROR", validation.error.message), 400);
        }

        const { query, timezone } = validation.data;

        const filters = await generateGlobalSearchFilters(query, { timezone });

        return json(successResponse({ filters }));
      } catch (error) {
        logger.error({ error }, "Failed to generate search filters");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate filters"), 500);
      }
    },
    params: [],
  },
];

export default smartFiltersRoutes;
