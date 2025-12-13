# Firecrawl Microservice Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY apps/firecrawl-service/package.json ./apps/firecrawl-service/
RUN bun install --production

COPY apps/firecrawl-service ./apps/firecrawl-service

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

WORKDIR /app/apps/firecrawl-service
CMD ["bun", "run", "src/index.ts"]
