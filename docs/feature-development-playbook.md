# Feature Development Playbook

## Introduction

This playbook provides a comprehensive guide for developing new features within the Revenue Recognition System. It documents the process from feature conception to deployment, ensuring consistency, quality, and clear communication across the development lifecycle. This playbook is particularly focused on implementing new entity types like subsidiaries, departments, locations, classes, and other accounting dimensions.

## Guiding Principles

Our development process follows these key principles:

* **API-First Approach:** Design and document APIs before UI implementation.
* **Test-Driven Development:** Write tests before implementation where appropriate.
* **Leave the Place Cleaner Than You Found It:** Continuously improve the codebase.
* **Clear Communication:** Document decisions, edge cases, and implementation details.
* **Consistent Patterns:** Follow established patterns for similar features.
* **Organization Context Awareness:** All entities belong to an organization context.
* **Separation of Concerns:** Maintain clear separation between data access, business logic, and presentation layers.

## Development Phases

### Phase 1: Design & Definition

1. **Feature Identification & Scoping:**
   * Clearly define the feature, its objectives, and its boundaries.
   * Identify user roles and permissions relevant to the feature.
   * Document relationships with existing entities (e.g., how subsidiaries relate to customers).
   * Define expected behavior and validation rules.

2. **Data Modeling:**
   * Define or update necessary database schemas (`packages/database/src/schema`).
   * Consider multi-tenancy design (each entity belongs to an organization context).
   * Design relationships between entities (foreign keys, etc.).
   * Define data transfer objects (DTOs) and validation schemas (using Zod in `packages/api-service/src/types`).
   * Consider soft-delete patterns for entities requiring historical preservation.

3. **API Contract Definition:**
   * Design the API endpoints (paths, methods, request/response bodies).
   * Document the API using OpenAPI v3.x specifications. Store specs in `docs/api-specs/`.
   * Define the following standard endpoints:
     * `POST /{entity}`: Create a new entity.
     * `GET /{entity}`: List all entities with pagination, filtering, and sorting.
     * `GET /{entity}/{id}`: Retrieve a specific entity.
     * `PUT /{entity}/{id}`: Full update of an entity.
     * `PATCH /{entity}/{id}`: Partial update of an entity.
     * `DELETE /{entity}/{id}`: Delete an entity.
   * Consider success and error responses, status codes, pagination, and filtering.
   * Document authentication and organization context requirements.

### Phase 2: Implementation (Backend)

1. **Repository Layer Development:**
   * Implement data access logic in the `packages/database/src/repositories` directory.
   * Create a dedicated repository class (e.g., `SubsidiaryRepository`) with standard methods:
     * `findById`: Retrieve a specific entity by ID.
     * `findAll`: List entities with pagination and filtering.
     * `create`: Create a new entity record.
     * `update`: Update an entity record.
     * `delete`: Delete an entity record.
   * All repositories should:
     * Extend the `BaseRepository` class.
     * Interact directly with the database using Drizzle ORM.
     * Include organization context filtering in all queries.
     * Handle data formatting and transformation.
     * Return properly structured data objects.

2. **Service Layer Development:**
   * Implement the core business logic within the `packages/api-service/src/services` package.
   * Create a dedicated service class (e.g., `SubsidiaryService`) with standard methods:
     * `create{Entity}`: Create a new entity record.
     * `get{Entity}ById`: Retrieve a specific entity by ID.
     * `list{Entity}s`: List entities with pagination and filtering.
     * `update{Entity}`: Update an entity record.
     * `delete{Entity}`: Delete an entity record.
   * Services should:
     * Accept and verify an organization context for multi-tenancy.
     * Use repositories for data access (NOT direct database queries).
     * Validate inputs using Zod schemas.
     * Handle business logic including relationships and constraints.
     * Return structured data that matches the API contract.
   * Write unit tests for the service layer.

3. **API Layer Development:**
   * Implement the HTTP interface in the dedicated API application (`apps/api` using Express.js).
   * Create a dedicated route file (e.g., `apps/api/src/routes/subsidiaryRoutes.ts`).
   * API route handlers should:
     * Extract and validate the organization context from the request.
     * Validate incoming requests using Zod schemas.
     * Call the appropriate service methods.
     * Format responses according to the OpenAPI specification.
     * Handle errors consistently.
   * Implement standard endpoint pattern:
     * Extract request data (path params, query params, body).
     * Validate request data.
     * Call service method with organization context.
     * Format and return response.
   * Apply authentication and authorization middleware.
   * Write integration tests for the API endpoints.

4. **Database Migrations:**
   * Generate and apply database migrations using Drizzle Kit.
   * Commands:
     * `pnpm run db:generate`: Generate migration files.
     * `pnpm run db:migrate`: Apply migrations to the database.
   * Ensure migrations are reversible when possible.
   * Include seed data for testing if appropriate.

### Phase 3: Implementation (Frontend)

1. **API Client Updates:**
   * Update the client-side API adapter (`apps/web/src/lib/db-adapter.ts`).
   * Add new entity methods to the `apiClient` object.
   * Implement standard methods following the pattern from existing entities:
     * `list`: Fetch paginated list of entities.
     * `getById`: Fetch a single entity by ID.
     * `create`: Create a new entity.
     * `update`: Update an existing entity.
     * `delete`: Delete an entity.
   * Ensure proper organization context is passed in headers.

2. **UI Components:**
   * Develop the UI components in the Next.js web application (`apps/web`).
   * Create the following pages for each entity type:
     * List page (`/app/{entity}/page.tsx`): Display all entities with filtering and pagination.
     * Detail page (`/app/{entity}/[id]/page.tsx`): Display a single entity's details.
     * Create page (`/app/{entity}/new/page.tsx`): Form to create a new entity.
     * Edit page (`/app/{entity}/[id]/edit/page.tsx`): Form to edit an entity.
   * Implement component-level hooks for data fetching and state management.
   * Handle loading and error states gracefully.
   * Add entity form validation that mirrors API validation.
   * Follow UI patterns from existing entity implementations.

3. **Authentication & Authorization:**
   * Ensure components check for session existence.
   * Redirect unauthenticated users to login.
   * Pass organization context from Stytch session in API requests.
   * Handle permission-based UI rendering based on user roles.

### Phase 4: Testing & Quality Assurance

1. **Component Testing:**
   * Test UI components in isolation.
   * Verify form validation, loading states, and error handling.

2. **Integration Testing:**
   * Test the complete flow from UI to API and database.
   * Verify CRUD operations work end-to-end.
   * Test filtering, pagination, and sorting functionality.

3. **Error Handling:**
   * Verify proper error messages for various failure scenarios.
   * Test API validation error responses.
   * Ensure UI handles and displays errors appropriately.

4. **Security Testing:**
   * Verify authorization checks prevent unauthorized access.
   * Test organization context isolation (users can only access their own organization's data).
   * Check input validation prevents security issues.

### Phase 5: Documentation & Finalization

1. **API Documentation:**
   * **OpenAPI Specification:**
     * Create or update the OpenAPI spec file in `docs/api-specs/{entity}.openapi.yaml`
     * Follow the established pattern from existing specs (e.g., `subsidiaries.openapi.yaml`)
     * Include:
       * Schema definitions for the entity (`Entity`, `NewEntity`, `UpdateEntity`)
       * All CRUD endpoints with proper request/response formats
       * Query parameters for filtering, sorting, and pagination
       * Error responses for all possible failure scenarios
       * Security scheme definition (typically auth headers)
     * Validate the spec using a tool like Swagger Editor or Redocly

   * **Next.js Documentation Site (`/apps/docs`):**
     * Create a dedicated MDX file in `/apps/docs/src/app/api/{entity}/page.mdx`
     * Structure the documentation to include:
       * Overview of the entity and its purpose
       * Entity schema and field descriptions
       * Available endpoints with request/response examples
       * Common use cases and code examples
       * Relationship with other entities
       * Error codes and troubleshooting
     * Update the navigation in `/apps/docs/src/app/api/page.mdx` to include the new entity
     * Ensure the documentation is accessible and well-formatted

   * **Developer Documentation:**
     * Document any implementation details or non-obvious decisions
     * Include information about relationships, constraints, and business rules
     * Add instructional comments in the code where appropriate

2. **Code Review:**
   * Open a Pull Request (PR) against the `main` branch.
   * Include all necessary changes (code, tests, documentation, OpenAPI specs).
   * Address feedback from reviewers.

3. **Pre-merge Checks:**
   * Ensure all automated checks (linting, tests) pass.
   * Verify feature meets all requirements.

4. **Merging & Deployment:**
   * Merge the PR once approved.
   * Deploy changes according to the deployment process.

## Implementation Patterns

### Repository Pattern

The Repository pattern provides a clean separation between data access logic and business logic:

1. **Repository Structure:**
   * Each entity has its own repository class extending `BaseRepository`.
   * Repositories handle all direct database interactions via Drizzle ORM.
   * Example location: `packages/database/src/repositories/{entity}-repository.ts`

2. **Standard Methods:**
   * `findById`: Retrieve a single entity with organization context.
   * `findAll`: List entities with filtering, pagination, and organization context.
   * `create`: Insert a new entity.
   * `update`: Update an existing entity.
   * `delete`: Delete an entity.
   * Custom methods for specialized queries.

3. **Example Repository Method:**
   ```typescript
   async findById(id: string, organizationId: string) {
     const [result] = await this.db
       .select()
       .from(entities)
       .where(
         and(
           eq(entities.id, id),
           eq(entities.organizationId, organizationId)
         )
       )
       .limit(1);
     
     return result || null;
   }
   ```

### Organization Context Handling

All entities must operate within an organization context:

1. **API Layer:**
   * Extract organization ID from the `x-stytch-organization-id` header in `authMiddleware`.
   * Attach organization context to the request object.
   * Every route handler should access this context.

2. **Service Layer:**
   * Require organization context in service constructors.
   * Pass organization context to repository methods.
   * Example:
     ```typescript
     const organizationId = this.requireOrganizationContext();
     const result = await this.entityRepository.findById(id, organizationId);
     ```

3. **Repository Layer:**
   * Include organization ID in all query filters.
   * Example:
     ```typescript
     const results = await this.db
       .select()
       .from(entities)
       .where(eq(entities.organizationId, organizationId))
       .orderBy(...)
       .limit(...)
       .offset(...);
     ```

4. **Frontend:**
   * Store Stytch organization ID in session.
   * Include organization ID in all API requests.
   * If no organization ID is available, redirect to login.

### Error Handling

Implement consistent error handling:

1. **Service Layer:**
   * Throw typed errors (e.g., `ServiceError`) with status codes, error codes, and descriptive messages.
   * Use error types like `NotFoundError`, `ValidationError`, `AuthorizationError`.

2. **API Layer:**
   * Catch service errors and map to appropriate HTTP responses.
   * Log errors with relevant context but omit sensitive data.
   * Return standardized error responses matching the OpenAPI spec.

3. **Frontend:**
   * Display user-friendly error messages.
   * Provide clear actions for error recovery.
   * Log detailed errors for debugging.

### Response Formatting

Maintain consistent response formats:

1. **List Endpoints:**
   ```json
   {
     "data": [...],
     "total": 100,
     "page": 1,
     "limit": 10,
     "totalPages": 10
   }
   ```

2. **Get Single Entity:**
   ```json
   {
     "{entityName}": {
       "id": "...",
       ...
     }
   }
   ```

3. **Create/Update Responses:**
   ```json
   {
     "{entityName}": {
       "id": "...",
       ...
     }
   }
   ```

4. **Error Responses:**
   ```json
   {
     "message": "Error description",
     "code": "ERROR_CODE",
     "details": { ... }
   }
   ```

## Entity Implementation Checklist

For each new entity type (e.g., subsidiary, department, location, class), ensure completion of:

### Backend
- [ ] Database schema defined in `packages/database/src/schema/{entity}.ts`
- [ ] Database migrations generated and applied
- [ ] Repository layer implemented in `packages/database/src/repositories/{entity}-repository.ts`
- [ ] Zod validation schemas created in `packages/api-service/src/types/{entity}.types.ts`
- [ ] Service layer implemented with CRUD operations in `packages/api-service/src/services/{entity}-service.ts`
- [ ] API routes implemented in `apps/api/src/routes/{entity}Routes.ts`
- [ ] Unit tests for repository and service layers
- [ ] Integration tests for API endpoints
- [ ] Authorization checks implemented

### Frontend
- [ ] Frontend API client methods added to `apps/web/src/lib/db-adapter.ts`
- [ ] List page UI component created in `apps/web/src/app/{entity}/page.tsx`
- [ ] Detail page UI component created in `apps/web/src/app/{entity}/[id]/page.tsx`
- [ ] Create form UI component created in `apps/web/src/app/{entity}/new/page.tsx`
- [ ] Edit form UI component created in `apps/web/src/app/{entity}/[id]/edit/page.tsx`
- [ ] Form validation implemented
- [ ] Loading and error states handled
- [ ] Component tests implemented

### Documentation
- [ ] OpenAPI specification created in `docs/api-specs/{entity}.openapi.yaml`
- [ ] API documentation page created in `apps/docs/src/app/api/{entity}/page.mdx`
- [ ] Navigation updated in docs to include new entity
- [ ] README or developer documentation updated with implementation details
- [ ] Example requests and responses documented
- [ ] Relationship with other entities documented

## Lessons Learned from Implementation

1. **Separation of Concerns:**
   * Keep data access (repositories), business logic (services), and API endpoints (routes) clearly separated.
   * Services should never contain direct database queries; use repositories instead.
   * Repositories handle data formatting and transformation.

2. **Session Management:**
   * Consistently access organization ID using the same path (`session?.organization_id`).
   * Do not provide fallback to placeholder or invalid IDs.
   * Log session data for debugging during development.

3. **API Response Format:**
   * Wrap single entity responses in a named object (e.g., `{ customer: {...} }`).
   * Maintain consistent response formats across endpoints.
   * Return detailed error messages with actionable information.

4. **Organization Context:**
   * All API endpoints must validate and use organization context.
   * All database queries must filter by organization ID.
   * Use a consistent approach to extract and pass organization context.

5. **Frontend Data Fetching:**
   * Handle loading states explicitly to prevent UI flashes.
   * Implement error boundaries for failed data fetching.
   * Use consistent patterns for data fetching and state management.

## Example Entity: Subsidiaries

The following section outlines the implementation plan for the "Subsidiaries" entity:

### Data Model

```typescript
// packages/database/src/schema/subsidiaries.ts
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const subsidiaries = pgTable('subsidiaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  description: varchar('description', { length: 1000 }),
  parentId: uuid('parent_id').references(() => subsidiaries.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

### Repository Layer

```typescript
// packages/database/src/repositories/subsidiary-repository.ts
import { and, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { subsidiaries } from '../db/schema/subsidiaries';

export class SubsidiaryRepository extends BaseRepository {
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(subsidiaries)
      .where(
        and(
          eq(subsidiaries.id, id),
          eq(subsidiaries.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }
  
  async findAll(
    organizationId: string, 
    pagination: { page?: number; limit?: number; orderBy?: string; orderDirection?: string },
    filters: { isActive?: boolean; parentId?: string | null }
  ) {
    // Implementation details...
  }
  
  // Other methods: create, update, delete, etc.
}
```

### Service Layer

```typescript
// packages/api-service/src/services/subsidiary-service.ts
import { SubsidiaryRepository } from '@glapi/database/src/repositories/subsidiary-repository';
import { BaseService } from './base-service';
import { ServiceError } from '../types';

export class SubsidiaryService extends BaseService {
  private subsidiaryRepository: SubsidiaryRepository;
  
  constructor(context = {}) {
    super(context);
    this.subsidiaryRepository = new SubsidiaryRepository();
  }
  
  async getSubsidiaryById(id: string) {
    const organizationId = this.requireOrganizationContext();
    return await this.subsidiaryRepository.findById(id, organizationId);
  }
  
  // Other methods...
}
```

### API Endpoints

```typescript
// Subsidiary endpoints
POST /api/v1/subsidiaries           // Create a new subsidiary
GET /api/v1/subsidiaries            // List all subsidiaries (paginated, filtered)
GET /api/v1/subsidiaries/{id}       // Get a specific subsidiary
PUT /api/v1/subsidiaries/{id}       // Update a subsidiary
DELETE /api/v1/subsidiaries/{id}    // Delete a subsidiary
```

### Frontend Pages

```
/subsidiaries                       // List all subsidiaries
/subsidiaries/new                   // Create a new subsidiary
/subsidiaries/{id}                  // View subsidiary details
/subsidiaries/{id}/edit             // Edit a subsidiary
```

### Documentation Examples

Refer to the documentation in `/apps/docs/src/app/api/subsidiaries/page.mdx` for comprehensive documentation of the subsidiaries API, including examples of requests, responses, and error handling.

By following this playbook, we can ensure a consistent, maintainable, and scalable approach to implementing new entities in the Revenue Recognition System.