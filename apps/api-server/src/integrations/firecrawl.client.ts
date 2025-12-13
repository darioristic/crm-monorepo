import { logger } from "../lib/logger";

interface FirecrawlClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

const config: FirecrawlClientConfig = {
  baseUrl: process.env.FIRECRAWL_SERVICE_URL || "http://localhost:4000",
  timeout: parseInt(process.env.FIRECRAWL_TIMEOUT || "60000", 10),
  retries: parseInt(process.env.FIRECRAWL_RETRIES || "3", 10),
};

function isRetryable(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("timeout") || msg.includes("503") || msg.includes("502") || msg.includes("504")
  );
}

async function request<T>(
  path: string,
  tenantId: string,
  body: unknown,
  retryCount = 0
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": tenantId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (json as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`
      );
    }
    return json as { success: boolean; data?: T; error?: { code: string; message: string } };
  } catch (error) {
    clearTimeout(timeoutId);
    logger.error({ path, error }, "Firecrawl service request failed");
    if (retryCount < config.retries && isRetryable(error)) {
      await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
      return request<T>(path, tenantId, body, retryCount + 1);
    }
    return { success: false, error: { code: "FIRECRAWL_SERVICE_ERROR", message: String(error) } };
  }
}

export const firecrawlClient = {
  scrape: <T>(tenantId: string, payload: unknown) =>
    request<T>("/firecrawl/scrape", tenantId, payload),
  crawl: <T>(tenantId: string, payload: unknown) =>
    request<T>("/firecrawl/crawl", tenantId, payload),
  map: <T>(tenantId: string, payload: unknown) => request<T>("/firecrawl/map", tenantId, payload),
  search: <T>(tenantId: string, payload: unknown) =>
    request<T>("/firecrawl/search", tenantId, payload),
  extract: <T>(tenantId: string, payload: unknown) =>
    request<T>("/firecrawl/extract", tenantId, payload),
  batchScrape: (tenantId: string, payload: unknown) =>
    request<{ jobId: string }>("/firecrawl/batch/scrape", tenantId, payload),
};
