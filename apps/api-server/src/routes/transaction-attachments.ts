/**
 * Transaction Attachments API Routes
 * RESTful endpoints for attachment management
 */

import { errorResponse, successResponse } from "@crm/utils";
import {
  createAttachment,
  deleteAttachment,
  getAttachmentById,
  getAttachmentsByPayment,
  getUnlinkedAttachments,
  linkAttachmentToPayment,
  searchAttachments,
  unlinkAttachmentFromPayment,
  updateAttachment,
} from "../db/queries/transaction-attachments";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// ==============================================
// TRANSACTION ATTACHMENTS ROUTES
// ==============================================

export const transactionAttachmentRoutes: Route[] = [
  // GET /api/v1/transaction-attachments - Get unlinked attachments
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-attachments$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const attachments = await getUnlinkedAttachments(auth.activeTenantId!);
        return json(successResponse({ attachments }));
      } catch (error) {
        logger.error({ error }, "Error fetching attachments");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch attachments"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/transaction-attachments/search - Search attachments
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-attachments\/search$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const query = url.searchParams.get("q") || "";
        if (!query) {
          return json(successResponse({ attachments: [] }));
        }

        const attachments = await searchAttachments(auth.activeTenantId!, query);
        return json(successResponse({ attachments }));
      } catch (error) {
        logger.error({ error }, "Error searching attachments");
        return json(errorResponse("INTERNAL_ERROR", "Failed to search attachments"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/transaction-attachments/payment/:paymentId - Get attachments for a payment
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-attachments\/payment\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const attachments = await getAttachmentsByPayment(auth.activeTenantId!, params.paymentId);
        return json(successResponse({ attachments }));
      } catch (error) {
        logger.error({ error }, "Error fetching payment attachments");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch attachments"), 500);
      }
    },
    params: ["paymentId"],
  },

  // GET /api/v1/transaction-attachments/:id - Get attachment by ID
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-attachments\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const attachment = await getAttachmentById(auth.activeTenantId!, params.id);
        if (!attachment) {
          return json(errorResponse("NOT_FOUND", "Attachment not found"), 404);
        }

        return json(successResponse({ attachment }));
      } catch (error) {
        logger.error({ error }, "Error fetching attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch attachment"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/transaction-attachments - Create a new attachment
  {
    method: "POST",
    pattern: /^\/api\/v1\/transaction-attachments$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          paymentId?: string;
          name: string;
          filePath: string[];
          contentType?: string;
          size?: number;
          description?: string;
        };

        if (!body.name || !body.filePath || body.filePath.length === 0) {
          return json(errorResponse("VALIDATION_ERROR", "Name and filePath are required"), 400);
        }

        const attachment = await createAttachment({
          tenantId: auth.activeTenantId!,
          paymentId: body.paymentId,
          name: body.name,
          filePath: body.filePath,
          contentType: body.contentType,
          size: body.size,
          description: body.description,
          createdBy: auth.userId,
        });

        return json(successResponse({ attachment }), 201);
      } catch (error) {
        logger.error({ error }, "Error creating attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create attachment"), 500);
      }
    },
    params: [],
  },

  // PATCH /api/v1/transaction-attachments/:id - Update an attachment
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/transaction-attachments\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          name?: string;
          description?: string;
          paymentId?: string;
        };

        const attachment = await updateAttachment(auth.activeTenantId!, params.id, body);
        if (!attachment) {
          return json(errorResponse("NOT_FOUND", "Attachment not found"), 404);
        }

        return json(successResponse({ attachment }));
      } catch (error) {
        logger.error({ error }, "Error updating attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update attachment"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/transaction-attachments/:id/link - Link attachment to payment
  {
    method: "POST",
    pattern: /^\/api\/v1\/transaction-attachments\/([^/]+)\/link$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { paymentId: string };

        if (!body.paymentId) {
          return json(errorResponse("VALIDATION_ERROR", "paymentId is required"), 400);
        }

        const linked = await linkAttachmentToPayment(
          auth.activeTenantId!,
          params.id,
          body.paymentId
        );
        if (!linked) {
          return json(errorResponse("NOT_FOUND", "Attachment not found"), 404);
        }

        return json(successResponse({ message: "Attachment linked to payment" }));
      } catch (error) {
        logger.error({ error }, "Error linking attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to link attachment"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/transaction-attachments/:id/unlink - Unlink attachment from payment
  {
    method: "POST",
    pattern: /^\/api\/v1\/transaction-attachments\/([^/]+)\/unlink$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const unlinked = await unlinkAttachmentFromPayment(auth.activeTenantId!, params.id);
        if (!unlinked) {
          return json(errorResponse("NOT_FOUND", "Attachment not found"), 404);
        }

        return json(successResponse({ message: "Attachment unlinked from payment" }));
      } catch (error) {
        logger.error({ error }, "Error unlinking attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to unlink attachment"), 500);
      }
    },
    params: ["id"],
  },

  // DELETE /api/v1/transaction-attachments/:id - Delete an attachment
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/transaction-attachments\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const deleted = await deleteAttachment(auth.activeTenantId!, params.id);
        if (!deleted) {
          return json(errorResponse("NOT_FOUND", "Attachment not found"), 404);
        }

        return json(successResponse({ message: "Attachment deleted" }));
      } catch (error) {
        logger.error({ error }, "Error deleting attachment");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete attachment"), 500);
      }
    },
    params: ["id"],
  },
];
