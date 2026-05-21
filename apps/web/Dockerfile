FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.6.4 --activate

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3041
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG BETTER_AUTH_URL=http://localhost:3041

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glapi \
    BETTER_AUTH_SECRET=build-time-placeholder-build-time-placeholder \
    BETTER_AUTH_URL="$BETTER_AUTH_URL" \
    NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
    pnpm turbo run build --filter=web

FROM node:22-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
