/**
 * Invite Routes
 */

import { errorResponse } from "@crm/utils";
import { invitesService } from "../services/invites.service";
import { RouteBuilder, withAuth, parseBody } from "./helpers";
import { userQueries } from "../db/queries/users";

const router = new RouteBuilder();

// ============================================
// List Invites (for current company)
// ============================================

router.get("/api/v1/invites", async (request) => {
	return withAuth(request, async (auth) => {
		// Get user's current company
		const companyId = await userQueries.getUserCompanyId(auth.userId);
		if (!companyId) {
			return errorResponse("NOT_FOUND", "No active company found for user");
		}

		return invitesService.getInvites(companyId);
	});
});

// ============================================
// Create Invite
// ============================================

router.post("/api/v1/invites", async (request) => {
	return withAuth(request, async (auth) => {
		// Get user's current company
		const companyId = await userQueries.getUserCompanyId(auth.userId);
		if (!companyId) {
			return errorResponse("NOT_FOUND", "No active company found for user");
		}

		const body = await parseBody<{
			email: string;
			role: "owner" | "member" | "admin";
		}>(request);

		if (!body || !body.email || !body.role) {
			return errorResponse("VALIDATION_ERROR", "Email and role are required");
		}

		return invitesService.createInvite(
			companyId,
			{ email: body.email, role: body.role },
			auth.userId,
		);
	}, 201);
});

// ============================================
// Delete Invite
// ============================================

router.delete("/api/v1/invites/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		// Get user's current company
		const companyId = await userQueries.getUserCompanyId(auth.userId);
		if (!companyId) {
			return errorResponse("NOT_FOUND", "No active company found for user");
		}

		return invitesService.deleteInvite(params.id, companyId);
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

