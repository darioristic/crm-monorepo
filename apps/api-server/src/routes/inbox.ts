/**
 * Magic Inbox API Routes
 * Adapted from Midday's Magic Inbox feature
 */

import { errorResponse, successResponse } from "@crm/utils";
import {
  confirmSuggestedMatch,
  createInbox,
  createInboxBlocklist,
  declineSuggestedMatch,
  deleteInbox,
  deleteInboxAccount,
  deleteInboxBlocklist,
  getInbox,
  getInboxAccountById,
  getInboxAccounts,
  getInboxBlocklist,
  getInboxById,
  getInboxStats,
  getMatchSuggestionHistory,
  type InboxBlocklistType,
  type InboxStatus,
  unmatchInboxItem,
  updateInbox,
  updateInboxAccount,
  upsertInboxAccount,
} from "../db/queries/inbox";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import { updateCalibration } from "../services/calibration.service";
import * as fileStorage from "../services/file-storage.service";
import { processInboxItem } from "../services/inbox-ai.service";
import {
  getInboxQueueStats,
  initializeInboxQueue,
  queueInboxProcessing,
} from "../services/inbox-queue.service";
import type { Route } from "./helpers";
import { json } from "./helpers";

// Initialize inbox queue on module load
initializeInboxQueue().catch((err) => {
  logger.error({ error: err }, "Failed to initialize inbox queue");
});

// Supported MIME types for inbox uploads
const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ==============================================
// INBOX ROUTES
// ==============================================

export const inboxRoutes: Route[] = [
  // GET /api/v1/inbox - List inbox items
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const cursor = url.searchParams.get("cursor");
        const order = url.searchParams.get("order");
        const sort = url.searchParams.get("sort");
        const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
        const q = url.searchParams.get("q");
        const status = url.searchParams.get("status") as InboxStatus | null;

        const result = await getInbox({
          tenantId: auth.activeTenantId!,
          cursor,
          order,
          sort,
          pageSize,
          q,
          status,
        });

        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Error fetching inbox");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch inbox"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/inbox/stats - Get inbox statistics
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/stats$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const stats = await getInboxStats(auth.activeTenantId!);
        return json(successResponse(stats));
      } catch (error) {
        logger.error({ error }, "Error fetching inbox stats");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch stats"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/inbox/queue/stats - Get processing queue statistics
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/queue\/stats$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const queueStats = await getInboxQueueStats();
        return json(successResponse(queueStats));
      } catch (error) {
        logger.error({ error }, "Error fetching queue stats");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch queue stats"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/inbox/:id - Get inbox item by ID
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const item = await getInboxById(params.id, auth.activeTenantId!);
        if (!item) {
          return json(errorResponse("NOT_FOUND", "Inbox item not found"), 404);
        }

        return json(successResponse(item));
      } catch (error) {
        logger.error({ error }, "Error fetching inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch inbox item"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/inbox/upload - Upload files to inbox
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/upload$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const formData = await request.formData();
        const files = formData.getAll("files");

        if (!files || files.length === 0) {
          return json(errorResponse("VALIDATION_ERROR", "No files provided"), 400);
        }

        const results: Array<{
          id: string;
          fileName: string;
          status: "success" | "error";
          error?: string;
        }> = [];

        for (const fileValue of files) {
          // Handle File objects
          if (typeof fileValue !== "object" || !("arrayBuffer" in fileValue)) {
            results.push({
              id: "",
              fileName: "unknown",
              status: "error",
              error: "Invalid file format",
            });
            continue;
          }

          const file = fileValue as File;
          const originalName = file.name || "upload.bin";
          const mimetype = file.type || "application/octet-stream";
          const size = file.size;

          // Validate file size
          if (size > MAX_FILE_SIZE) {
            results.push({
              id: "",
              fileName: originalName,
              status: "error",
              error: "File too large (max 5MB)",
            });
            continue;
          }

          // Validate MIME type
          if (!SUPPORTED_MIME_TYPES.includes(mimetype)) {
            results.push({
              id: "",
              fileName: originalName,
              status: "error",
              error: "Unsupported file type",
            });
            continue;
          }

          try {
            // Upload file to storage using tenant ID as the storage folder
            const uploadResult = await fileStorage.uploadFile(
              `inbox-${auth.activeTenantId}`,
              file,
              originalName
            );

            // Create inbox item with the actual file path
            // Set status to "pending" so items are immediately visible
            // (background OCR processing not implemented yet)
            const item = await createInbox({
              tenantId: auth.activeTenantId!,
              displayName: originalName,
              filePath: uploadResult.path,
              fileName: uploadResult.filename,
              contentType: mimetype,
              size: uploadResult.size,
              status: "pending",
            });

            results.push({
              id: item.id as string,
              fileName: originalName,
              status: "success",
            });

            // Queue AI processing (uses simple queue, no Redis required)
            queueInboxProcessing(item.id as string, auth.activeTenantId!, {
              generateEmbeddings: false,
            }).catch((err) => {
              logger.error({ error: err, inboxId: item.id }, "Failed to queue inbox processing");
              // Fallback to direct processing if queue fails
              processInboxItem(item.id as string, auth.activeTenantId!, {
                generateEmbeddings: false,
              }).catch((err2) => {
                logger.error({ error: err2, inboxId: item.id }, "Direct AI processing also failed");
              });
            });
          } catch (uploadError) {
            logger.error(
              { error: uploadError, fileName: originalName },
              "Error uploading inbox file"
            );
            results.push({
              id: "",
              fileName: originalName,
              status: "error",
              error: "Upload failed",
            });
          }
        }

        const successCount = results.filter((r) => r.status === "success").length;
        const failedCount = results.filter((r) => r.status === "error").length;

        return json(
          successResponse({
            items: results.filter((r) => r.status === "success"),
            report: {
              uploadedCount: successCount,
              failedCount,
              failures: results
                .filter((r) => r.status === "error")
                .map((r) => ({ name: r.fileName, reason: r.error || "Unknown error" })),
            },
          }),
          201
        );
      } catch (error) {
        logger.error({ error }, "Error processing inbox upload");
        return json(errorResponse("INTERNAL_ERROR", "Failed to process upload"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/inbox - Create inbox item (for manual creation without file)
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          displayName: string;
          filePath: string[];
          fileName: string;
          contentType: string;
          size: number;
          referenceId?: string;
          website?: string;
          senderEmail?: string;
        };

        const item = await createInbox({
          tenantId: auth.activeTenantId!,
          ...body,
        });

        return json(successResponse(item), 201);
      } catch (error) {
        logger.error({ error }, "Error creating inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create inbox item"), 500);
      }
    },
    params: [],
  },

  // PATCH /api/v1/inbox/:id - Update inbox item
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/inbox\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          status?: InboxStatus;
          displayName?: string;
          amount?: number;
          currency?: string;
          date?: string;
          type?: "invoice" | "expense" | "receipt" | "other" | null;
        };

        const item = await updateInbox({
          id: params.id,
          tenantId: auth.activeTenantId!,
          ...body,
        });

        if (!item) {
          return json(errorResponse("NOT_FOUND", "Inbox item not found"), 404);
        }

        return json(successResponse(item));
      } catch (error) {
        logger.error({ error }, "Error updating inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update inbox item"), 500);
      }
    },
    params: ["id"],
  },

  // DELETE /api/v1/inbox/:id - Delete inbox item
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/inbox\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await deleteInbox(params.id, auth.activeTenantId!);
        if (!result) {
          return json(errorResponse("NOT_FOUND", "Inbox item not found"), 404);
        }

        return json(successResponse({ message: "Inbox item deleted" }));
      } catch (error) {
        logger.error({ error }, "Error deleting inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete inbox item"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/inbox/:id/match/:transactionId - Confirm a match suggestion
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/([^/]+)\/match\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { suggestionId: string };

        const result = await confirmSuggestedMatch({
          tenantId: auth.activeTenantId!,
          suggestionId: body.suggestionId,
          inboxId: params.inboxId,
          transactionId: params.transactionId,
          userId: auth.userId,
        });

        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Error confirming match");
        return json(errorResponse("INTERNAL_ERROR", "Failed to confirm match"), 500);
      }
    },
    params: ["inboxId", "transactionId"],
  },

  // POST /api/v1/inbox/:id/decline - Decline a match suggestion
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/([^/]+)\/decline$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { suggestionId: string };

        await declineSuggestedMatch({
          tenantId: auth.activeTenantId!,
          suggestionId: body.suggestionId,
          inboxId: params.id,
          userId: auth.userId,
        });

        return json(successResponse({ message: "Match declined" }));
      } catch (error) {
        logger.error({ error }, "Error declining match");
        return json(errorResponse("INTERNAL_ERROR", "Failed to decline match"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/inbox/:id/unmatch - Unmatch a previously confirmed match
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/([^/]+)\/unmatch$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await unmatchInboxItem({
          tenantId: auth.activeTenantId!,
          inboxId: params.id,
          userId: auth.userId,
        });

        if (!result.success) {
          return json(errorResponse("BAD_REQUEST", "Item is not matched or not found"), 400);
        }

        // Trigger calibration update in background (negative feedback recorded)
        updateCalibration(auth.activeTenantId!).catch((err) => {
          logger.error({ error: err }, "Failed to update calibration after unmatch");
        });

        return json(
          successResponse({
            message: "Match removed successfully",
            transactionId: result.transactionId,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error unmatching inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to unmatch"), 500);
      }
    },
    params: ["id"],
  },

  // GET /api/v1/inbox/:id/suggestions - Get match suggestion history
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/([^/]+)\/suggestions$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const suggestions = await getMatchSuggestionHistory(auth.activeTenantId!, params.id);

        return json(successResponse({ suggestions }));
      } catch (error) {
        logger.error({ error }, "Error getting suggestion history");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get suggestions"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/inbox/:id/process - Manually trigger AI processing
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/([^/]+)\/process$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        // Check if item exists
        const item = await getInboxById(params.id, auth.activeTenantId!);
        if (!item) {
          return json(errorResponse("NOT_FOUND", "Inbox item not found"), 404);
        }

        // Parse optional body for embedding generation
        let generateEmbeddings = false;
        try {
          const body = (await request.json()) as { generateEmbeddings?: boolean };
          generateEmbeddings = body.generateEmbeddings || false;
        } catch {
          // Body is optional
        }

        // Process the item with AI
        const result = await processInboxItem(params.id, auth.activeTenantId!, {
          generateEmbeddings,
        });

        if (!result.success) {
          return json(errorResponse("PROCESSING_ERROR", result.error || "Processing failed"), 500);
        }

        return json(
          successResponse({
            message: "Processing completed",
            ocrResult: result.ocrResult
              ? {
                  confidence: result.ocrResult.confidence,
                  provider: result.ocrResult.provider,
                  extractedData: result.ocrResult.extractedData,
                }
              : null,
            embeddingCreated: result.embeddingCreated,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error processing inbox item");
        return json(errorResponse("INTERNAL_ERROR", "Failed to process inbox item"), 500);
      }
    },
    params: ["id"],
  },

  // ==============================================
  // INBOX ACCOUNTS ROUTES
  // ==============================================

  // GET /api/v1/inbox/accounts - List connected email accounts
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/accounts$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const accounts = await getInboxAccounts(auth.activeTenantId!);
        return json(successResponse(accounts));
      } catch (error) {
        logger.error({ error }, "Error fetching inbox accounts");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch accounts"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/inbox/accounts/:id - Get inbox account by ID
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/accounts\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const account = await getInboxAccountById(params.id, auth.activeTenantId!);
        if (!account) {
          return json(errorResponse("NOT_FOUND", "Account not found"), 404);
        }

        return json(successResponse(account));
      } catch (error) {
        logger.error({ error }, "Error fetching inbox account");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch account"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/inbox/accounts - Connect email account (OAuth callback)
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/accounts$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          provider: string;
          accessToken: string;
          refreshToken: string;
          email: string;
          externalId: string;
          expiryDate: string;
        };

        const account = await upsertInboxAccount({
          tenantId: auth.activeTenantId!,
          provider: body.provider,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          email: body.email,
          externalId: body.externalId,
          expiryDate: body.expiryDate,
          lastAccessed: new Date().toISOString(),
        });

        return json(successResponse(account), 201);
      } catch (error) {
        logger.error({ error }, "Error connecting inbox account");
        return json(errorResponse("INTERNAL_ERROR", "Failed to connect account"), 500);
      }
    },
    params: [],
  },

  // PATCH /api/v1/inbox/accounts/:id - Update inbox account
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/inbox\/accounts\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          status?: "connected" | "disconnected" | "error";
          errorMessage?: string | null;
        };

        const account = await updateInboxAccount(params.id, body);
        if (!account) {
          return json(errorResponse("NOT_FOUND", "Account not found"), 404);
        }

        return json(successResponse(account));
      } catch (error) {
        logger.error({ error }, "Error updating inbox account");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update account"), 500);
      }
    },
    params: ["id"],
  },

  // DELETE /api/v1/inbox/accounts/:id - Disconnect email account
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/inbox\/accounts\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await deleteInboxAccount(params.id, auth.activeTenantId!);
        if (!result) {
          return json(errorResponse("NOT_FOUND", "Account not found"), 404);
        }

        return json(successResponse({ message: "Account disconnected" }));
      } catch (error) {
        logger.error({ error }, "Error disconnecting inbox account");
        return json(errorResponse("INTERNAL_ERROR", "Failed to disconnect account"), 500);
      }
    },
    params: ["id"],
  },

  // ==============================================
  // INBOX BLOCKLIST ROUTES
  // ==============================================

  // GET /api/v1/inbox/blocklist - Get blocklist
  {
    method: "GET",
    pattern: /^\/api\/v1\/inbox\/blocklist$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const blocklist = await getInboxBlocklist(auth.activeTenantId!);
        return json(successResponse(blocklist));
      } catch (error) {
        logger.error({ error }, "Error fetching blocklist");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch blocklist"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/inbox/blocklist - Add to blocklist
  {
    method: "POST",
    pattern: /^\/api\/v1\/inbox\/blocklist$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          type: InboxBlocklistType;
          value: string;
        };

        if (!body.type || !body.value) {
          return json(errorResponse("VALIDATION_ERROR", "Type and value required"), 400);
        }

        const item = await createInboxBlocklist(auth.activeTenantId!, body.type, body.value);
        return json(successResponse(item), 201);
      } catch (error) {
        logger.error({ error }, "Error adding to blocklist");
        return json(errorResponse("INTERNAL_ERROR", "Failed to add to blocklist"), 500);
      }
    },
    params: [],
  },

  // DELETE /api/v1/inbox/blocklist/:id - Remove from blocklist
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/inbox\/blocklist\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await deleteInboxBlocklist(params.id, auth.activeTenantId!);
        if (!result) {
          return json(errorResponse("NOT_FOUND", "Blocklist item not found"), 404);
        }

        return json(successResponse({ message: "Removed from blocklist" }));
      } catch (error) {
        logger.error({ error }, "Error removing from blocklist");
        return json(errorResponse("INTERNAL_ERROR", "Failed to remove from blocklist"), 500);
      }
    },
    params: ["id"],
  },
];
