import { errorResponse, successResponse } from "@crm/utils";
import { firecrawlQueries } from "../db/queries/firecrawl";
import { DomainEvent } from "../domain/base/Event";
import { EventStore } from "../infrastructure/EventStore";
import { firecrawlClient } from "../integrations/firecrawl.client";
import type { AuthContext } from "../middleware/auth";
import {
  applyCompanyIdFromHeader,
  getCompanyIdForFilter,
  json,
  RouteBuilder,
  withAuth,
} from "./helpers";

const router = new RouteBuilder();
const eventStore = new EventStore();

class FirecrawlEvent extends DomainEvent {
  constructor(params: {
    aggregateId: string;
    tenantId: string;
    userId?: string;
    eventType:
      | "WebsiteScraped"
      | "WebsiteCrawled"
      | "WebsiteMapped"
      | "WebsiteSearched"
      | "WebsiteDataExtracted";
    eventData: Record<string, unknown>;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: "Firecrawl",
      eventType: params.eventType,
      eventVersion: 1,
      eventData: params.eventData,
      metadata: {
        tenantId: params.tenantId,
        userId: params.userId,
        timestamp: new Date(),
      },
    });
  }
}

async function resolveTenantId(
  request: Request,
  url: URL,
  auth: AuthContext
): Promise<string | null> {
  const effectiveUrl = applyCompanyIdFromHeader(request, url);
  const resolved = await getCompanyIdForFilter(effectiveUrl, auth, false);
  if (resolved.error) return null;
  return resolved.companyId || auth.activeTenantId || null;
}

router.post("/api/firecrawl/scrape", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "scrape", body);
    const result = await firecrawlClient.scrape<Record<string, unknown>>(tenantId, body);
    if (!result.success || !result.data) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "completed", { completedAt: new Date() });
    await firecrawlQueries.addResult(job.id, tenantId, auth.userId, result.data);
    await eventStore.append([
      new FirecrawlEvent({
        aggregateId: job.id,
        tenantId,
        userId: auth.userId,
        eventType: "WebsiteScraped",
        eventData: { requestId: job.requestId, input: body, output: result.data },
      }),
    ]);
    return successResponse({ jobId: job.id, result: result.data });
  });
});

router.post("/api/firecrawl/crawl", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "crawl", body);
    const result = await firecrawlClient.crawl<Record<string, unknown>>(tenantId, body);
    if (!result.success || !result.data) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "completed", { completedAt: new Date() });
    await firecrawlQueries.addResult(job.id, tenantId, auth.userId, result.data);
    await eventStore.append([
      new FirecrawlEvent({
        aggregateId: job.id,
        tenantId,
        userId: auth.userId,
        eventType: "WebsiteCrawled",
        eventData: { requestId: job.requestId, input: body, output: result.data },
      }),
    ]);
    return successResponse({ jobId: job.id, result: result.data });
  });
});

router.post("/api/firecrawl/map", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "map", body);
    const result = await firecrawlClient.map<Record<string, unknown>>(tenantId, body);
    if (!result.success || !result.data) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "completed", { completedAt: new Date() });
    await firecrawlQueries.addResult(job.id, tenantId, auth.userId, result.data);
    await eventStore.append([
      new FirecrawlEvent({
        aggregateId: job.id,
        tenantId,
        userId: auth.userId,
        eventType: "WebsiteMapped",
        eventData: { requestId: job.requestId, input: body, output: result.data },
      }),
    ]);
    return successResponse({ jobId: job.id, result: result.data });
  });
});

router.post("/api/firecrawl/search", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "search", body);
    const result = await firecrawlClient.search<Record<string, unknown>>(tenantId, body);
    if (!result.success || !result.data) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "completed", { completedAt: new Date() });
    await firecrawlQueries.addResult(job.id, tenantId, auth.userId, result.data);
    await eventStore.append([
      new FirecrawlEvent({
        aggregateId: job.id,
        tenantId,
        userId: auth.userId,
        eventType: "WebsiteSearched",
        eventData: { requestId: job.requestId, input: body, output: result.data },
      }),
    ]);
    return successResponse({ jobId: job.id, result: result.data });
  });
});

router.post("/api/firecrawl/extract", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "extract", body);
    const result = await firecrawlClient.extract<Record<string, unknown>>(tenantId, body);
    if (!result.success || !result.data) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "completed", { completedAt: new Date() });
    await firecrawlQueries.addResult(job.id, tenantId, auth.userId, result.data);
    await eventStore.append([
      new FirecrawlEvent({
        aggregateId: job.id,
        tenantId,
        userId: auth.userId,
        eventType: "WebsiteDataExtracted",
        eventData: { requestId: job.requestId, input: body, output: result.data },
      }),
    ]);
    return successResponse({ jobId: job.id, result: result.data });
  });
});

router.post("/api/firecrawl/batch/scrape", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const body = (await request.json()) as Record<string, unknown>;
    const job = await firecrawlQueries.createJob(tenantId, auth.userId, "batch_scrape", body);
    const result = await firecrawlClient.batchScrape(tenantId, body);
    if (!result.success) {
      await firecrawlQueries.updateJobStatus(job.id, "failed", { error: result.error?.message });
      return json(errorResponse("FIRECRAWL_ERROR", result.error?.message || "Error"), 502);
    }
    await firecrawlQueries.updateJobStatus(job.id, "processing", { startedAt: new Date() });
    const serviceJobId =
      typeof result.data === "object" &&
      result.data &&
      "jobId" in (result.data as Record<string, unknown>)
        ? (result.data as { jobId?: string }).jobId
        : undefined;
    return successResponse({ jobId: job.id, serviceJobId });
  });
});

router.get("/api/firecrawl/jobs", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const type = url.searchParams.get("type") as
      | "scrape"
      | "crawl"
      | "map"
      | "search"
      | "extract"
      | "batch_scrape"
      | null;
    const limit = Number(url.searchParams.get("limit") || "50");
    const offset = Number(url.searchParams.get("offset") || "0");
    const { jobs, total } = await firecrawlQueries.listJobs(
      tenantId,
      type ?? undefined,
      limit,
      offset
    );
    return successResponse(jobs, {
      page: Math.floor(offset / Math.max(limit, 1)) + 1,
      pageSize: limit,
      totalCount: total,
      totalPages: Math.ceil(total / Math.max(limit, 1)),
    });
  });
});

router.get("/api/firecrawl/jobs/:id", async (request, url, params) => {
  return withAuth(request, async (auth) => {
    const tenantId = await resolveTenantId(request, url, auth);
    if (!tenantId) return errorResponse("VALIDATION_ERROR", "Tenant required");
    const { job, results } = await firecrawlQueries.getJobWithResults(tenantId, params.id);
    if (!job) return errorResponse("NOT_FOUND", "Job not found");
    return successResponse({
      id: job.id,
      requestId: job.requestId,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      results: results.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        content: r.content,
      })),
    });
  });
});

export const firecrawlRoutes = router.getRoutes();
