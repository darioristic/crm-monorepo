/**
 * Invite Routes
 */

import { errorResponse } from "@crm/utils";
import { invitesService } from "../services/invites.service";
import { parseBody, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

// ============================================
// List Invites (for current company)
// ============================================

router.get("/api/v1/invites", async (request) => {
  return withAuth(request, async (auth) => {
    // Get user's active tenant (seller organization)
    const tenantId = auth.activeTenantId;
    if (!tenantId) {
      return errorResponse("NOT_FOUND", "No active tenant found for user");
    }

    return invitesService.getInvites(tenantId);
  });
});

// ============================================
// Create Invite
// ============================================

router.post("/api/v1/invites", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      // Get user's active tenant (seller organization)
      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return errorResponse("NOT_FOUND", "No active tenant found for user");
      }

      const body = await parseBody<{
        email: string;
        role: "owner" | "member" | "admin";
      }>(request);

      if (!body || !body.email || !body.role) {
        return errorResponse("VALIDATION_ERROR", "Email and role are required");
      }

      return invitesService.createInvite(
        tenantId,
        { email: body.email, role: body.role },
        auth.userId
      );
    },
    201
  );
});

// ============================================
// Delete Invite
// ============================================

router.delete("/api/v1/invites/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Get user's active tenant (seller organization)
    const tenantId = auth.activeTenantId;
    if (!tenantId) {
      return errorResponse("NOT_FOUND", "No active tenant found for user");
    }

    return invitesService.deleteInvite(params.id, tenantId);
  });
});

// ============================================
// Accept Invite (by token)
// ============================================

router.post("/api/v1/invites/accept/:token", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    return invitesService.acceptInvite(params.token, auth.userId);
  });
});

export const inviteRoutes = router.getRoutes();
