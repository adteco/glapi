# GLAPI System Architecture

## Overview
GLAPI is a multi-tenant revenue recognition and accounting dimensions API platform built with a monorepo architecture using TypeScript, tRPC, and Next.js.

## Core Architecture Principles

### 1. API-First Design
- **tRPC for Type Safety**: All business logic implemented in tRPC routers with end-to-end type safety
- **REST API via Next.js**: tRPC procedures exposed as REST endpoints through Next.js API routes (reverse proxy pattern)
- **OpenAPI Documentation**: Comprehensive API documentation generated from tRPC schemas

### 2. Monorepo Structure
```
glapi/
├── apps/
│   ├── api/          # Express.js API server (legacy, being migrated)
│   ├── web/          # Next.js web application with API routes
│   └── docs/         # Documentation site (Next.js + MDX)
├── packages/
│   ├── api-service/  # tRPC routers and service layer
│   ├── business/     # Core business logic and domain services
│   ├── database/     # Drizzle ORM schemas and repositories
│   ├── types/        # Centralized Zod schemas and TypeScript types
│   └── mcp-server/   # MCP server for tool integrations
└── docs/            # Architecture and task documentation
```

### 3. Technology Stack

#### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **API Layer**: tRPC with Zod validation
- **REST Exposure**: Next.js API routes (reverse proxy to tRPC)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk (multi-tenant)
- **Queue**: Bull/BullMQ for async processing

#### Frontend
- **Framework**: Next.js 14 with App Router
- **UI Components**: shadcn/ui with Radix UI
- **Forms**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS

### 4. Data Architecture

#### Multi-Tenancy
- Row-level security with `organizationId`
- Clerk organization context for tenant isolation
- Shared database with tenant data isolation

#### Core Entities
```typescript
// Base entity pattern
interface BaseEntity {
  id: uuid
  organizationId: uuid
  createdAt: timestamp
  updatedAt: timestamp
}

// Accounting Dimensions
- Organizations
- Entities (Customers, Vendors, Employees, etc.)
- Subsidiaries
- Departments
- Locations
- Classes
- Items

// Revenue Recognition (ASC 606)
- Contracts
- Subscriptions
- Performance Obligations
- Revenue Schedules
- SSP Evidence
- Invoices
- Payments
```

### 5. API Pattern

#### tRPC Router Pattern
```typescript
// packages/api-service/src/routers/[entity].router.ts
export const entityRouter = router({
  list: protectedProcedure
    .input(listSchema)
    .query(({ ctx, input }) => ctx.service.list(input)),

  get: protectedProcedure
    .input(getSchema)
    .query(({ ctx, input }) => ctx.service.get(input)),

  create: protectedProcedure
    .input(createSchema)
    .mutation(({ ctx, input }) => ctx.service.create(input)),

  update: protectedProcedure
    .input(updateSchema)
    .mutation(({ ctx, input }) => ctx.service.update(input))
});
```

#### 🚨 CRITICAL: TRPC Type Inference (Prevent Type Drift)

**ALWAYS use TRPC inferred types in components. NEVER define duplicate interfaces that mirror TRPC outputs.**

Type drift occurs when components define their own interfaces that duplicate what TRPC already provides. This creates maintenance burden and runtime errors when API shapes change without components updating.

```typescript
// ❌ BAD - Separate interface that can drift from API
interface Customer {
  id: string;
  companyName: string;
  contactEmail?: string;
  status: 'active' | 'inactive';
}

const { data } = trpc.customers.list.useQuery({});
const customers = data as Customer[]; // Manual typing = DRIFT RISK

// ✅ GOOD - Use TRPC inferred types (single source of truth)
import type { RouterOutputs } from '@glapi/trpc';

// For single item from a list
type Customer = RouterOutputs['customers']['list'][number];

// For the full list response
type CustomerList = RouterOutputs['customers']['list'];

// For a single get response
type CustomerDetails = RouterOutputs['customers']['get'];

// For mutation inputs
import type { RouterInputs } from '@glapi/trpc';
type CreateCustomerInput = RouterInputs['customers']['create'];

const { data: customers } = trpc.customers.list.useQuery({});
// TypeScript now knows the exact shape - compile-time errors if API changes!
```

**Benefits of this pattern:**
1. **Compile-time safety**: TypeScript errors if API changes and component uses outdated field
2. **Single source of truth**: Types defined once in TRPC router, derived everywhere
3. **No maintenance**: Interface updates automatically when router schema changes
4. **Contract testing**: TypeScript IS the contract test between API and UI

**Where to export types from:**
```typescript
// packages/trpc/src/index.ts
export type { RouterOutputs, RouterInputs } from './trpc';

// Usage in components
import type { RouterOutputs, RouterInputs } from '@glapi/trpc';
```

**Form Data Types:**
When forms need different shapes than API responses (e.g., optional fields, transformed values), create form-specific types that derive from router types:

```typescript
import type { RouterOutputs, RouterInputs } from '@glapi/trpc';

// Base type from TRPC
type Customer = RouterOutputs['customers']['get'];

// Form-specific type (extend/modify as needed)
type CustomerFormData = Omit<RouterInputs['customers']['create'], 'organizationId'> & {
  // Add form-specific fields if needed
};
```

#### REST API Exposure (Next.js)
```typescript
// apps/web/app/api/v1/[entity]/route.ts
import { createTRPCProxy } from '@/lib/trpc-proxy';

export async function GET(request: Request) {
  return createTRPCProxy({
    procedure: 'entity.list',
    request,
    transform: (data) => ({
      success: true,
      data,
      metadata: { timestamp: new Date() }
    })
  });
}

export async function POST(request: Request) {
  return createTRPCProxy({
    procedure: 'entity.create',
    request,
    transform: (data) => ({
      success: true,
      data,
      metadata: { timestamp: new Date() }
    })
  });
}
```

### 6. Centralized Types Package (@glapi/types)

The `@glapi/types` package provides a single source of truth for all Zod schemas and TypeScript types used across the monorepo. This ensures type consistency between API validation, form validation, and database operations.

#### Package Structure
```
packages/types/
├── src/
│   ├── index.ts           # Main export file
│   ├── common/
│   │   └── index.ts       # Shared utilities and base schemas
│   ├── accounting/
│   │   └── index.ts       # Department, Location, Class, Subsidiary, Account
│   ├── entities/
│   │   └── index.ts       # Customer, Vendor, Employee, Contact, Entity
│   ├── contracts/
│   │   └── index.ts       # Contract, Subscription, Performance Obligation
│   ├── revenue/
│   │   └── index.ts       # Revenue schedules, calculations
│   └── integration/
│       └── index.ts       # Integration types, reporting
└── __tests__/             # Unit tests for all schemas
```

#### Schema Derivation Pattern

Each domain entity follows a consistent three-tier schema pattern:

```typescript
// 1. Base Schema - All fields including system fields
export const customerSchema = z.object({
  id: uuidSchema,
  organizationId: z.string(),
  companyName: z.string().min(1),
  contactEmail: z.string().email().optional(),
  status: EntityStatusEnum,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 2. Create Schema - Omit system-generated fields
export const createCustomerSchema = customerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 3. Update Schema - All fields optional, omit immutable fields
export const updateCustomerSchema = createCustomerSchema
  .omit({ organizationId: true })
  .partial();

// Type exports derived from schemas
export type Customer = z.infer<typeof customerSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
```

#### Common Utilities

The `common` module provides reusable schema building blocks:

```typescript
// UUID validation
export const uuidSchema = z.string().uuid();
export const optionalUuidSchema = emptyStringToUndefined(uuidSchema.optional());

// Date handling
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const dateRangeSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

// Currency/Decimal with precision
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const currencyStringSchema = z.string().regex(/^-?\d+(\.\d{1,2})?$/);

// Pagination
export const paginationInputSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(50),
});

// Empty string transformers (for form handling)
export function emptyStringToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' ? undefined : val), schema);
}
```

#### Usage in Applications

**In tRPC Routers (API validation):**
```typescript
import { createCustomerSchema, updateCustomerSchema } from '@glapi/types';

export const customerRouter = router({
  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(({ ctx, input }) => ctx.service.create(input)),

  update: protectedProcedure
    .input(z.object({ id: uuidSchema, data: updateCustomerSchema }))
    .mutation(({ ctx, input }) => ctx.service.update(input.id, input.data)),
});
```

**In React Forms (frontend validation):**
```typescript
import { updateCustomerSchema, EntityStatusEnum } from '@glapi/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Extend/modify schema for form-specific needs
const customerFormSchema = updateCustomerSchema.extend({
  status: EntityStatusEnum,
}).required({
  companyName: true,
  status: true,
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

function EditCustomerForm() {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
  });
  // ...
}
```

#### Testing

All schemas include comprehensive unit tests covering:
- Valid input acceptance
- Invalid input rejection
- Default value application
- Optional field handling
- Edge cases (empty strings, null values)

Run tests with:
```bash
pnpm --filter @glapi/types test
```

#### Type Relationships

```
@glapi/types (Zod schemas + inferred types)
      │
      ├── @glapi/database (Drizzle schemas should align)
      │
      ├── @glapi/api-service (tRPC input validation)
      │
      └── apps/web (form validation, UI types)
              │
              └── RouterOutputs/RouterInputs (tRPC inferred types for API responses)
```

**Key Principle**: Use `@glapi/types` for input validation schemas. Use `RouterOutputs`/`RouterInputs` for API response types in components. This ensures type safety at both validation and API consumption layers.

### 7. Service Layer Architecture

#### Repository Pattern
```typescript
// packages/database/src/repositories/base.repository.ts
export abstract class BaseRepository<T> {
  constructor(protected db: Database) {}
  
  async findById(id: string): Promise<T>
  async findAll(filters: FilterOptions): Promise<T[]>
  async create(data: CreateDTO): Promise<T>
  async update(id: string, data: UpdateDTO): Promise<T>
  async delete(id: string): Promise<void>
}
```

#### Service Pattern
```typescript
// packages/api-service/src/services/base.service.ts
export abstract class BaseService<T> {
  constructor(protected repository: BaseRepository<T>) {}
  
  async list(options: ListOptions): Promise<PaginatedResult<T>>
  async get(id: string): Promise<T>
  async create(data: CreateDTO): Promise<T>
  async update(id: string, data: UpdateDTO): Promise<T>
  async delete(id: string): Promise<void>
}
```

### 8. Revenue Recognition Architecture (606Ledger Integration)

#### ASC 606 Five-Step Process
1. **Identify the Contract**: Subscription/Contract entity
2. **Identify Performance Obligations**: Items decomposed into obligations
3. **Determine Transaction Price**: Contract value with discounts
4. **Allocate Price**: SSP-based allocation to obligations
5. **Recognize Revenue**: Point-in-time vs over-time recognition

#### Key Components
- **Revenue Calculation Engine**: Core ASC 606 calculations
- **Kit/Bundle Processor**: Explodes bundles into components
- **SSP Service**: Standalone selling price determination
- **Revenue Scheduler**: Generates recognition schedules
- **Reporting Engine**: ARR, MRR, deferred revenue reports

### 9. Testing Strategy

#### Test Pyramid
```
         /\
        /E2E\       (10%) - Playwright, critical user flows
       /------\
      /  Integ  \   (30%) - API integration tests, Supertest
     /----------\
    /    Unit     \ (60%) - Vitest, service/repository tests
   /--------------\
```

#### Test Requirements
- Minimum 80% code coverage
- All API endpoints must have integration tests
- Critical business logic requires unit tests
- Revenue calculations require reconciliation tests

### 10. Security Architecture

#### Authentication & Authorization
- **Authentication**: Clerk JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Multi-tenancy**: Organization-level isolation
- **API Security**: Rate limiting, CORS, input validation

#### Data Security
- Encryption at rest (PostgreSQL TDE)
- Encryption in transit (TLS 1.3)
- PII data masking in logs
- Audit trail for all mutations

### 11. Deployment Architecture

#### Infrastructure
```yaml
Production:
  - Database: PostgreSQL (RDS/CloudSQL)
  - Application: Containerized (Docker)
  - Hosting: Vercel (Next.js) / Cloud Run (services)
  - CDN: Cloudflare
  - Queue: Redis (Upstash)
  
Monitoring:
  - APM: DataDog/New Relic
  - Logs: CloudWatch/Stackdriver
  - Errors: Sentry
  - Analytics: Posthog
```

#### CI/CD Pipeline
1. **Code Push**: GitHub PR created
2. **Checks**: Linting, type checking, tests
3. **Preview**: Vercel preview deployment
4. **Review**: Code review required
5. **Merge**: Auto-deploy to staging
6. **Release**: Manual promotion to production

### 12. Performance Targets

#### API Performance
- p50 latency: < 100ms
- p95 latency: < 200ms
- p99 latency: < 500ms
- Throughput: 10,000 req/s

#### Database Performance
- Query execution: < 50ms
- Connection pooling: 20-100 connections
- Read replicas for reporting

### 13. Development Workflow

#### Branch Strategy
```
main (production)
  └── develop (staging)
       └── feature/TASK-XXX-description
       └── fix/issue-description
       └── chore/maintenance-task
```

#### Task Management
- Tasks defined in `/docs/tasks/`
- Follow TASK-XXX naming convention
- Each task = one feature branch
- TDD approach required

### 14. API Versioning

#### Version Strategy
- URL versioning: `/api/v1/`, `/api/v2/`
- Backward compatibility for 2 versions
- Deprecation notices 3 months in advance
- Migration guides for breaking changes

### 15. Monitoring & Observability

#### Key Metrics
```typescript
// Business Metrics
- Daily Active Organizations (DAO)
- API calls per organization
- Revenue calculation accuracy
- Processing time per calculation

// Technical Metrics
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Queue processing times
```

### 16. Migration Strategy

#### Legacy System Migration
1. **Parallel Run**: New system alongside legacy
2. **Data Sync**: Bidirectional sync during transition
3. **Gradual Cutover**: Migrate by organization
4. **Validation**: Reconciliation reports
5. **Decommission**: Remove legacy after validation

## Architecture Decision Records (ADRs)

### ADR-001: tRPC with Next.js Reverse Proxy
**Decision**: Use tRPC for business logic, expose via Next.js API routes
**Rationale**: Type safety + REST compatibility + single deployment

### ADR-002: Drizzle ORM over Prisma
**Decision**: Use Drizzle ORM for database access
**Rationale**: Better performance, closer to SQL, lighter weight

### ADR-003: Monorepo with pnpm
**Decision**: Monorepo structure with pnpm workspaces
**Rationale**: Code sharing, atomic commits, unified tooling

### ADR-004: ASC 606 Integration vs Separate Service
**Decision**: Integrate 606Ledger into GLAPI
**Rationale**: 70% overlap, unified platform, shared entities

## Compliance & Standards

### Code Standards
- ESLint configuration shared across monorepo
- Prettier for consistent formatting
- TypeScript strict mode enabled
- Conventional commits required

### API Standards
- RESTful naming conventions
- Consistent error responses
- Pagination on all list endpoints
- ISO 8601 date formats

### Documentation Standards
- OpenAPI 3.0 specification
- JSDoc for complex functions
- README in each package
- Architecture diagrams in Mermaid

## Future Considerations

### Planned Enhancements
1. GraphQL API layer (Phase 2)
2. Event-driven architecture with webhooks
3. Multi-currency support
4. Advanced workflow automation
5. AI-powered anomaly detection

### Scalability Path
1. Database sharding by organization
2. Microservices extraction for heavy processes
3. Caching layer with Redis
4. Read replicas for reporting
5. Async processing for bulk operations

---

*Last Updated: January 2026*
*Version: 1.1.0*