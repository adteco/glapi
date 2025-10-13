# Quick Start Guide: MCP Architecture

Get your MCP-powered application running in 15 minutes!

## Prerequisites

- Node.js 20+ and pnpm installed
- PostgreSQL database (local or Supabase)
- Clerk account (free tier works)
- OpenAI API key
- Cloudflare account (free tier)

## 1. Clone the Sample Project

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-starter
cd mcp-starter

# Install dependencies
pnpm install
```

## 2. Set Up Environment Variables

Create `.env.local` in the root directory:

```env
# Database (get from Supabase or use local PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/mcp_demo"

# Clerk (get from clerk.com dashboard)
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# URLs (for local development)
NEXT_PUBLIC_API_URL="http://localhost:3021"
NEXT_PUBLIC_MCP_SERVER_URL="http://localhost:8787"

# OpenAI (get from platform.openai.com)
OPENAI_API_KEY="sk-..."
```

## 3. Set Up the Database

```bash
# Generate database schema
pnpm db:generate

# Run migrations
pnpm db:migrate

# (Optional) Seed with sample data
pnpm db:seed
```

## 4. Start Development Servers

Open 3 terminal windows:

**Terminal 1 - Next.js App:**
```bash
pnpm dev:web
# Runs on http://localhost:3000
```

**Terminal 2 - tRPC API Server:**
```bash
pnpm dev:api
# Runs on http://localhost:3021
```

**Terminal 3 - MCP Server:**
```bash
cd packages/mcp-server
pnpm dev
# Runs on http://localhost:8787
```

## 5. Test the Application

1. Open http://localhost:3000
2. Sign up with Clerk
3. Navigate to the Chat page
4. Try these commands:
   - "List all customers"
   - "Create a new customer called Acme Corp"
   - "Show me active vendors"

## 6. Project Structure

```
your-app/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   └── lib/      # Utilities
│   │   └── package.json
│   └── api/              # tRPC API server
│       ├── src/
│       │   ├── routers/  # API endpoints
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── mcp-server/       # Cloudflare Worker
│   │   ├── src/
│   │   │   ├── tools/    # AI tools
│   │   │   └── index.ts
│   │   └── wrangler.toml
│   └── database/         # Shared DB schema
│       ├── src/
│       │   └── schema/
│       └── package.json
└── package.json          # Root package
```

## 7. Adding a New Entity Type

Let's add a "Products" entity as an example:

### Step 1: Database Schema

```typescript
// packages/database/src/schema/products.ts
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  sku: text('sku').unique(),
  price: numeric('price', { precision: 10, scale: 2 }),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Step 2: tRPC Router

```typescript
// apps/api/src/routers/products.ts
export const productsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(products);
  }),
  
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      sku: z.string(),
      price: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(products).values(input);
    }),
});
```

### Step 3: MCP Tools

```typescript
// packages/mcp-server/src/tools/products.ts
export function registerProductTools(server: MCPServer): void {
  server.registerTool({
    name: 'list_products',
    description: 'List all products',
    inputSchema: {
      type: 'object',
      properties: {},
    }
  }, async (args, context) => {
    const client = createBackendClient(context);
    const products = await client.products.list.query();
    return createDataResponse('Products:', products);
  });
}
```

### Step 4: Frontend Page

```typescript
// apps/web/src/app/products/page.tsx
export default function ProductsPage() {
  const { data: products } = trpc.products.list.useQuery();
  
  return (
    <div>
      {products?.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

## 8. Deployment Quick Start

### Deploy MCP Server to Cloudflare:

```bash
cd packages/mcp-server

# Login to Cloudflare
npx wrangler login

# Deploy
pnpm deploy
```

### Deploy Next.js to Vercel:

```bash
# From root directory
vercel --prod
```

## Common Commands

```bash
# Development
pnpm dev          # Start all services
pnpm dev:web      # Start only web
pnpm dev:api      # Start only API
pnpm dev:mcp      # Start only MCP server

# Database
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed data
pnpm db:studio    # Open Drizzle Studio

# Testing
pnpm test         # Run tests
pnpm test:e2e     # Run E2E tests

# Building
pnpm build        # Build all packages
pnpm build:web    # Build only web
pnpm build:api    # Build only API

# Deployment
pnpm deploy:mcp   # Deploy MCP server
pnpm deploy:prod  # Deploy everything
```

## Troubleshooting

### "Server not initialized" error
- The MCP server is stateless. Make sure your tools don't depend on initialization.

### CORS errors
- Check that all your domains are in the allowed origins list
- Verify the API URL in your environment variables

### Database connection errors
- Verify your DATABASE_URL is correct
- Check if migrations have been run
- Ensure PostgreSQL is running

### Authentication issues
- Verify Clerk keys are correct
- Check that organization ID is being passed
- Ensure tokens aren't expired

## Next Steps

1. **Customize the UI**: Modify components in `apps/web/src/components`
2. **Add more tools**: Create new tool files in `packages/mcp-server/src/tools`
3. **Extend the schema**: Add fields to existing entities or create new ones
4. **Implement webhooks**: Add real-time updates via Clerk webhooks
5. **Add monitoring**: Integrate Sentry or similar for error tracking

## Resources

- [MCP Protocol Docs](https://modelcontextprotocol.io)
- [tRPC Documentation](https://trpc.io)
- [Clerk Documentation](https://clerk.com/docs)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team)

## Getting Help

- **Discord**: Join our community at discord.gg/your-channel
- **GitHub Issues**: Report bugs at github.com/your-org/mcp-starter
- **Documentation**: Full docs at docs.your-app.com

Happy building! 🚀