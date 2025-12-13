import { type Context, Hono } from "hono";
import { addBatchScrapeJob } from "../jobs/queue";
import { firecrawlService } from "../services/firecrawl";

export const firecrawlRoutes = new Hono();

function getTenantId(c: Context): string | undefined {
  return c.req.header("X-Tenant-Id") || c.req.header("X-Company-Id") || undefined;
}

firecrawlRoutes.post("/firecrawl/scrape", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const result = await firecrawlService.request<Record<string, unknown>>("scrape", tenantId, body);
  return c.json(result, result.success ? 200 : 500);
});

firecrawlRoutes.post("/firecrawl/crawl", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const result = await firecrawlService.request<Record<string, unknown>>("crawl", tenantId, body);
  return c.json(result, result.success ? 200 : 500);
});

firecrawlRoutes.post("/firecrawl/map", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const result = await firecrawlService.request<Record<string, unknown>>("map", tenantId, body);
  return c.json(result, result.success ? 200 : 500);
});

firecrawlRoutes.post("/firecrawl/search", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const result = await firecrawlService.request<Record<string, unknown>>("search", tenantId, body);
  return c.json(result, result.success ? 200 : 500);
});

firecrawlRoutes.post("/firecrawl/extract", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const result = await firecrawlService.request<Record<string, unknown>>("extract", tenantId, body);
  return c.json(result, result.success ? 200 : 500);
});

firecrawlRoutes.post("/firecrawl/batch/scrape", async (c) => {
  const tenantId = getTenantId(c);
  const body = await c.req.json();
  const job = await addBatchScrapeJob({
    tenantId: tenantId || "unknown",
    urls: (body.urls as string[]) || [],
    options: body.options || {},
  });
  return c.json({ success: true, jobId: job.id });
});
