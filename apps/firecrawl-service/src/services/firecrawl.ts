import { logger } from "../lib/logger";

type FirecrawlEndpoint = "scrape" | "crawl" | "map" | "search" | "extract" | "batch/scrape";

interface FirecrawlConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

const config: FirecrawlConfig = {
  baseUrl: process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v1",
  timeout: parseInt(process.env.FIRECRAWL_TIMEOUT || "60000", 10),
  retries: parseInt(process.env.FIRECRAWL_RETRIES || "3", 10),
};

async function getTenantApiKey(tenantId?: string): Promise<string | null> {
  if (!tenantId) {
    return process.env.FIRECRAWL_API_KEY || null;
  }
  try {
    const url = process.env.FIRECRAWL_KEY_LOOKUP_URL;
    if (url) {
      const res = await fetch(`${url}?tenantId=${tenantId}`);
      if (res.ok) {
        const data = (await res.json()) as { apiKey?: string };
        return data.apiKey || process.env.FIRECRAWL_API_KEY || null;
      }
    }
  } catch (error) {
    logger.warn({ error }, "Tenant API key lookup failed, using default");
  }
  return process.env.FIRECRAWL_API_KEY || null;
}

function isRetryable(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504")
  );
}

async function request<T>(
  endpoint: FirecrawlEndpoint,
  tenantId: string | undefined,
  body: unknown,
  retryCount = 0
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const apiKey = await getTenantApiKey(tenantId);
  if (!apiKey) {
    return { success: false, error: { code: "NO_API_KEY", message: "Firecrawl API key missing" } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const res = await fetch(`${config.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Request-ID": `firecrawl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { message?: string }).message || `HTTP ${res.status}`);
    }
    return { success: true, data: json as T };
  } catch (error) {
    clearTimeout(timeoutId);
    logger.error({ endpoint, error }, "Firecrawl request failed");
    if (retryCount < config.retries && isRetryable(error)) {
      await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
      return request<T>(endpoint, tenantId, body, retryCount + 1);
    }
    return {
      success: false,
      error: {
        code: "FIRECRAWL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export const firecrawlService = {
  request,
};
