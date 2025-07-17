# MCP Server Deployment Guide

This guide walks you through deploying the MCP (Model Context Protocol) server architecture to production.

## Prerequisites

- Node.js 20+ and pnpm
- Cloudflare account (for Workers)
- Supabase account (or self-hosted PostgreSQL)
- Clerk account for authentication
- OpenAI API key
- Domain for your application

## Step-by-Step Deployment

### 1. Environment Setup

Create `.env` files for each environment:

#### `.env.local` (Development)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/yourapp

# Authentication
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3021
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:8787

# OpenAI
OPENAI_API_KEY=sk-...
```

#### `.env.production` (Production)
```env
# Database
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/yourapp

# Authentication
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# API URLs
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_MCP_SERVER_URL=https://mcp.yourapp.workers.dev

# OpenAI
OPENAI_API_KEY=sk-...
```

### 2. Database Setup

#### Using Supabase

1. Create a new Supabase project
2. Get your database connection string
3. Run migrations:

```bash
# Generate migrations from schema
pnpm db:generate

# Apply migrations
pnpm db:migrate
```

#### Self-hosted PostgreSQL

1. Create a PostgreSQL database
2. Ensure SSL is enabled
3. Configure connection pooling
4. Run migrations as above

### 3. Deploy tRPC API Server

The tRPC API can be deployed to various platforms:

#### Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Railway/Render/Fly.io

1. Create a new project
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

Example `railway.json`:
```json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start:api",
    "healthcheckPath": "/api/health"
  }
}
```

### 4. Deploy MCP Server to Cloudflare

1. **Configure Cloudflare account:**
```bash
# Login to Cloudflare
npx wrangler login

# Verify authentication
npx wrangler whoami
```

2. **Update `wrangler.toml`:**
```toml
name = "yourapp-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[env.production]
vars = { 
  ENVIRONMENT = "production",
  GLAPI_API_URL = "https://api.yourapp.com"
}

[[env.production.secrets]]
binding = "CLERK_SECRET_KEY"

[[env.production.secrets]]
binding = "OPENAI_API_KEY"

# Optional: Custom domain
[[env.production.routes]]
pattern = "mcp.yourapp.com"
zone_name = "yourapp.com"
```

3. **Set secrets:**
```bash
# Set Clerk secret
echo "your-clerk-secret" | npx wrangler secret put CLERK_SECRET_KEY --env production

# Set OpenAI key
echo "your-openai-key" | npx wrangler secret put OPENAI_API_KEY --env production
```

4. **Deploy:**
```bash
cd packages/mcp-server
pnpm deploy
```

5. **Verify deployment:**
```bash
# Check logs
npx wrangler tail --env production

# Test endpoint
curl -X POST https://yourapp-mcp-server.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### 5. Deploy Next.js Frontend

#### Vercel Deployment

1. **Connect repository:**
   - Go to vercel.com
   - Import your Git repository
   - Select the root directory

2. **Configure build settings:**
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

3. **Set environment variables:**
   - Add all variables from `.env.production`
   - Ensure URLs point to production endpoints

4. **Deploy:**
   ```bash
   vercel --prod
   ```

#### Self-hosted Deployment

1. **Build the application:**
```bash
pnpm build
```

2. **Create Dockerfile:**
```dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

3. **Deploy to your platform of choice**

### 6. Configure Authentication

1. **Clerk Production Setup:**
   - Create production instance at clerk.com
   - Configure allowed origins
   - Set up OAuth providers if needed
   - Configure webhook endpoints

2. **Update Clerk settings:**
```javascript
// In your app
import { ClerkProvider } from '@clerk/nextjs';

const clerkFrontendApi = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API;
const clerkSignInUrl = '/sign-in';
const clerkSignUpUrl = '/sign-up';
```

### 7. Set Up Monitoring

#### Cloudflare Analytics
- Enable Workers Analytics in Cloudflare dashboard
- Set up alerts for errors

#### Application Monitoring
```javascript
// Example with Sentry
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

#### Database Monitoring
- Enable Supabase dashboard metrics
- Set up query performance monitoring
- Configure slow query alerts

### 8. Security Checklist

- [ ] Enable CORS with specific origins
- [ ] Implement rate limiting on MCP server
- [ ] Set up DDoS protection (Cloudflare)
- [ ] Enable audit logging
- [ ] Configure security headers
- [ ] Implement input validation
- [ ] Set up SSL/TLS everywhere
- [ ] Regular security updates

### 9. Performance Optimization

1. **Database indexes:**
```sql
-- Ensure these indexes exist
CREATE INDEX idx_entities_org_id ON entities(organization_id);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_name ON entities(name);
```

2. **Cloudflare optimizations:**
   - Enable caching where appropriate
   - Use Cloudflare KV for session storage
   - Implement request coalescing

3. **Next.js optimizations:**
   - Enable ISR for static pages
   - Implement proper caching headers
   - Use dynamic imports

### 10. Backup and Disaster Recovery

1. **Database backups:**
   - Enable automated backups in Supabase
   - Test restore procedures
   - Document recovery process

2. **Code backups:**
   - Use Git tags for releases
   - Maintain deployment history
   - Document rollback procedures

## Troubleshooting

### Common Issues

1. **CORS errors:**
   - Verify allowed origins in all services
   - Check preflight request handling

2. **Authentication failures:**
   - Verify Clerk keys are correct
   - Check token expiration settings

3. **Database connection issues:**
   - Verify connection string
   - Check SSL requirements
   - Monitor connection pool

4. **Cloudflare Worker limits:**
   - Monitor CPU time usage
   - Check memory consumption
   - Review request limits

## Maintenance

### Regular Tasks

- **Weekly:**
  - Review error logs
  - Check performance metrics
  - Update dependencies

- **Monthly:**
  - Security patches
  - Database optimization
  - Cost review

- **Quarterly:**
  - Disaster recovery test
  - Performance audit
  - Security review

## Scaling Considerations

As your application grows:

1. **Database scaling:**
   - Implement read replicas
   - Consider sharding strategy
   - Optimize queries

2. **API scaling:**
   - Implement caching layer
   - Use CDN for static assets
   - Consider microservices

3. **MCP server scaling:**
   - Cloudflare Workers auto-scale
   - Monitor usage limits
   - Implement request batching

## Cost Optimization

- Use Cloudflare's free tier effectively
- Optimize database queries to reduce compute
- Implement proper caching strategies
- Monitor and optimize OpenAI API usage

## Support and Updates

- Join Cloudflare Workers Discord
- Follow tRPC updates
- Monitor Clerk changelog
- Subscribe to security advisories