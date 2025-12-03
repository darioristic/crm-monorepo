/**
 * Connected Accounts Routes
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, withAuth } from "./helpers";
import { connectedAccountQueries } from "../db/queries/connected-accounts";
import { userQueries } from "../db/queries/users";

const router = new RouteBuilder();

router.get("/api/v1/connected-accounts", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = await userQueries.getUserCompanyId(auth.userId);
		if (!companyId) {
			return errorResponse("NOT_FOUND", "No active company found for user");
		}

		const accounts = await connectedAccountQueries.findByCompany(companyId);
		return successResponse(accounts);
	});
});

export const connectedAccountRoutes = router.getRoutes();

