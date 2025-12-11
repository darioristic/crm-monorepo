/**
 * Currency Routes
 * API endpoints for currency conversion and exchange rates
 */

import { errorResponse, successResponse } from "@crm/utils";
import { serviceLogger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";
import * as currencyService from "../services/currency.service";

// ==============================================
// ROUTES
// ==============================================

export const currencyRoutes: Route[] = [
  // GET /api/v1/currencies - Get all supported currencies
  {
    method: "GET",
    pattern: /^\/api\/v1\/currencies$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const currencies = currencyService.getSupportedCurrencies();

        return json(successResponse({
          currencies,
          baseCurrency: currencyService.getBaseCurrency(),
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get currencies");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get currencies"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/currencies/:code - Get currency info by code
  {
    method: "GET",
    pattern: /^\/api\/v1\/currencies\/([A-Za-z]{3})$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const currency = currencyService.getCurrencyInfo(params.code);

        if (!currency) {
          return json(errorResponse("NOT_FOUND", "Currency not found"), 404);
        }

        return json(successResponse(currency));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get currency info");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get currency info"), 500);
      }
    },
    params: ["code"],
  },

  // GET /api/v1/exchange-rates - Get exchange rate between currencies
  {
    method: "GET",
    pattern: /^\/api\/v1\/exchange-rates$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const date = url.searchParams.get("date") || undefined;

        if (!from || !to) {
          return json(errorResponse("VALIDATION_ERROR", "Both 'from' and 'to' currency codes are required"), 400);
        }

        const rate = await currencyService.getExchangeRate(from, to, date);

        if (!rate) {
          return json(errorResponse("NOT_FOUND", "Could not fetch exchange rate"), 404);
        }

        return json(successResponse(rate));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get exchange rate");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get exchange rate"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/currency/convert - Convert amount between currencies
  {
    method: "POST",
    pattern: /^\/api\/v1\/currency\/convert$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          amount: number;
          from: string;
          to: string;
          date?: string;
        };

        if (!body?.amount || !body?.from || !body?.to) {
          return json(errorResponse("VALIDATION_ERROR", "Amount, from, and to currencies are required"), 400);
        }

        const result = await currencyService.convertAmount(
          body.amount,
          body.from,
          body.to,
          body.date
        );

        if (!result) {
          return json(errorResponse("NOT_FOUND", "Could not convert amount"), 404);
        }

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to convert amount");
        return json(errorResponse("INTERNAL_ERROR", "Failed to convert amount"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/currency/update-base/:paymentId - Update base currency for payment
  {
    method: "POST",
    pattern: /^\/api\/v1\/currency\/update-base\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const success = await currencyService.updatePaymentBaseCurrency(
          params.paymentId,
          tenantId
        );

        if (!success) {
          return json(errorResponse("NOT_FOUND", "Could not update payment base currency"), 400);
        }

        return json(successResponse({
          success: true,
          baseCurrency: currencyService.getBaseCurrency(),
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to update payment base currency");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update payment base currency"), 500);
      }
    },
    params: ["paymentId"],
  },

  // POST /api/v1/currency/batch-update - Batch update base currency
  {
    method: "POST",
    pattern: /^\/api\/v1\/currency\/batch-update$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        let limit: number | undefined;
        try {
          const body = (await request.json()) as { limit?: number };
          limit = body?.limit;
        } catch {
          // No body
        }

        const result = await currencyService.batchUpdateBaseCurrency(tenantId, {
          limit,
        });

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to batch update base currency");
        return json(errorResponse("INTERNAL_ERROR", "Failed to batch update base currency"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/currency/format - Format amount with currency
  {
    method: "POST",
    pattern: /^\/api\/v1\/currency\/format$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          amount: number;
          currency: string;
        };

        if (!body?.amount || !body?.currency) {
          return json(errorResponse("VALIDATION_ERROR", "Amount and currency are required"), 400);
        }

        const formatted = currencyService.formatCurrency(body.amount, body.currency);

        return json(successResponse({
          formatted,
          amount: body.amount,
          currency: body.currency,
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to format amount");
        return json(errorResponse("INTERNAL_ERROR", "Failed to format amount"), 500);
      }
    },
    params: [],
  },
];

export default currencyRoutes;
