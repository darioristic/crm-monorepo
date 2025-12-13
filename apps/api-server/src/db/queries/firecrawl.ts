import { sql as db } from "../client";

export type FirecrawlJob = {
  id: string;
  tenantId: string;
  userId: string | null;
  requestId: string;
  type: "scrape" | "crawl" | "map" | "search" | "extract" | "batch_scrape";
  status: "pending" | "processing" | "completed" | "failed";
  payload: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

export type FirecrawlResult = {
  id: string;
  jobId: string;
  tenantId: string;
  userId: string | null;
  content: Record<string, unknown>;
  createdAt: string;
};

function toISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapJob(row: Record<string, unknown>): FirecrawlJob {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: (row.user_id as string) || null,
    requestId: row.request_id as string,
    type: row.type as FirecrawlJob["type"],
    status: row.status as FirecrawlJob["status"],
    payload: (row.payload as Record<string, unknown>) || {},
    createdAt: toISO(row.created_at),
    startedAt: row.started_at ? toISO(row.started_at) : null,
    completedAt: row.completed_at ? toISO(row.completed_at) : null,
    error: (row.error as string) || null,
  };
}

function mapResult(row: Record<string, unknown>): FirecrawlResult {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    tenantId: row.tenant_id as string,
    userId: (row.user_id as string) || null,
    content: (row.content as Record<string, unknown>) || {},
    createdAt: toISO(row.created_at),
  };
}

export const firecrawlQueries = {
  async createJob(
    tenantId: string,
    userId: string | null,
    type: FirecrawlJob["type"],
    payload: Record<string, unknown>
  ): Promise<FirecrawlJob> {
    const requestId = `fc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const res = await db`
      INSERT INTO firecrawl_jobs (tenant_id, user_id, request_id, type, status, payload)
      VALUES (${tenantId}, ${userId}, ${requestId}, ${type}, 'pending', ${JSON.stringify(payload)}::jsonb)
      RETURNING *
    `;
    return mapJob(res[0]);
  },

  async updateJobStatus(
    id: string,
    status: FirecrawlJob["status"],
    fields: Partial<{ startedAt: Date; completedAt: Date; error: string }>
  ): Promise<FirecrawlJob | null> {
    const res = await db`
      UPDATE firecrawl_jobs
      SET status = ${status},
          started_at = COALESCE(${fields.startedAt || null}, started_at),
          completed_at = COALESCE(${fields.completedAt || null}, completed_at),
          error = COALESCE(${fields.error || null}, error)
      WHERE id = ${id}
      RETURNING *
    `;
    return res.length > 0 ? mapJob(res[0]) : null;
  },

  async addResult(
    jobId: string,
    tenantId: string,
    userId: string | null,
    content: Record<string, unknown>
  ): Promise<FirecrawlResult> {
    const res = await db`
      INSERT INTO firecrawl_results (job_id, tenant_id, user_id, content)
      VALUES (${jobId}, ${tenantId}, ${userId}, ${JSON.stringify(content)}::jsonb)
      RETURNING *
    `;
    return mapResult(res[0]);
  },

  async listJobs(
    tenantId: string,
    type?: FirecrawlJob["type"],
    limit = 50,
    offset = 0
  ): Promise<{ jobs: FirecrawlJob[]; total: number }> {
    const where =
      type != null ? db`tenant_id = ${tenantId} AND type = ${type}` : db`tenant_id = ${tenantId}`;
    const [{ count }] = await db`SELECT COUNT(*) as count FROM firecrawl_jobs WHERE ${where}`;
    const rows = await db`
      SELECT * FROM firecrawl_jobs
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { jobs: rows.map(mapJob), total: Number(count) };
  },

  async getJobWithResults(
    tenantId: string,
    id: string
  ): Promise<{ job: FirecrawlJob | null; results: FirecrawlResult[] }> {
    const jobRows = await db`
      SELECT * FROM firecrawl_jobs 
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `;
    const job = jobRows.length > 0 ? mapJob(jobRows[0]) : null;
    const resultRows = await db`
      SELECT * FROM firecrawl_results
      WHERE job_id = ${id} AND tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return { job, results: resultRows.map(mapResult) };
  },
};
