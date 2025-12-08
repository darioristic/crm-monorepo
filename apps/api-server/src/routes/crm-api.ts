/**
 * CRM API Routes
 * Accessible to crm_user role users with company context
 */

import { errorResponse, successResponse } from "@crm/utils";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { createCompany, deleteCompany, getCompanyById } from "../db/queries/companies-members";
import { activities, companies, contacts, customerCompanies, documents } from "../db/schema/index";
import {
  buildCompanyScopedActivityQuery,
  buildCompanyScopedContactQuery,
  buildCompanyScopedDocumentQuery,
} from "../infrastructure/db/query-helpers";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { requireCompanyContext } from "../system/company-context/middleware";
import { requireTenantContext } from "../system/tenant-context/middleware";
import { json, parseBody, RouteBuilder } from "./helpers";

const router = new RouteBuilder();

// ============================================
// Companies (tenant-scoped)
// ============================================

// List companies in tenant
router.get(
  "/api/crm/companies",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        // Backfill extension table for existing customer companies (one-time)
        const customerCompaniesSeed = await db
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(eq(companies.tenantId, tenantContext.tenantId), eq(companies.source, "customer"))
          );

        for (const c of customerCompaniesSeed) {
          try {
            await db.insert(customerCompanies).values({
              id: c.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch {}
        }

        const rows = await db
          .select()
          .from(companies)
          .innerJoin(customerCompanies, eq(customerCompanies.id, companies.id))
          .where(eq(companies.tenantId, tenantContext.tenantId));

        const result = rows.map((row) => row.companies);
        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Error listing companies");
        return json(errorResponse("INTERNAL_ERROR", "Failed to list companies"), 500);
      }
    })
  )
);

// Get company by ID
router.get(
  "/api/crm/companies/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        const company = await db
          .select()
          .from(companies)
          .where(and(eq(companies.id, _params.id), eq(companies.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (company.length === 0) {
          return json(errorResponse("NOT_FOUND", "Company not found"), 404);
        }

        return json(successResponse(company[0]));
      } catch (error) {
        logger.error({ error }, "Error getting company");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get company"), 500);
      }
    })
  )
);

// Create company in tenant
router.post(
  "/api/crm/companies",
  requireAuth(
    requireTenantContext(async (request, _url, _params, auth, _tenantContext) => {
      try {
        const body = await parseBody<{
          name: string;
          industry: string;
          address: string;
          email?: string;
          phone?: string;
          website?: string;
          contact?: string;
          city?: string;
          zip?: string;
          country?: string;
          countryCode?: string;
          vatNumber?: string;
          companyNumber?: string;
          note?: string;
          logoUrl?: string;
        }>(request);

        if (!body) {
          return json(errorResponse("VALIDATION_ERROR", "Invalid request body"), 400);
        }

        if (!body.name || !body.industry || !body.address) {
          return json(
            errorResponse("VALIDATION_ERROR", "Name, industry, and address are required"),
            400
          );
        }

        // Create company with source='customer' for CRM module
        const companyId = await createCompany({
          name: body.name,
          industry: body.industry,
          address: body.address,
          userId: auth.userId,
          email: body.email,
          phone: body.phone,
          website: body.website,
          contact: body.contact,
          city: body.city,
          zip: body.zip,
          country: body.country,
          countryCode: body.countryCode,
          vatNumber: body.vatNumber,
          companyNumber: body.companyNumber,
          note: body.note,
          logoUrl: body.logoUrl,
          switchCompany: false,
          source: "customer",
        });

        const company = await getCompanyById(companyId);
        if (!company) {
          return json(errorResponse("SERVER_ERROR", "Failed to retrieve created company"), 500);
        }

        // Add to customer extension table
        try {
          await db.insert(customerCompanies).values({
            id: company.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch {}

        return json(successResponse(company), 201);
      } catch (error) {
        logger.error({ error }, "Error creating company");
        return json(
          errorResponse(
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : "Failed to create company"
          ),
          500
        );
      }
    })
  )
);

// Delete company from tenant
router.delete(
  "/api/crm/companies/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, auth, tenantContext) => {
      try {
        // Verify company belongs to tenant
        const company = await db
          .select()
          .from(companies)
          .where(and(eq(companies.id, _params.id), eq(companies.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (company.length === 0) {
          return json(errorResponse("NOT_FOUND", "Company not found"), 404);
        }

        const companyData = company[0];

        // For customer companies, delete directly (they don't have membership)
        // For account companies, use the regular deleteCompany function
        if (companyData.source === "customer") {
          // Check if company has related data
          const { sql } = await import("../db/client");
          const relatedDataCheck = await sql`
						SELECT 
							(SELECT COUNT(*) FROM invoices WHERE company_id = ${_params.id}) as invoice_count,
							(SELECT COUNT(*) FROM quotes WHERE company_id = ${_params.id}) as quote_count,
							(SELECT COUNT(*) FROM delivery_notes WHERE company_id = ${_params.id}) as delivery_note_count,
							(SELECT COUNT(*) FROM orders WHERE company_id = ${_params.id}) as order_count,
							(SELECT COUNT(*) FROM contacts WHERE company_id = ${_params.id}) as contact_count,
							(SELECT COUNT(*) FROM documents WHERE company_id = ${_params.id}) as document_count
					`;

          const counts = relatedDataCheck[0];
          const invoiceCount = Number(counts.invoice_count || 0);
          const quoteCount = Number(counts.quote_count || 0);
          const deliveryNoteCount = Number(counts.delivery_note_count || 0);
          const orderCount = Number(counts.order_count || 0);
          const contactCount = Number(counts.contact_count || 0);
          const documentCount = Number(counts.document_count || 0);

          // Build detailed error message
          const relatedItems: string[] = [];
          if (invoiceCount > 0) relatedItems.push(`${invoiceCount} invoice(s)`);
          if (quoteCount > 0) relatedItems.push(`${quoteCount} quote(s)`);
          if (deliveryNoteCount > 0) relatedItems.push(`${deliveryNoteCount} delivery note(s)`);
          if (orderCount > 0) relatedItems.push(`${orderCount} order(s)`);
          if (contactCount > 0) relatedItems.push(`${contactCount} contact(s)`);
          if (documentCount > 0) relatedItems.push(`${documentCount} document(s)`);

          if (relatedItems.length > 0) {
            return json(
              errorResponse(
                "BAD_REQUEST",
                `Cannot delete company: it has ${relatedItems.join(", ")}. ` +
                  `Please delete or reassign these records first.`
              ),
              400
            );
          }

          // Delete the customer company directly
          await db.delete(companies).where(eq(companies.id, _params.id));

          return json(successResponse({ id: _params.id }));
        } else {
          // For account companies, use the regular deleteCompany function
          const result = await deleteCompany({
            companyId: _params.id,
            userId: auth.userId,
          });

          if (!result) {
            return json(
              errorResponse(
                "BAD_REQUEST",
                "Failed to delete company. It may have related data that needs to be removed first."
              ),
              400
            );
          }

          return json(successResponse({ id: result.id }));
        }
      } catch (error) {
        logger.error({ error }, "Error deleting company");
        return json(
          errorResponse(
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : "Failed to delete company"
          ),
          500
        );
      }
    })
  )
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
        async (_request, _url, _params, _auth, tenantContext, companyContext) => {
          try {
            const companyDocuments = await db
              .select()
              .from(documents)
              .where(
                buildCompanyScopedDocumentQuery(tenantContext.tenantId, companyContext.companyId)
              );

            return json(successResponse(companyDocuments));
          } catch (error) {
            logger.error({ error }, "Error listing documents");
            return json(errorResponse("INTERNAL_ERROR", "Failed to list documents"), 500);
          }
        }
      )
    )
  )
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
        async (_request, _url, _params, _auth, tenantContext, companyContext) => {
          try {
            const companyContacts = await db
              .select()
              .from(contacts)
              .where(
                buildCompanyScopedContactQuery(tenantContext.tenantId, companyContext.companyId)
              );

            return json(successResponse(companyContacts));
          } catch (error) {
            logger.error({ error }, "Error listing contacts");
            return json(errorResponse("INTERNAL_ERROR", "Failed to list contacts"), 500);
          }
        }
      )
    )
  )
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
        async (_request, _url, _params, _auth, tenantContext, companyContext) => {
          try {
            const companyActivities = await db
              .select()
              .from(activities)
              .where(
                buildCompanyScopedActivityQuery(tenantContext.tenantId, companyContext.companyId)
              );

            return json(successResponse(companyActivities));
          } catch (error) {
            logger.error({ error }, "Error listing activities");
            return json(errorResponse("INTERNAL_ERROR", "Failed to list activities"), 500);
          }
        }
      )
    )
  )
);

export const crmApiRoutes = router.getRoutes();
