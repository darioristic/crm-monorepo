import type {
  Milestone,
  MilestoneWithTasks,
  PaginationParams,
  FilterParams,
  MilestoneStatus,
} from "@crm/types";
import { sql as db } from "../client";
import { createQueryBuilder, sanitizeSortOrder, type QueryParam } from "../query-builder";

// ============================================
// Milestone Queries
// ============================================

export const milestoneQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams & { projectId?: string }
  ): Promise<{ data: Milestone[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Koristi query builder za sigurne upite
    const qb = createQueryBuilder("milestones");
    qb.addSearchCondition(["name"], filters.search);
    qb.addEqualCondition("status", filters.status);
    qb.addUuidCondition("project_id", filters.projectId);

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    const countQuery = `SELECT COUNT(*) FROM milestones ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = parseInt(countResult[0].count, 10);

    // Milestone default sort je sort_order, ne created_at
    let sortBy = pagination.sortBy || "sort_order";
    // Dodaj validaciju za sort_order kolonu
    const allowedSortColumns = ["sort_order", "created_at", "updated_at", "name", "status", "due_date"];
    if (!allowedSortColumns.includes(sortBy)) {
      sortBy = "sort_order";
    }
    const sortOrder = sanitizeSortOrder(pagination.sortOrder === "desc" ? "desc" : "asc");

    const selectQuery = `
      SELECT * FROM milestones
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const data = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    return { data: data.map(mapMilestone), total };
  },

  async findById(id: string): Promise<MilestoneWithTasks | null> {
    const result = await db`
      SELECT * FROM milestones WHERE id = ${id}
    `;

    if (result.length === 0) return null;

    // Get task counts
    const taskCounts = await db`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as completed
      FROM tasks WHERE milestone_id = ${id}
    `;

    const milestone = mapMilestone(result[0]);
    return {
      ...milestone,
      totalTasks: parseInt(taskCounts[0].total as string, 10),
      completedTasks: parseInt(taskCounts[0].completed as string, 10),
    };
  },

  async findByProject(projectId: string): Promise<Milestone[]> {
    const result = await db`
      SELECT * FROM milestones 
      WHERE project_id = ${projectId}
      ORDER BY sort_order ASC, due_date ASC
    `;
    return result.map(mapMilestone);
  },

  async create(milestone: Milestone): Promise<Milestone> {
    // Get next order number for project
    const orderResult = await db`
      SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
      FROM milestones WHERE project_id = ${milestone.projectId}
    `;
    const order = parseInt(orderResult[0].next_order as string, 10);

    const result = await db`
      INSERT INTO milestones (
        id, name, description, project_id, status, due_date,
        completed_date, sort_order, created_at, updated_at
      ) VALUES (
        ${milestone.id}, ${milestone.name}, ${milestone.description || null},
        ${milestone.projectId}, ${milestone.status}, ${milestone.dueDate},
        ${milestone.completedDate || null}, ${order},
        ${milestone.createdAt}, ${milestone.updatedAt}
      )
      RETURNING *
    `;
    return mapMilestone(result[0]);
  },

  async update(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const result = await db`
      UPDATE milestones SET
        name = COALESCE(${data.name ?? null}, name),
        description = COALESCE(${data.description ?? null}, description),
        status = COALESCE(${data.status ?? null}, status),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        completed_date = COALESCE(${data.completedDate ?? null}, completed_date),
        sort_order = COALESCE(${data.order ?? null}, sort_order),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return mapMilestone(result[0]);
  },

  async delete(id: string): Promise<void> {
    // Tasks will have their milestone_id set to null due to ON DELETE SET NULL
    await db`DELETE FROM milestones WHERE id = ${id}`;
  },

  async count(projectId?: string): Promise<number> {
    if (projectId) {
      const result = await db`SELECT COUNT(*) FROM milestones WHERE project_id = ${projectId}`;
      return parseInt(result[0].count as string, 10);
    }
    const result = await db`SELECT COUNT(*) FROM milestones`;
    return parseInt(result[0].count as string, 10);
  },

  async findByStatus(status: MilestoneStatus, projectId?: string): Promise<Milestone[]> {
    if (projectId) {
      const result = await db`
        SELECT * FROM milestones 
        WHERE status = ${status} AND project_id = ${projectId}
        ORDER BY due_date ASC
      `;
      return result.map(mapMilestone);
    }
    const result = await db`
      SELECT * FROM milestones WHERE status = ${status} ORDER BY due_date ASC
    `;
    return result.map(mapMilestone);
  },

  async getUpcoming(days: number = 7): Promise<Milestone[]> {
    // Koristi parametrizovani upit za days
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const result = await db`
      SELECT * FROM milestones 
      WHERE status NOT IN ('completed', 'delayed')
        AND due_date <= NOW() + (${safeDays} || ' days')::INTERVAL
        AND due_date >= NOW()
      ORDER BY due_date ASC
    `;
    return result.map(mapMilestone);
  },

  async getOverdue(): Promise<Milestone[]> {
    const result = await db`
      SELECT * FROM milestones 
      WHERE status NOT IN ('completed')
        AND due_date < NOW()
      ORDER BY due_date ASC
    `;
    return result.map(mapMilestone);
  },

  async markCompleted(id: string): Promise<Milestone> {
    return milestoneQueries.update(id, {
      status: "completed",
      completedDate: new Date().toISOString(),
    });
  },

  async reorder(projectId: string, milestoneIds: string[]): Promise<void> {
    for (let i = 0; i < milestoneIds.length; i++) {
      await db`
        UPDATE milestones SET sort_order = ${i + 1}
        WHERE id = ${milestoneIds[i]} AND project_id = ${projectId}
      `;
    }
  },
};

// ============================================
// Mapping Functions
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function mapMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    name: row.name as string,
    description: row.description as string | undefined,
    projectId: row.project_id as string,
    status: row.status as MilestoneStatus,
    dueDate: toISOString(row.due_date),
    completedDate: row.completed_date 
      ? toISOString(row.completed_date) 
      : undefined,
    order: row.sort_order as number,
  };
}

export default milestoneQueries;
