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
import db from "../client";

// ============================================
// Lead Queries
// ============================================

export const leadQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Lead[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let query = db`SELECT * FROM leads WHERE 1=1`;

    if (filters.status) {
      query = db`${query} AND status = ${filters.status}`;
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      query = db`${query} AND (name ILIKE ${search} OR email ILIKE ${search} OR company ILIKE ${search})`;
    }
    if (filters.assignedTo) {
      query = db`${query} AND assigned_to = ${filters.assignedTo}`;
    }

    const countResult = await db`SELECT COUNT(*) FROM (${query}) AS count_query`;
    const total = parseInt(countResult[0].count, 10);

    const data = await db`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

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
        name = COALESCE(${data.name}, name),
        email = COALESCE(${data.email}, email),
        phone = COALESCE(${data.phone}, phone),
        company = COALESCE(${data.company}, company),
        position = COALESCE(${data.position}, position),
        status = COALESCE(${data.status}, status),
        source = COALESCE(${data.source}, source),
        assigned_to = COALESCE(${data.assignedTo}, assigned_to),
        value = COALESCE(${data.value}, value),
        notes = COALESCE(${data.notes}, notes),
        tags = COALESCE(${data.tags}, tags),
        updated_at = ${data.updatedAt || new Date().toISOString()}
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
    filters: FilterParams
  ): Promise<{ data: Contact[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let query = db`SELECT * FROM contacts WHERE 1=1`;

    if (filters.search) {
      const search = `%${filters.search}%`;
      query = db`${query} AND (first_name ILIKE ${search} OR last_name ILIKE ${search} OR email ILIKE ${search})`;
    }

    const countResult = await db`SELECT COUNT(*) FROM (${query}) AS count_query`;
    const total = parseInt(countResult[0].count, 10);

    const data = await db`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

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
        first_name = COALESCE(${data.firstName}, first_name),
        last_name = COALESCE(${data.lastName}, last_name),
        email = COALESCE(${data.email}, email),
        phone = COALESCE(${data.phone}, phone),
        company = COALESCE(${data.company}, company),
        position = COALESCE(${data.position}, position),
        notes = COALESCE(${data.notes}, notes),
        updated_at = ${data.updatedAt || new Date().toISOString()}
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
    filters: FilterParams
  ): Promise<{ data: Deal[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let query = db`SELECT * FROM deals WHERE 1=1`;

    if (filters.status) {
      query = db`${query} AND stage = ${filters.status}`;
    }
    if (filters.assignedTo) {
      query = db`${query} AND assigned_to = ${filters.assignedTo}`;
    }

    const countResult = await db`SELECT COUNT(*) FROM (${query}) AS count_query`;
    const total = parseInt(countResult[0].count, 10);

    const data = await db`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

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
        title = COALESCE(${data.title}, title),
        description = COALESCE(${data.description}, description),
        value = COALESCE(${data.value}, value),
        currency = COALESCE(${data.currency}, currency),
        stage = COALESCE(${data.stage}, stage),
        priority = COALESCE(${data.priority}, priority),
        probability = COALESCE(${data.probability}, probability),
        expected_close_date = COALESCE(${data.expectedCloseDate}, expected_close_date),
        actual_close_date = COALESCE(${data.actualCloseDate}, actual_close_date),
        tags = COALESCE(${data.tags}, tags),
        updated_at = ${data.updatedAt || new Date().toISOString()}
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
        count: parseInt(row.count, 10),
        totalValue: parseFloat(row.total_value),
      })),
      totalDeals: parseInt(totalsResult[0].total_deals, 10),
      totalValue: parseFloat(totalsResult[0].total_value),
      avgDealValue: parseFloat(totalsResult[0].avg_value),
    };
  },
};

// ============================================
// Project Queries
// ============================================

export const projectQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Project[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let query = db`SELECT * FROM projects WHERE 1=1`;

    if (filters.status) {
      query = db`${query} AND status = ${filters.status}`;
    }

    const countResult = await db`SELECT COUNT(*) FROM (${query}) AS count_query`;
    const total = parseInt(countResult[0].count, 10);

    const data = await db`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

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
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        status = COALESCE(${data.status}, status),
        start_date = COALESCE(${data.startDate}, start_date),
        end_date = COALESCE(${data.endDate}, end_date),
        budget = COALESCE(${data.budget}, budget),
        currency = COALESCE(${data.currency}, currency),
        team_members = COALESCE(${data.teamMembers}, team_members),
        tags = COALESCE(${data.tags}, tags),
        updated_at = ${data.updatedAt || new Date().toISOString()}
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
    filters: FilterParams & { projectId?: string; milestoneId?: string; assignedTo?: string }
  ): Promise<{ data: Task[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(`(title ILIKE '%${filters.search}%')`);
    }
    if (filters.status) {
      conditions.push(`status = '${filters.status}'`);
    }
    if (filters.projectId) {
      conditions.push(`project_id = '${filters.projectId}'`);
    }
    if (filters.milestoneId) {
      conditions.push(`milestone_id = '${filters.milestoneId}'`);
    }
    if (filters.assignedTo) {
      conditions.push(`assigned_to = '${filters.assignedTo}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(
      `SELECT COUNT(*) FROM tasks ${whereClause}`
    );
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "created_at";
    const sortOrder = pagination.sortOrder || "desc";

    const data = await db.unsafe(
      `SELECT * FROM tasks ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`
    );

    return { data: data.map(mapTask), total };
  },

  async findByProject(
    projectId: string,
    pagination: PaginationParams
  ): Promise<{ data: Task[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    const countResult = await db`
      SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId}
    `;
    const total = parseInt(countResult[0].count, 10);

    const data = await db`
      SELECT * FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
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
        title = COALESCE(${data.title}, title),
        description = COALESCE(${data.description}, description),
        status = COALESCE(${data.status}, status),
        priority = COALESCE(${data.priority}, priority),
        milestone_id = COALESCE(${data.milestoneId}, milestone_id),
        assigned_to = COALESCE(${data.assignedTo}, assigned_to),
        due_date = COALESCE(${data.dueDate}, due_date),
        estimated_hours = COALESCE(${data.estimatedHours}, estimated_hours),
        actual_hours = COALESCE(${data.actualHours}, actual_hours),
        tags = COALESCE(${data.tags}, tags),
        updated_at = ${data.updatedAt || new Date().toISOString()}
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
      const result = await db`SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId}`;
      return parseInt(result[0].count, 10);
    }
    const result = await db`SELECT COUNT(*) FROM tasks`;
    return parseInt(result[0].count, 10);
  },
};

// ============================================
// Mapping Functions (snake_case -> camelCase)
// ============================================

function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    title: row.title as string,
    description: row.description as string | undefined,
    value: parseFloat(row.value as string),
    currency: row.currency as string,
    stage: row.stage as Deal["stage"],
    priority: row.priority as Deal["priority"],
    probability: row.probability as number,
    expectedCloseDate: row.expected_close_date
      ? (row.expected_close_date as Date).toISOString()
      : undefined,
    actualCloseDate: row.actual_close_date
      ? (row.actual_close_date as Date).toISOString()
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    name: row.name as string,
    description: row.description as string | undefined,
    status: row.status as Project["status"],
    startDate: row.start_date ? (row.start_date as Date).toISOString() : undefined,
    endDate: row.end_date ? (row.end_date as Date).toISOString() : undefined,
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    title: row.title as string,
    description: row.description as string | undefined,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    projectId: row.project_id as string,
    milestoneId: row.milestone_id as string | undefined,
    assignedTo: row.assigned_to as string | undefined,
    dueDate: row.due_date ? (row.due_date as Date).toISOString() : undefined,
    estimatedHours: row.estimated_hours ? parseFloat(row.estimated_hours as string) : undefined,
    actualHours: row.actual_hours ? parseFloat(row.actual_hours as string) : undefined,
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
