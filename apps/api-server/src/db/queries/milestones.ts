import type {
  Milestone,
  MilestoneWithTasks,
  PaginationParams,
  FilterParams,
  MilestoneStatus,
} from "@crm/types";
import db from "../client";

// ============================================
// Milestone Queries
// ============================================

export const milestoneQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams & { projectId?: string }
  ): Promise<{ data: Milestone[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(`(name ILIKE '%${filters.search}%')`);
    }
    if (filters.status) {
      conditions.push(`status = '${filters.status}'`);
    }
    if (filters.projectId) {
      conditions.push(`project_id = '${filters.projectId}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(
      `SELECT COUNT(*) FROM milestones ${whereClause}`
    );
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "sort_order";
    const sortOrder = pagination.sortOrder || "asc";

    const data = await db.unsafe(
      `SELECT * FROM milestones ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`
    );

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
      totalTasks: parseInt(taskCounts[0].total, 10),
      completedTasks: parseInt(taskCounts[0].completed, 10),
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
    const order = parseInt(orderResult[0].next_order, 10);

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
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        status = COALESCE(${data.status}, status),
        due_date = COALESCE(${data.dueDate}, due_date),
        completed_date = COALESCE(${data.completedDate}, completed_date),
        sort_order = COALESCE(${data.order}, sort_order),
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
      return parseInt(result[0].count, 10);
    }
    const result = await db`SELECT COUNT(*) FROM milestones`;
    return parseInt(result[0].count, 10);
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
    const result = await db`
      SELECT * FROM milestones 
      WHERE status NOT IN ('completed', 'delayed')
        AND due_date <= NOW() + INTERVAL '${days} days'
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

function mapMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    name: row.name as string,
    description: row.description as string | undefined,
    projectId: row.project_id as string,
    status: row.status as MilestoneStatus,
    dueDate: (row.due_date as Date).toISOString(),
    completedDate: row.completed_date 
      ? (row.completed_date as Date).toISOString() 
      : undefined,
    order: row.sort_order as number,
  };
}

export default milestoneQueries;

