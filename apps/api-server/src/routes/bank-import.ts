/**
 * Bank Import Routes
 * API endpoints for importing bank statements
 */

import { errorResponse, successResponse } from "@crm/utils";
import { serviceLogger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";
import * as bankImportService from "../services/bank-import.service";

// ==============================================
// ROUTES
// ==============================================

export const bankImportRoutes: Route[] = [
  // GET /api/v1/bank-import/presets - Get available bank presets
  {
    method: "GET",
    pattern: /^\/api\/v1\/bank-import\/presets$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const presets = bankImportService.getBankPresets();

        return json(successResponse(presets.map((p) => ({
          id: p.id,
          name: p.name,
          country: p.country,
        }))));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get bank presets");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get bank presets"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/bank-import/presets/:id - Get specific bank preset
  {
    method: "GET",
    pattern: /^\/api\/v1\/bank-import\/presets\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const preset = bankImportService.getPresetById(params.id);

        if (!preset) {
          return json(errorResponse("NOT_FOUND", "Preset not found"), 404);
        }

        return json(successResponse(preset));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get bank preset");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get bank preset"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/bank-import/detect - Auto-detect bank from CSV
  {
    method: "POST",
    pattern: /^\/api\/v1\/bank-import\/detect$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { csvContent: string };

        if (!body?.csvContent) {
          return json(errorResponse("VALIDATION_ERROR", "CSV content is required"), 400);
        }

        const detectedPreset = bankImportService.detectBank(body.csvContent);

        return json(successResponse(detectedPreset
          ? {
              detected: true,
              preset: {
                id: detectedPreset.id,
                name: detectedPreset.name,
                country: detectedPreset.country,
                config: detectedPreset.config,
              },
            }
          : {
              detected: false,
              preset: null,
            }
        ));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to detect bank");
        return json(errorResponse("INTERNAL_ERROR", "Failed to detect bank format"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/bank-import/parse - Parse CSV without importing
  {
    method: "POST",
    pattern: /^\/api\/v1\/bank-import\/parse$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          csvContent: string;
          presetId?: string;
          config?: bankImportService.BankImportConfig;
        };

        if (!body?.csvContent) {
          return json(errorResponse("VALIDATION_ERROR", "CSV content is required"), 400);
        }

        let config: bankImportService.BankImportConfig;

        if (body.config) {
          config = body.config;
        } else if (body.presetId) {
          const preset = bankImportService.getPresetById(body.presetId);
          if (!preset) {
            return json(errorResponse("VALIDATION_ERROR", "Invalid preset ID"), 400);
          }
          config = preset.config;
        } else {
          const detected = bankImportService.detectBank(body.csvContent);
          if (!detected) {
            return json(errorResponse("VALIDATION_ERROR", "Could not detect bank format. Please specify a preset or custom config."), 400);
          }
          config = detected.config;
        }

        const result = bankImportService.parseBankStatement(body.csvContent, config);

        return json(successResponse({
          totalRows: result.totalRows,
          parsed: result.imported,
          errors: result.errors,
          errorDetails: result.errorDetails,
          preview: result.transactions.slice(0, 10).map((tx) => ({
            date: tx.date.toISOString(),
            amount: tx.amount,
            currency: tx.currency,
            description: tx.description,
            reference: tx.reference,
            isExpense: tx.isExpense,
          })),
          hasMore: result.transactions.length > 10,
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to parse bank statement");
        return json(errorResponse("INTERNAL_ERROR", "Failed to parse bank statement"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/bank-import/import - Import transactions from CSV
  {
    method: "POST",
    pattern: /^\/api\/v1\/bank-import\/import$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const body = (await request.json()) as {
          csvContent: string;
          presetId?: string;
          config?: bankImportService.BankImportConfig;
          bankAccountId?: string;
          defaultInvoiceId?: string;
          skipDuplicates?: boolean;
        };

        if (!body?.csvContent) {
          return json(errorResponse("VALIDATION_ERROR", "CSV content is required"), 400);
        }

        if (!body.defaultInvoiceId) {
          return json(errorResponse("VALIDATION_ERROR", "Default invoice ID is required for import"), 400);
        }

        let config: bankImportService.BankImportConfig;

        if (body.config) {
          config = body.config;
        } else if (body.presetId) {
          const preset = bankImportService.getPresetById(body.presetId);
          if (!preset) {
            return json(errorResponse("VALIDATION_ERROR", "Invalid preset ID"), 400);
          }
          config = preset.config;
        } else {
          const detected = bankImportService.detectBank(body.csvContent);
          if (!detected) {
            return json(errorResponse("VALIDATION_ERROR", "Could not detect bank format"), 400);
          }
          config = detected.config;
        }

        // Parse the statement
        const parseResult = bankImportService.parseBankStatement(body.csvContent, config);

        if (parseResult.transactions.length === 0) {
          return json(successResponse({
            success: false,
            parsed: 0,
            imported: 0,
            duplicates: 0,
            errors: parseResult.errors,
            errorDetails: parseResult.errorDetails,
          }));
        }

        // Import the transactions
        const importResult = await bankImportService.importTransactions(
          tenantId,
          body.bankAccountId || null,
          parseResult.transactions,
          {
            skipDuplicates: body.skipDuplicates !== false,
            defaultInvoiceId: body.defaultInvoiceId,
          }
        );

        return json(successResponse({
          success: true,
          parsed: parseResult.imported,
          imported: importResult.imported,
          duplicates: importResult.duplicates,
          errors: importResult.errors + parseResult.errors,
          errorDetails: parseResult.errorDetails,
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to import bank statement");
        return json(errorResponse("INTERNAL_ERROR", "Failed to import bank statement"), 500);
      }
    },
    params: [],
  },
];

export default bankImportRoutes;
