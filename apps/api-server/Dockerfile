# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock ./
COPY apps/api-server/package.json ./apps/api-server/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies
RUN bun install --frozen-lockfile --production

# ============================================
# Stage 2: Builder
# ============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api-server/node_modules ./apps/api-server/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY apps/api-server ./apps/api-server
COPY packages ./packages
COPY tsconfig.json ./

# Build the application
WORKDIR /app/apps/api-server
RUN bun build src/index.ts --outdir ./dist --target bun --minify

# ============================================
# Stage 3: Production Runner
# ============================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Copy built application and dependencies
COPY --from=builder /app/apps/api-server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api-server/package.json ./

# Copy source files needed at runtime (migrations, seeds)
COPY --from=builder /app/apps/api-server/src/db ./src/db

# Set ownership
RUN chown -R appuser:bunjs /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["bun", "run", "dist/index.js"]

