import { sql as db } from "../db/client";

// ============================================
// Audit Action Types
// ============================================

export type AuditAction =
	// Auth actions
	| "LOGIN"
	| "LOGOUT"
	| "LOGIN_FAILED"
	| "PASSWORD_CHANGE"
	| "TOKEN_REFRESH"
	// User actions
	| "CREATE_USER"
	| "UPDATE_USER"
	| "DELETE_USER"
	// Company actions
	| "CREATE_COMPANY"
	| "UPDATE_COMPANY"
	| "DELETE_COMPANY"
	// Project actions
	| "CREATE_PROJECT"
	| "UPDATE_PROJECT"
	| "DELETE_PROJECT"
	// Task actions
	| "CREATE_TASK"
	| "UPDATE_TASK"
	| "DELETE_TASK"
	// Milestone actions
	| "CREATE_MILESTONE"
	| "UPDATE_MILESTONE"
	| "DELETE_MILESTONE"
	// Quote actions
	| "CREATE_QUOTE"
	| "UPDATE_QUOTE"
	| "DELETE_QUOTE"
	// Invoice actions
	| "CREATE_INVOICE"
	| "UPDATE_INVOICE"
	| "DELETE_INVOICE"
	| "RECORD_PAYMENT"
	// Delivery note actions
	| "CREATE_DELIVERY_NOTE"
	| "UPDATE_DELIVERY_NOTE"
	| "DELETE_DELIVERY_NOTE"
	// Lead/Contact actions
	| "CREATE_LEAD"
	| "UPDATE_LEAD"
	| "DELETE_LEAD"
	| "CREATE_CONTACT"
	| "UPDATE_CONTACT"
	| "DELETE_CONTACT"
	// Deal actions
	| "CREATE_DEAL"
	| "UPDATE_DEAL"
	| "DELETE_DEAL"
	// Settings
	| "UPDATE_SETTINGS"
	// API Key actions
	| "CREATE_API_KEY"
	| "REVOKE_API_KEY";

export type EntityType =
	| "user"
	| "company"
	| "project"
	| "task"
	| "milestone"
	| "quote"
	| "invoice"
	| "delivery_note"
	| "lead"
	| "contact"
	| "deal"
	| "settings"
	| "api_key"
	| "session";

// ============================================
// Audit Log Entry Interface
// ============================================

export interface AuditLogEntry {
	id: string;
	userId: string | null;
	action: AuditAction;
	entityType: EntityType;
	entityId: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}

export interface CreateAuditLogParams {
	userId?: string;
	action: AuditAction;
	entityType: EntityType;
	entityId?: string;
	ipAddress?: string;
	userAgent?: string;
	metadata?: Record<string, unknown>;
}

// ============================================
// Audit Service
// ============================================

class AuditService {
	/**
	 * Log an action - async, non-blocking
	 * Will not throw errors to avoid disrupting the main flow
	 */
	logAction(params: CreateAuditLogParams): void {
		// Fire and forget - don't await
		this.createLog(params).catch((error) => {
			console.error("Audit log error:", error);
		});
	}

	/**
	 * Log an action and wait for completion
	 * Use when you need to ensure the log is written
	 */
	async logActionSync(params: CreateAuditLogParams): Promise<void> {
		await this.createLog(params);
	}

	/**
	 * Internal method to create the log entry
	 */
	private async createLog(params: CreateAuditLogParams): Promise<void> {
		try {
			await db`
        INSERT INTO audit_logs (
          user_id,
          action,
          entity_type,
          entity_id,
          ip_address,
          user_agent,
          metadata
        ) VALUES (
          ${params.userId || null},
          ${params.action},
          ${params.entityType},
          ${params.entityId || null},
          ${params.ipAddress || null},
          ${params.userAgent || null},
          ${params.metadata ? JSON.stringify(params.metadata) : null}
        )
      `;
		} catch (error) {
			console.error("Failed to write audit log:", error);
		}
	}

	/**
	 * Query audit logs with filtering
	 */
	async getLogs(options: {
		userId?: string;
		action?: AuditAction;
		entityType?: EntityType;
		entityId?: string;
		fromDate?: string;
		toDate?: string;
		page?: number;
		pageSize?: number;
	}): Promise<{ data: AuditLogEntry[]; total: number }> {
		const { page = 1, pageSize = 50 } = options;
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		if (options.userId) conditions.push(`user_id = '${options.userId}'`);
		if (options.action) conditions.push(`action = '${options.action}'`);
		if (options.entityType) conditions.push(`entity_type = '${options.entityType}'`);
		if (options.entityId) conditions.push(`entity_id = '${options.entityId}'`);
		if (options.fromDate) conditions.push(`created_at >= '${options.fromDate}'`);
		if (options.toDate) conditions.push(`created_at <= '${options.toDate}'`);

		const whereClause =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		const countResult = await db.unsafe(
			`SELECT COUNT(*) FROM audit_logs ${whereClause}`,
		);
		const total = Number.parseInt(countResult[0].count as string, 10);

		const data = await db.unsafe(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

		return {
			data: data.map(mapAuditLog),
			total,
		};
	}

	/**
	 * Get logs for a specific entity
	 */
	async getEntityLogs(
		entityType: EntityType,
		entityId: string,
		limit = 100,
	): Promise<AuditLogEntry[]> {
		const data = await db`
      SELECT * FROM audit_logs
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
		return data.map(mapAuditLog);
	}

	/**
	 * Get logs for a specific user
	 */
	async getUserLogs(userId: string, limit = 100): Promise<AuditLogEntry[]> {
		const data = await db`
      SELECT * FROM audit_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
		return data.map(mapAuditLog);
	}

	/**
	 * Get recent login activity
	 */
	async getRecentLogins(limit = 50): Promise<AuditLogEntry[]> {
		const data = await db`
      SELECT * FROM audit_logs
      WHERE action IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
		return data.map(mapAuditLog);
	}

	/**
	 * Get audit statistics
	 */
	async getStats(fromDate?: string): Promise<{
		totalLogs: number;
		logsByAction: Record<string, number>;
		logsByEntityType: Record<string, number>;
		recentActivity: AuditLogEntry[];
	}> {
		const dateFilter = fromDate ? `WHERE created_at >= '${fromDate}'` : "";

		const totalResult = await db.unsafe(
			`SELECT COUNT(*) FROM audit_logs ${dateFilter}`,
		);
		const totalLogs = Number.parseInt(totalResult[0].count as string, 10);

		const actionResult = await db.unsafe(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      ${dateFilter}
      GROUP BY action
      ORDER BY count DESC
    `);
		const logsByAction: Record<string, number> = {};
		for (const row of actionResult) {
			logsByAction[row.action as string] = Number.parseInt(
				row.count as string,
				10,
			);
		}

		const entityResult = await db.unsafe(`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      ${dateFilter}
      GROUP BY entity_type
      ORDER BY count DESC
    `);
		const logsByEntityType: Record<string, number> = {};
		for (const row of entityResult) {
			logsByEntityType[row.entity_type as string] = Number.parseInt(
				row.count as string,
				10,
			);
		}

		const recentData = await db`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10
    `;

		return {
			totalLogs,
			logsByAction,
			logsByEntityType,
			recentActivity: recentData.map(mapAuditLog),
		};
	}

	/**
	 * Cleanup old audit logs
	 */
	async cleanupOldLogs(olderThanDays: number): Promise<number> {
		const cutoffDate = new Date(
			Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
		).toISOString();

		const result = await db`
      DELETE FROM audit_logs
      WHERE created_at < ${cutoffDate}
      RETURNING id
    `;

		return result.length;
	}
}

// ============================================
// Mapping Function
// ============================================

function mapAuditLog(row: Record<string, unknown>): AuditLogEntry {
	return {
		id: row.id as string,
		userId: row.user_id as string | null,
		action: row.action as AuditAction,
		entityType: row.entity_type as EntityType,
		entityId: row.entity_id as string | null,
		ipAddress: row.ip_address as string | null,
		userAgent: row.user_agent as string | null,
		metadata: row.metadata as Record<string, unknown> | null,
		createdAt: (row.created_at as Date).toISOString(),
	};
}

// ============================================
// Helper Functions for Common Logging
// ============================================

export function getClientIp(request: Request): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"unknown"
	);
}

export function getUserAgent(request: Request): string {
	return request.headers.get("user-agent") || "unknown";
}

export const auditService = new AuditService();
export default auditService;

