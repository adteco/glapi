FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.6.4 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@glapi/api-fastify

FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.6.4 --activate

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

COPY --from=builder --chown=api:nodejs /app/apps/api-fastify/dist ./apps/api-fastify/dist
COPY --from=builder --chown=api:nodejs /app/apps/api-fastify/node_modules ./apps/api-fastify/node_modules
COPY --from=builder --chown=api:nodejs /app/apps/api-fastify/package.json ./apps/api-fastify/package.json
COPY --from=builder --chown=api:nodejs /app/apps/docs/public/api ./apps/docs/public/api
COPY --from=builder --chown=api:nodejs /app/packages ./packages
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/package.json ./package.json
COPY --from=builder --chown=api:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

USER api

ENV NODE_ENV=production
ENV PORT=3041

EXPOSE 3041

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3041/api/health || exit 1

CMD ["node", "apps/api-fastify/dist/index.js"]
