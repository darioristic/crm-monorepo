/**
 * Connected Accounts Routes
 */

import { errorResponse, successResponse } from "@crm/utils";
import { connectedAccountQueries } from "../db/queries/connected-accounts";
import { RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

router.get("/api/v1/connected-accounts", async (request) => {
  return withAuth(request, async (auth) => {
    // Use active tenant ID from auth context (tenant-based architecture)
    if (!auth.activeTenantId) {
      return errorResponse("NOT_FOUND", "No active tenant found for user");
    }

    // Note: findByCompany uses company_id column which actually stores tenant ID
    // This will be renamed in a future migration to tenant_id for clarity
    const accounts = await connectedAccountQueries.findByCompany(auth.activeTenantId);
    return successResponse(accounts);
  });
});

export const connectedAccountRoutes = router.getRoutes();
