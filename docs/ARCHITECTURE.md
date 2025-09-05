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

### 6. Service Layer Architecture

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

### 7. Revenue Recognition Architecture (606Ledger Integration)

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

### 8. Testing Strategy

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

### 9. Security Architecture

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

### 10. Deployment Architecture

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

### 11. Performance Targets

#### API Performance
- p50 latency: < 100ms
- p95 latency: < 200ms
- p99 latency: < 500ms
- Throughput: 10,000 req/s

#### Database Performance
- Query execution: < 50ms
- Connection pooling: 20-100 connections
- Read replicas for reporting

### 12. Development Workflow

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

### 13. API Versioning

#### Version Strategy
- URL versioning: `/api/v1/`, `/api/v2/`
- Backward compatibility for 2 versions
- Deprecation notices 3 months in advance
- Migration guides for breaking changes

### 14. Monitoring & Observability

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

### 15. Migration Strategy

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

*Last Updated: January 2025*
*Version: 1.0.0*