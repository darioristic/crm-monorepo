/**
 * Tax Rate Intelligence Routes
 * API endpoints for tax rate detection, validation, and calculation
 */

import { errorResponse, successResponse } from "@crm/utils";
import { verifyAndGetUser } from "../middleware/auth";
import * as taxService from "../services/tax-rate-intelligence.service";
import type { Route } from "./helpers";
import { json, parseBody } from "./helpers";

export const taxRatesRoutes: Route[] = [
  // GET /api/v1/tax-rates - Get all tax rates
  {
    method: "GET",
    pattern: /^\/api\/v1\/tax-rates$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const rates = taxService.getAllTaxRates();
      return json(successResponse({ rates, count: rates.length }));
    },
    params: [],
  },

  // GET /api/v1/tax-rates/eu - Get EU VAT rates
  {
    method: "GET",
    pattern: /^\/api\/v1\/tax-rates\/eu$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const rates = taxService.getEUVATRates();
      return json(successResponse({ rates, count: rates.length }));
    },
    params: [],
  },

  // GET /api/v1/tax-rates/country/:code - Get tax rate for specific country
  {
    method: "GET",
    pattern: /^\/api\/v1\/tax-rates\/country\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const rate = taxService.getTaxRateByCountry(params.code);
      if (!rate) {
        return json(errorResponse("NOT_FOUND", `Country not found: ${params.code}`), 404);
      }

      return json(successResponse(rate));
    },
    params: ["code"],
  },

  // GET /api/v1/tax-rates/us/:state - Get US state tax rate
  {
    method: "GET",
    pattern: /^\/api\/v1\/tax-rates\/us\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const rate = taxService.getUSStateTaxRate(params.state);
      if (!rate) {
        return json(errorResponse("NOT_FOUND", `US state not found: ${params.state}`), 404);
      }

      return json(successResponse(rate));
    },
    params: ["state"],
  },

  // GET /api/v1/tax-rates/search - Search countries by name
  {
    method: "GET",
    pattern: /^\/api\/v1\/tax-rates\/search$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const query = url.searchParams.get("q");
      if (!query || query.length < 2) {
        return json(errorResponse("VALIDATION_ERROR", "Query must be at least 2 characters"), 400);
      }

      const results = taxService.searchCountries(query);
      return json(successResponse({ results, count: results.length }));
    },
    params: [],
  },

  // POST /api/v1/tax-rates/detect - Detect tax from document text
  {
    method: "POST",
    pattern: /^\/api\/v1\/tax-rates\/detect$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const body = await parseBody<{
        text: string;
        amount?: number;
        taxAmount?: number;
      }>(request);

      if (!body?.text) {
        return json(errorResponse("VALIDATION_ERROR", "text required"), 400);
      }

      const result = taxService.detectTaxFromDocument(body.text, body.amount, body.taxAmount);
      return json(successResponse(result));
    },
    params: [],
  },

  // POST /api/v1/tax-rates/validate - Validate a tax rate for a country
  {
    method: "POST",
    pattern: /^\/api\/v1\/tax-rates\/validate$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const body = await parseBody<{
        countryCode: string;
        rate: number;
        tolerance?: number;
      }>(request);

      if (!body?.countryCode || body?.rate === undefined) {
        return json(errorResponse("VALIDATION_ERROR", "countryCode and rate required"), 400);
      }

      const result = taxService.validateTaxRate(body.countryCode, body.rate, body.tolerance);
      return json(successResponse(result));
    },
    params: [],
  },

  // POST /api/v1/tax-rates/calculate/from-total - Calculate tax from total amount
  {
    method: "POST",
    pattern: /^\/api\/v1\/tax-rates\/calculate\/from-total$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const body = await parseBody<{
        totalAmount: number;
        taxRate: number;
      }>(request);

      if (!body?.totalAmount || body?.taxRate === undefined) {
        return json(errorResponse("VALIDATION_ERROR", "totalAmount and taxRate required"), 400);
      }

      const result = taxService.calculateTaxFromTotal(body.totalAmount, body.taxRate);
      return json(successResponse(result));
    },
    params: [],
  },

  // POST /api/v1/tax-rates/calculate/from-net - Calculate total from net amount
  {
    method: "POST",
    pattern: /^\/api\/v1\/tax-rates\/calculate\/from-net$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const body = await parseBody<{
        netAmount: number;
        taxRate: number;
      }>(request);

      if (!body?.netAmount || body?.taxRate === undefined) {
        return json(errorResponse("VALIDATION_ERROR", "netAmount and taxRate required"), 400);
      }

      const result = taxService.calculateTotalFromNet(body.netAmount, body.taxRate);
      return json(successResponse(result));
    },
    params: [],
  },
];

export default taxRatesRoutes;
