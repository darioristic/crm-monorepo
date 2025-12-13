import { Hono } from "hono";

declare const Bun: {
  serve: (opts: { fetch: (req: Request) => Response | Promise<Response>; port: number }) => unknown;
};

import { logger } from "./lib/logger";
import { firecrawlRoutes } from "./routes/firecrawl";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
app.route("/", firecrawlRoutes);

const port = parseInt(process.env.PORT || "4000", 10);
logger.info({ port }, "Firecrawl service starting");
Bun.serve({
  fetch: app.fetch,
  port,
});
