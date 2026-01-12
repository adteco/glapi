# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.6.4 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy package files for all workspaces needed
COPY packages/database/package.json ./packages/database/
COPY apps/workers/package.json ./apps/workers/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/database ./packages/database
COPY apps/workers ./apps/workers

# Build the workers package
RUN pnpm --filter @glapi/workers build

# Production stage
FROM node:22-alpine AS runner

# Install pnpm for production dependencies
RUN corepack enable && corepack prepare pnpm@10.6.4 --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workers

# Copy built artifacts
COPY --from=builder /app/apps/workers/dist ./dist
COPY --from=builder /app/apps/workers/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Set ownership
RUN chown -R workers:nodejs /app

USER workers

# Environment defaults
ENV NODE_ENV=production
ENV METRICS_PORT=9090
ENV LOG_LEVEL=info

# Expose metrics port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9090/health || exit 1

# Run the worker
CMD ["node", "dist/index.js"]
