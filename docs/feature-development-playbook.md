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

## Development Phases

### Phase 1: Design & Definition

1. **Feature Identification & Scoping:**
   * Clearly define the feature, its objectives, and its boundaries.
   * Identify user roles and permissions relevant to the feature.
   * Document relationships with existing entities (e.g., how subsidiaries relate to customers).
   * Define expected behavior and validation rules.

2. **Data Modeling:**
   * Define or update necessary database schemas (`packages/database`).
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

1. **Service Layer Development:**
   * Implement the core business logic within the `packages/api-service` package.
   * Create a dedicated service class (e.g., `SubsidiaryService`) with standard methods:
     * `create{Entity}`: Create a new entity record.
     * `get{Entity}ById`: Retrieve a specific entity by ID.
     * `list{Entity}s`: List entities with pagination and filtering.
     * `update{Entity}`: Update an entity record.
     * `delete{Entity}`: Delete an entity record.
   * Services should:
     * Accept and verify an organization context for multi-tenancy.
     * Interact with the database (`@glapi/database`).
     * Validate inputs using Zod schemas.
     * Handle business logic including relationships and constraints.
     * Return structured data that matches the API contract.
   * Write unit tests for the service layer.

2. **API Layer Development:**
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

3. **Database Migrations:**
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
     * Follow the established pattern from `customers.openapi.yaml`
     * Include:
       * Schema definitions for the entity (`Entity`, `NewEntity`, `UpdateEntity`)
       * All CRUD endpoints with proper request/response formats
       * Query parameters for filtering, sorting, and pagination
       * Error responses for all possible failure scenarios
       * Security scheme definition (typically JWT bearer auth)
     * Validate the spec using a tool like Swagger Editor or Redocly

   * **Next.js Documentation Site (`/apps/docs`):**
     * Create a dedicated MDX file in `/apps/docs/src/app/api/{entity}/page.mdx`
     * Structure the documentation to include:
       * Overview of the entity and its purpose
       * Entity schema and field descriptions
       * Available endpoints with request/response examples
       * Common use cases and examples
       * Relationship with other entities
       * Code examples in multiple languages (JavaScript, Python, etc.)
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

### Organization Context Handling

All entities must operate within an organization context:

1. **API Layer:**
   * Extract organization ID from the `x-stytch-organization-id` header in `authMiddleware`.
   * Attach organization context to the request object.
   * Every route handler should access this context.

2. **Service Layer:**
   * Require organization context in service constructors.
   * All database queries should filter by organization ID.
   * Example:
     ```typescript
     const results = await db.select()
       .from(customers)
       .where(eq(customers.organizationId, this.context.organizationId))
       .orderBy(...)
       .limit(...)
       .offset(...);
     ```

3. **Frontend:**
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
- [ ] Zod validation schemas created in `packages/api-service/src/types/{entity}.types.ts`
- [ ] Service layer implemented with CRUD operations in `packages/api-service/src/services/{entity}-service.ts`
- [ ] API routes implemented in `apps/api/src/routes/{entity}Routes.ts`
- [ ] Unit tests for service layer
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

## Lessons Learned from Customer Implementation

1. **Session Management:**
   * Consistently access organization ID using the same path (`session?.organization_id`).
   * Do not provide fallback to placeholder or invalid IDs.
   * Log session data for debugging during development.

2. **API Response Format:**
   * Wrap single entity responses in a named object (e.g., `{ customer: {...} }`).
   * Maintain consistent response formats across endpoints.
   * Return detailed error messages with actionable information.

3. **Organization Context:**
   * All API endpoints must validate and use organization context.
   * All database queries must filter by organization ID.
   * Use a consistent approach to extract and pass organization context.

4. **Frontend Data Fetching:**
   * Handle loading states explicitly to prevent UI flashes.
   * Implement error boundaries for failed data fetching.
   * Use consistent patterns for data fetching and state management.

## Example Entity: Subsidiaries

The following section outlines the implementation plan for the "Subsidiaries" entity:

### Data Model

```typescript
// packages/database/src/schema/subsidiaries.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const subsidiaries = sqliteTable('subsidiaries', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  parentId: text('parent_id').references(() => subsidiaries.id), // Self-reference for hierarchy
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

### API Endpoints

```typescript
// Subsidiary endpoints
POST /api/v1/subsidiaries           // Create a new subsidiary
GET /api/v1/subsidiaries            // List all subsidiaries (paginated, filtered)
GET /api/v1/subsidiaries/{id}       // Get a specific subsidiary
PUT /api/v1/subsidiaries/{id}       // Update a subsidiary (full update)
PATCH /api/v1/subsidiaries/{id}     // Update a subsidiary (partial update)
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

#### OpenAPI Specification (docs/api-specs/subsidiaries.openapi.yaml)

```yaml
openapi: 3.0.0
info:
  title: Subsidiaries API
  version: v1
  description: API for managing subsidiaries within the Revenue Recognition System.

servers:
  - url: http://localhost:3000/api # Placeholder for local development

components:
  schemas:
    Subsidiary:
      type: object
      required:
        - id
        - organizationId
        - name
        - code
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the subsidiary.
          readOnly: true
        organizationId:
          type: string
          format: uuid
          description: ID of the organization this subsidiary belongs to.
          readOnly: true
        name:
          type: string
          description: Name of the subsidiary.
        code:
          type: string
          description: Unique code for the subsidiary (used in accounting systems).
        description:
          type: string
          nullable: true
          description: Optional description of the subsidiary.
        parentId:
          type: string
          format: uuid
          nullable: true
          description: ID of the parent subsidiary if this is a sub-subsidiary.
        isActive:
          type: boolean
          default: true
          description: Whether the subsidiary is active.
        createdAt:
          type: string
          format: date-time
          description: Timestamp of when the subsidiary was created.
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          description: Timestamp of when the subsidiary was last updated.
          readOnly: true

    NewSubsidiary:
      type: object
      required:
        - name
        - code
      properties:
        name:
          type: string
        code:
          type: string
        description:
          type: string
          nullable: true
        parentId:
          type: string
          format: uuid
          nullable: true
        isActive:
          type: boolean
          default: true

    # Other schemas and paths would follow the pattern from customers.openapi.yaml
```

#### MDX Documentation (apps/docs/src/app/api/subsidiaries/page.mdx)

```mdx
# Subsidiaries API

This guide covers the API endpoints for managing subsidiaries in the Revenue Recognition System.

## Overview

Subsidiaries represent distinct business units within an organization. They are used to track financial information separately for different parts of the business.

## Schema

| Field        | Type      | Description                                                | Required |
|--------------|-----------|------------------------------------------------------------|---------|
| id           | UUID      | Unique identifier (system-generated)                       | Read-only|
| organizationId | UUID    | Organization this subsidiary belongs to                    | Read-only|
| name         | String    | Name of the subsidiary                                     | Yes     |
| code         | String    | Unique code for the subsidiary                             | Yes     |
| description  | String    | Optional description                                       | No      |
| parentId     | UUID      | Parent subsidiary (for hierarchical structures)            | No      |
| isActive     | Boolean   | Whether the subsidiary is active (default: true)           | No      |
| createdAt    | DateTime  | When the record was created                                | Read-only|
| updatedAt    | DateTime  | When the record was last updated                           | Read-only|

## Endpoints

### Create Subsidiary

Create a new subsidiary within your organization.

<Endpoint method="POST" path="/api/v1/subsidiaries" />

#### Request

<RequestExample>
```json
{
  "name": "West Coast Operations",
  "code": "WCO",
  "description": "Subsidiary handling west coast sales and operations",
  "isActive": true
}
```
</RequestExample>

#### Response

<ResponseExample>
```json
{
  "subsidiary": {
    "id": "f67f0ea2-77bd-4578-8c76-0116d473cc27",
    "organizationId": "ba3b8cdf-efc1-4a60-88be-ac203d263fe2",
    "name": "West Coast Operations",
    "code": "WCO",
    "description": "Subsidiary handling west coast sales and operations",
    "parentId": null,
    "isActive": true,
    "createdAt": "2025-05-11T12:33:59.048Z",
    "updatedAt": "2025-05-11T12:33:59.048Z"
  }
}
```
</ResponseExample>

### List Subsidiaries

Retrieve a paginated list of subsidiaries in your organization.

<Endpoint method="GET" path="/api/v1/subsidiaries" />

#### Query Parameters

| Parameter      | Type    | Description                                           | Default |
|----------------|---------|-------------------------------------------------------|---------|
| page           | Integer | Page number for pagination                            | 1       |
| limit          | Integer | Number of items per page                              | 10      |
| orderBy        | String  | Field to sort by (name, code, createdAt)              | name    |
| orderDirection | String  | Sort direction (asc, desc)                            | asc     |
| isActive       | Boolean | Filter by active status                               | -       |
| parentId       | UUID    | Filter by parent subsidiary                           | -       |

// Additional endpoints and examples would follow...
```

By following this playbook, we can ensure a consistent, maintainable, and scalable approach to implementing new entities in the Revenue Recognition System.