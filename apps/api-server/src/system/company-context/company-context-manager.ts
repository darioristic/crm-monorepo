import { db } from "../../db/client";
import { companies } from "../../db/schema/index";
import { eq, and } from "drizzle-orm";
import type { CompanyContext } from "./types";
import { logger } from "../../lib/logger";

export class CompanyContextManager {
	async getCompanyById(
		companyId: string,
		tenantId: string,
	): Promise<CompanyContext | null> {
		try {
			const company = await db
				.select({
					id: companies.id,
					tenantId: companies.tenantId,
				})
				.from(companies)
				.where(
					and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)),
				)
				.limit(1);

			if (company.length === 0) {
				return null;
			}

			const c = company[0];

			return {
				companyId: c.id,
				tenantId: c.tenantId,
			};
		} catch (error) {
			logger.error(
				{ error, companyId, tenantId },
				"Failed to get company context",
			);
			return null;
		}
	}

	async validateCompanyAccess(
		companyId: string,
		tenantId: string,
	): Promise<{
		allowed: boolean;
		reason?: string;
	}> {
		const context = await this.getCompanyById(companyId, tenantId);

		if (!context) {
			return {
				allowed: false,
				reason: "Company not found or does not belong to tenant",
			};
		}

		if (context.tenantId !== tenantId) {
			return {
				allowed: false,
				reason: "Company does not belong to tenant",
			};
		}

		return {
			allowed: true,
		};
	}
}

export const companyContextManager = new CompanyContextManager();
