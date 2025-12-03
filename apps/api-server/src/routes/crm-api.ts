/**
 * CRM API Routes
 * Accessible to crm_user role users with company context
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, json } from "./helpers";
import { requireAuth } from "../middleware/auth";
import { requireTenantContext } from "../system/tenant-context/middleware";
import { requireCompanyContext } from "../system/company-context/middleware";
import { db } from "../db/client";
import { companies, documents, contacts, activities } from "../db/schema/index";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
	buildCompanyScopedDocumentQuery,
	buildCompanyScopedContactQuery,
	buildCompanyScopedActivityQuery,
} from "../infrastructure/db/query-helpers";

const router = new RouteBuilder();

// ============================================
// Companies (tenant-scoped)
// ============================================

// List companies in tenant
router.get(
	"/api/crm/companies",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const tenantCompanies = await db
					.select()
					.from(companies)
					.where(eq(companies.tenantId, tenantContext.tenantId));

				return json(successResponse(tenantCompanies));
			} catch (error) {
				logger.error({ error }, "Error listing companies");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to list companies"),
					500,
				);
			}
		}),
	),
);

// Get company by ID
router.get(
	"/api/crm/companies/:id",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const company = await db
					.select()
					.from(companies)
					.where(
						and(
							eq(companies.id, params.id),
							eq(companies.tenantId, tenantContext.tenantId),
						),
					)
					.limit(1);

				if (company.length === 0) {
					return json(errorResponse("NOT_FOUND", "Company not found"), 404);
				}

				return json(successResponse(company[0]));
			} catch (error) {
				logger.error({ error }, "Error getting company");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get company"),
					500,
				);
			}
		}),
	),
);

// ============================================
// Documents (company-scoped)
// ============================================

// List documents for a company
router.get(
	"/api/crm/companies/:companyId/documents",
	requireAuth(
		requireTenantContext(
			requireCompanyContext(
				async (
					request,
					url,
					params,
					auth,
					tenantContext,
					companyContext,
				) => {
					try {
						const companyDocuments = await db
							.select()
							.from(documents)
							.where(
								buildCompanyScopedDocumentQuery(
									tenantContext.tenantId,
									companyContext.companyId,
								),
							);

						return json(successResponse(companyDocuments));
					} catch (error) {
						logger.error({ error }, "Error listing documents");
						return json(
							errorResponse("INTERNAL_ERROR", "Failed to list documents"),
							500,
						);
					}
				},
			),
		),
	),
);

// ============================================
// Contacts (company-scoped)
// ============================================

// List contacts for a company
router.get(
	"/api/crm/companies/:companyId/contacts",
	requireAuth(
		requireTenantContext(
			requireCompanyContext(
				async (
					request,
					url,
					params,
					auth,
					tenantContext,
					companyContext,
				) => {
					try {
						const companyContacts = await db
							.select()
							.from(contacts)
							.where(
								buildCompanyScopedContactQuery(
									tenantContext.tenantId,
									companyContext.companyId,
								),
							);

						return json(successResponse(companyContacts));
					} catch (error) {
						logger.error({ error }, "Error listing contacts");
						return json(
							errorResponse("INTERNAL_ERROR", "Failed to list contacts"),
							500,
						);
					}
				},
			),
		),
	),
);

// ============================================
// Activities (company-scoped)
// ============================================

// List activities for a company
router.get(
	"/api/crm/companies/:companyId/activities",
	requireAuth(
		requireTenantContext(
			requireCompanyContext(
				async (
					request,
					url,
					params,
					auth,
					tenantContext,
					companyContext,
				) => {
					try {
						const companyActivities = await db
							.select()
							.from(activities)
							.where(
								buildCompanyScopedActivityQuery(
									tenantContext.tenantId,
									companyContext.companyId,
								),
							);

						return json(successResponse(companyActivities));
					} catch (error) {
						logger.error({ error }, "Error listing activities");
						return json(
							errorResponse("INTERNAL_ERROR", "Failed to list activities"),
							500,
						);
					}
				},
			),
		),
	),
);

export const crmApiRoutes = router.getRoutes();
