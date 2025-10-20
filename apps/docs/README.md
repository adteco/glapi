# GLAPI Documentation

Comprehensive API documentation for GLAPI built with Fumadocs and Scalar API Reference.

## 🚀 Quick Start

### Development

```bash
# Start the documentation dev server
pnpm dev

# Or from root
pnpm --filter docs dev
```

The documentation will be available at: **http://localhost:3032**

### Generate OpenAPI Specification

```bash
# From root directory
pnpm --filter @glapi/trpc generate-openapi
```

## 📁 Project Structure

```
apps/docs/
├── app/
│   ├── api-reference/      # Scalar API playground
│   ├── docs/               # Documentation pages
│   └── (home)/            # Homepage
├── content/docs/
│   ├── getting-started.mdx
│   ├── api/
│   │   ├── index.mdx
│   │   ├── authentication.mdx
│   │   ├── endpoints/      # API endpoint docs
│   │   └── objects/        # Object type docs
├── public/api/
│   └── openapi.json       # Auto-generated (106KB)
└── source.config.ts
```

## ✅ What's Been Created

### Core Documentation
- ✅ **Getting Started** - Quick start guide with TypeScript, Python, cURL examples
- ✅ **API Overview** - Introduction and architecture
- ✅ **Authentication** - Clerk auth guide with multi-language examples
- ✅ **Endpoints Overview** - Complete endpoint reference structure
- ✅ **Objects Overview** - Data type documentation structure
- ✅ **Customer Endpoint** - Full CRUD example (template for others)
- ✅ **Customer Object** - Complete field reference (template for others)

### Interactive Features
- ✅ **Scalar API Playground** at `/api-reference`
- ✅ **OpenAPI Spec** - Auto-generated from tRPC (105 operations, 42 paths)

## 🚧 Next Steps

### 1. Complete Endpoint Documentation (20 remaining)

Use `content/docs/api/endpoints/customers.mdx` as template:

- [ ] vendors.mdx
- [ ] organizations.mdx
- [ ] subsidiaries.mdx
- [ ] departments.mdx
- [ ] locations.mdx
- [ ] classes.mdx
- [ ] accounts.mdx
- [ ] employees.mdx
- [ ] leads.mdx
- [ ] prospects.mdx
- [ ] contacts.mdx
- [ ] items.mdx
- [ ] warehouses.mdx
- [ ] price-lists.mdx
- [ ] units-of-measure.mdx
- [ ] invoices.mdx
- [ ] payments.mdx
- [ ] business-transactions.mdx
- [ ] subscriptions.mdx
- [ ] revenue.mdx

### 2. Complete Object Documentation (117+ remaining)

Use `content/docs/api/objects/customer.mdx` as template. See `packages/database/src/db/schema/` for all 118 schemas.

### 3. Create Documentation Generators

```bash
# Auto-generate endpoint docs from tRPC routers
scripts/generate-endpoint-docs.ts

# Auto-generate object docs from Drizzle schemas
scripts/generate-object-docs.ts
```

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.4 with App Router
- **Documentation**: Fumadocs 15.8.5
- **API Reference**: Scalar API Reference
- **Styling**: Tailwind CSS 4.1.14
- **Content**: MDX with Fumadocs MDX

## 📖 Writing Documentation

### Add a New Endpoint

1. Create: `content/docs/api/endpoints/{name}.mdx`
2. Use `customers.mdx` as template
3. Include: list, get, create, update, delete operations
4. Add code examples in TypeScript, Python, cURL
5. Document parameters and schemas

### Add a New Object

1. Create: `content/docs/api/objects/{name}.mdx`
2. Use `customer.mdx` as template
3. Document all fields with types, validations, examples
4. Include relationships and code snippets

## 🔗 Key URLs

- **Docs**: http://localhost:3032
- **API Playground**: http://localhost:3032/api-reference
- **OpenAPI Spec**: http://localhost:3032/api/openapi.json

## 📚 Resources

- [Fumadocs Documentation](https://fumadocs.dev)
- [Scalar API Reference](https://github.com/scalar/scalar)
- [Next.js Documentation](https://nextjs.org/docs)
