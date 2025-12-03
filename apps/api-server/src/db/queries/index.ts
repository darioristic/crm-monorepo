import type {
	Lead,
	Contact,
	Deal,
	Project,
	Task,
	PaginationParams,
	FilterParams,
	DealStage,
} from "@crm/types";
import { sql as db } from "../client";
import {
	createQueryBuilder,
	sanitizeSortColumn,
	sanitizeSortOrder,
	type QueryParam,
} from "../query-builder";

// ============================================
// Lead Queries
// ============================================

export const leadQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Lead[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		// Sanitizuj paginaciju
		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		// Gradi uslove sa query builder-om
		const qb = createQueryBuilder("leads");
		qb.addSearchCondition(["name", "email", "company"], filters.search);
		qb.addEqualCondition("status", filters.status);
		qb.addUuidCondition("assigned_to", filters.assignedTo);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		// Count
		const countQuery = `SELECT COUNT(*) FROM leads ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		// Select
		const sortBy = sanitizeSortColumn("leads", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM leads
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapLead), total };
	},

	async findById(id: string): Promise<Lead | null> {
		const result = await db`SELECT * FROM leads WHERE id = ${id}`;
		return result.length > 0 ? mapLead(result[0]) : null;
	},

	async create(lead: Lead): Promise<Lead> {
		const result = await db`
      INSERT INTO leads (
        id, name, email, phone, company, position, status, source,
        assigned_to, value, notes, tags, created_at, updated_at
      ) VALUES (
        ${lead.id}, ${lead.name}, ${lead.email}, ${lead.phone || null},
        ${lead.company || null}, ${lead.position || null}, ${lead.status},
        ${lead.source}, ${lead.assignedTo || null}, ${lead.value || null},
        ${lead.notes || null}, ${lead.tags || []}, ${lead.createdAt}, ${lead.updatedAt}
      )
      RETURNING *
    `;
		return mapLead(result[0]);
	},

	async update(id: string, data: Partial<Lead>): Promise<Lead> {
		const result = await db`
      UPDATE leads SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        company = COALESCE(${data.company ?? null}, company),
        position = COALESCE(${data.position ?? null}, position),
        status = COALESCE(${data.status ?? null}, status),
        source = COALESCE(${data.source ?? null}, source),
        assigned_to = COALESCE(${data.assignedTo ?? null}, assigned_to),
        value = COALESCE(${data.value ?? null}, value),
        notes = COALESCE(${data.notes ?? null}, notes),
        tags = COALESCE(${data.tags ?? null}, tags),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapLead(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM leads WHERE id = ${id}`;
	},
};

// ============================================
// Contact Queries
// ============================================

export const contactQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Contact[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		const qb = createQueryBuilder("contacts");
		qb.addSearchCondition(["first_name", "last_name", "email"], filters.search);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		const countQuery = `SELECT COUNT(*) FROM contacts ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		const sortBy = sanitizeSortColumn("contacts", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM contacts
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapContact), total };
	},

	async findById(id: string): Promise<Contact | null> {
		const result = await db`SELECT * FROM contacts WHERE id = ${id}`;
		return result.length > 0 ? mapContact(result[0]) : null;
	},

	async create(contact: Contact): Promise<Contact> {
		const result = await db`
      INSERT INTO contacts (
        id, first_name, last_name, email, phone, company, position,
        street, city, state, postal_code, country, notes, lead_id,
        created_at, updated_at
      ) VALUES (
        ${contact.id}, ${contact.firstName}, ${contact.lastName}, ${contact.email},
        ${contact.phone || null}, ${contact.company || null}, ${contact.position || null},
        ${contact.address?.street || null}, ${contact.address?.city || null},
        ${contact.address?.state || null}, ${contact.address?.postalCode || null},
        ${contact.address?.country || null}, ${contact.notes || null},
        ${contact.leadId || null}, ${contact.createdAt}, ${contact.updatedAt}
      )
      RETURNING *
    `;
		return mapContact(result[0]);
	},

	async update(id: string, data: Partial<Contact>): Promise<Contact> {
		const result = await db`
      UPDATE contacts SET
        first_name = COALESCE(${data.firstName ?? null}, first_name),
        last_name = COALESCE(${data.lastName ?? null}, last_name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        company = COALESCE(${data.company ?? null}, company),
        position = COALESCE(${data.position ?? null}, position),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapContact(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM contacts WHERE id = ${id}`;
	},
};

// ============================================
// Deal Queries
// ============================================

export const dealQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Deal[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		const qb = createQueryBuilder("deals");
		qb.addEqualCondition("stage", filters.status);
		qb.addUuidCondition("assigned_to", filters.assignedTo);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		const countQuery = `SELECT COUNT(*) FROM deals ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		const sortBy = sanitizeSortColumn("deals", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM deals
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapDeal), total };
	},

	async findById(id: string): Promise<Deal | null> {
		const result = await db`SELECT * FROM deals WHERE id = ${id}`;
		return result.length > 0 ? mapDeal(result[0]) : null;
	},

	async create(deal: Deal): Promise<Deal> {
		const result = await db`
      INSERT INTO deals (
        id, title, description, value, currency, stage, priority, probability,
        expected_close_date, contact_id, lead_id, assigned_to, tags,
        created_at, updated_at
      ) VALUES (
        ${deal.id}, ${deal.title}, ${deal.description || null}, ${deal.value},
        ${deal.currency}, ${deal.stage}, ${deal.priority}, ${deal.probability},
        ${deal.expectedCloseDate || null}, ${deal.contactId || null},
        ${deal.leadId || null}, ${deal.assignedTo}, ${deal.tags || []},
        ${deal.createdAt}, ${deal.updatedAt}
      )
      RETURNING *
    `;
		return mapDeal(result[0]);
	},

	async update(id: string, data: Partial<Deal>): Promise<Deal> {
		const result = await db`
      UPDATE deals SET
        title = COALESCE(${data.title ?? null}, title),
        description = COALESCE(${data.description ?? null}, description),
        value = COALESCE(${data.value ?? null}, value),
        currency = COALESCE(${data.currency ?? null}, currency),
        stage = COALESCE(${data.stage ?? null}, stage),
        priority = COALESCE(${data.priority ?? null}, priority),
        probability = COALESCE(${data.probability ?? null}, probability),
        expected_close_date = COALESCE(${data.expectedCloseDate ?? null}, expected_close_date),
        actual_close_date = COALESCE(${data.actualCloseDate ?? null}, actual_close_date),
        tags = COALESCE(${data.tags ?? null}, tags),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapDeal(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM deals WHERE id = ${id}`;
	},

	async getPipelineSummary(): Promise<{
		stages: { stage: DealStage; count: number; totalValue: number }[];
		totalDeals: number;
		totalValue: number;
		avgDealValue: number;
	}> {
		const stagesResult = await db`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM deals
      GROUP BY stage
      ORDER BY stage
    `;

		const totalsResult = await db`
      SELECT COUNT(*) as total_deals, COALESCE(SUM(value), 0) as total_value,
             COALESCE(AVG(value), 0) as avg_value
      FROM deals
    `;

		return {
			stages: stagesResult.map((row) => ({
				stage: row.stage as DealStage,
				count: parseInt(row.count as string, 10),
				totalValue: parseFloat(row.total_value as string),
			})),
			totalDeals: parseInt(totalsResult[0].total_deals as string, 10),
			totalValue: parseFloat(totalsResult[0].total_value as string),
			avgDealValue: parseFloat(totalsResult[0].avg_value as string),
		};
	},
};

// ============================================
// Project Queries
// ============================================

export const projectQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Project[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		const qb = createQueryBuilder("projects");
		qb.addEqualCondition("status", filters.status);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		const sortBy = sanitizeSortColumn("projects", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM projects
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapProject), total };
	},

	async findById(id: string): Promise<Project | null> {
		const result = await db`SELECT * FROM projects WHERE id = ${id}`;
		return result.length > 0 ? mapProject(result[0]) : null;
	},

	async create(project: Project): Promise<Project> {
		const result = await db`
      INSERT INTO projects (
        id, name, description, status, start_date, end_date, budget, currency,
        client_id, deal_id, manager_id, team_members, tags, created_at, updated_at
      ) VALUES (
        ${project.id}, ${project.name}, ${project.description || null},
        ${project.status}, ${project.startDate || null}, ${project.endDate || null},
        ${project.budget || null}, ${project.currency || null},
        ${project.clientId || null}, ${project.dealId || null}, ${project.managerId},
        ${project.teamMembers}, ${project.tags || []}, ${project.createdAt}, ${project.updatedAt}
      )
      RETURNING *
    `;
		return mapProject(result[0]);
	},

	async update(id: string, data: Partial<Project>): Promise<Project> {
		const result = await db`
      UPDATE projects SET
        name = COALESCE(${data.name ?? null}, name),
        description = COALESCE(${data.description ?? null}, description),
        status = COALESCE(${data.status ?? null}, status),
        start_date = COALESCE(${data.startDate ?? null}, start_date),
        end_date = COALESCE(${data.endDate ?? null}, end_date),
        budget = COALESCE(${data.budget ?? null}, budget),
        currency = COALESCE(${data.currency ?? null}, currency),
        team_members = COALESCE(${data.teamMembers ?? null}, team_members),
        tags = COALESCE(${data.tags ?? null}, tags),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapProject(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM projects WHERE id = ${id}`;
	},
};

// ============================================
// Task Queries
// ============================================

export const taskQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams & {
			projectId?: string;
			milestoneId?: string;
			assignedTo?: string;
		},
	): Promise<{ data: Task[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		// Koristi query builder za sigurne upite
		const qb = createQueryBuilder("tasks");
		qb.addSearchCondition(["title"], filters.search);
		qb.addEqualCondition("status", filters.status);
		qb.addUuidCondition("project_id", filters.projectId);
		qb.addUuidCondition("milestone_id", filters.milestoneId);
		qb.addUuidCondition("assigned_to", filters.assignedTo);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		const countQuery = `SELECT COUNT(*) FROM tasks ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		const sortBy = sanitizeSortColumn("tasks", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		const selectQuery = `
      SELECT * FROM tasks
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

		return { data: data.map(mapTask), total };
	},

	async findByProject(
		projectId: string,
		pagination: PaginationParams,
	): Promise<{ data: Task[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		const countResult = await db`
      SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId}
    `;
		const total = parseInt(countResult[0].count as string, 10);

		const data = await db`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${safePageSize} OFFSET ${safeOffset}
    `;

		return { data: data.map(mapTask), total };
	},

	async findByMilestone(milestoneId: string): Promise<Task[]> {
		const result = await db`
      SELECT * FROM tasks WHERE milestone_id = ${milestoneId}
      ORDER BY created_at ASC
    `;
		return result.map(mapTask);
	},

	async findById(id: string): Promise<Task | null> {
		const result = await db`SELECT * FROM tasks WHERE id = ${id}`;
		return result.length > 0 ? mapTask(result[0]) : null;
	},

	async create(task: Task): Promise<Task> {
		const result = await db`
      INSERT INTO tasks (
        id, title, description, status, priority, project_id, milestone_id, assigned_to,
        due_date, estimated_hours, actual_hours, parent_task_id, tags,
        created_at, updated_at
      ) VALUES (
        ${task.id}, ${task.title}, ${task.description || null}, ${task.status},
        ${task.priority}, ${task.projectId}, ${task.milestoneId || null}, ${task.assignedTo || null},
        ${task.dueDate || null}, ${task.estimatedHours || null},
        ${task.actualHours || null}, ${task.parentTaskId || null},
        ${task.tags || []}, ${task.createdAt}, ${task.updatedAt}
      )
      RETURNING *
    `;
		return mapTask(result[0]);
	},

	async update(id: string, data: Partial<Task>): Promise<Task> {
		const result = await db`
      UPDATE tasks SET
        title = COALESCE(${data.title ?? null}, title),
        description = COALESCE(${data.description ?? null}, description),
        status = COALESCE(${data.status ?? null}, status),
        priority = COALESCE(${data.priority ?? null}, priority),
        milestone_id = COALESCE(${data.milestoneId ?? null}, milestone_id),
        assigned_to = COALESCE(${data.assignedTo ?? null}, assigned_to),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        estimated_hours = COALESCE(${data.estimatedHours ?? null}, estimated_hours),
        actual_hours = COALESCE(${data.actualHours ?? null}, actual_hours),
        tags = COALESCE(${data.tags ?? null}, tags),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
		return mapTask(result[0]);
	},

	async delete(id: string): Promise<void> {
		await db`DELETE FROM tasks WHERE id = ${id}`;
	},

	async count(projectId?: string): Promise<number> {
		if (projectId) {
			const result =
				await db`SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId}`;
			return parseInt(result[0].count as string, 10);
		}
		const result = await db`SELECT COUNT(*) FROM tasks`;
		return parseInt(result[0].count as string, 10);
	},
};

// ============================================
// Helper for date conversion
// ============================================

function toISOString(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return String(value);
}

// ============================================
// Mapping Functions (snake_case -> camelCase)
// ============================================

function mapLead(row: Record<string, unknown>): Lead {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		name: row.name as string,
		email: row.email as string,
		phone: row.phone as string | undefined,
		company: row.company as string | undefined,
		position: row.position as string | undefined,
		status: row.status as Lead["status"],
		source: row.source as Lead["source"],
		assignedTo: row.assigned_to as string | undefined,
		value: row.value ? parseFloat(row.value as string) : undefined,
		notes: row.notes as string | undefined,
		tags: row.tags as string[] | undefined,
	};
}

function mapContact(row: Record<string, unknown>): Contact {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		firstName: row.first_name as string,
		lastName: row.last_name as string,
		email: row.email as string,
		phone: row.phone as string | undefined,
		company: row.company as string | undefined,
		position: row.position as string | undefined,
		address: {
			street: row.street as string | undefined,
			city: row.city as string | undefined,
			state: row.state as string | undefined,
			postalCode: row.postal_code as string | undefined,
			country: row.country as string | undefined,
		},
		notes: row.notes as string | undefined,
		leadId: row.lead_id as string | undefined,
	};
}

function mapDeal(row: Record<string, unknown>): Deal {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		title: row.title as string,
		description: row.description as string | undefined,
		value: parseFloat(row.value as string),
		currency: row.currency as string,
		stage: row.stage as Deal["stage"],
		priority: row.priority as Deal["priority"],
		probability: row.probability as number,
		expectedCloseDate: row.expected_close_date
			? toISOString(row.expected_close_date)
			: undefined,
		actualCloseDate: row.actual_close_date
			? toISOString(row.actual_close_date)
			: undefined,
		contactId: row.contact_id as string | undefined,
		leadId: row.lead_id as string | undefined,
		assignedTo: row.assigned_to as string,
		tags: row.tags as string[] | undefined,
	};
}

function mapProject(row: Record<string, unknown>): Project {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		name: row.name as string,
		description: row.description as string | undefined,
		status: row.status as Project["status"],
		startDate: row.start_date ? toISOString(row.start_date) : undefined,
		endDate: row.end_date ? toISOString(row.end_date) : undefined,
		budget: row.budget ? parseFloat(row.budget as string) : undefined,
		currency: row.currency as string | undefined,
		clientId: row.client_id as string | undefined,
		dealId: row.deal_id as string | undefined,
		managerId: row.manager_id as string,
		teamMembers: (row.team_members as string[]) || [],
		tags: row.tags as string[] | undefined,
	};
}

function mapTask(row: Record<string, unknown>): Task {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		title: row.title as string,
		description: row.description as string | undefined,
		status: row.status as Task["status"],
		priority: row.priority as Task["priority"],
		projectId: row.project_id as string,
		milestoneId: row.milestone_id as string | undefined,
		assignedTo: row.assigned_to as string | undefined,
		dueDate: row.due_date ? toISOString(row.due_date) : undefined,
		estimatedHours: row.estimated_hours
			? parseFloat(row.estimated_hours as string)
			: undefined,
		actualHours: row.actual_hours
			? parseFloat(row.actual_hours as string)
			: undefined,
		parentTaskId: row.parent_task_id as string | undefined,
		tags: row.tags as string[] | undefined,
	};
}

// ============================================
// Re-export Company and User Queries
// ============================================

export { companyQueries } from "./companies";
export { userQueries } from "./users";

// ============================================
// Re-export Sales Module Queries
// ============================================

export { quoteQueries } from "./quotes";
export { invoiceQueries } from "./invoices";
export { deliveryNoteQueries } from "./delivery-notes";
export { orderQueries } from "./orders";

// ============================================
// Re-export Project Module Queries
// ============================================

export { milestoneQueries } from "./milestones";

// ============================================
// Re-export Auth Queries
// ============================================

export { authQueries } from "./auth";

// ============================================
// Re-export Product Catalog Queries
// ============================================

export { productQueries, productCategoryQueries } from "./products";

// ============================================
// Re-export Notification Queries
// ============================================

export { notificationQueries } from "./notifications";

// ============================================
// Re-export Payment Queries
// ============================================

export { paymentQueries } from "./payments";

// ============================================
// Re-export Document/Vault Queries
// ============================================

export {
	documentQueries,
	documentTagQueries,
	documentTagAssignmentQueries,
} from "./documents";
