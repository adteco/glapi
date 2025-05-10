# Feature Development Playbook

## Introduction

This playbook chronicles and guides the process for developing new features within the Revenue Recognition System. It aims to ensure consistency, quality, and clear communication across the development lifecycle.

## Guiding Principles

Our development process is guided by the principles outlined in `CONTRIBUTING.md`, including:

*   **API-First Approach:** Design and document APIs before UI implementation.
*   **Leave the Place Cleaner Than You Found It:** Continuously improve the codebase.
*   **Clear Communication:** Document decisions and progress.

## Development Phases

Feature development is typically broken down into the following phases:

### Phase 1: Design & Definition

1.  **Feature Identification & Scoping:**
    *   Clearly define the feature, its objectives, and its boundaries.
    *   Identify user roles and permissions relevant to the feature.
2.  **Data Modeling:**
    *   Define or update necessary database schemas (`packages/database`).
    *   Define data transfer objects (DTOs) and validation schemas (e.g., using Zod in `packages/api-service/src/types`).
3.  **API Contract Definition:**
    *   Design the API endpoints (paths, methods, request/response bodies).
    *   Document the API using OpenAPI v3.x specifications. Store specs in `docs/api-specs/`.
    *   Consider success and error responses, status codes, and pagination/filtering where applicable.

### Phase 2: Implementation & Testing

1.  **Service Layer Development:**
    *   Implement the core business logic within the `packages/api-service` package.
    *   Services should interact with the database (`@glapi/database`) and encapsulate feature logic.
    *   Write unit tests for the service layer.
2.  **API Layer Development:**
    *   Implement the HTTP interface in the dedicated API application (`apps/api` using Express.js).
    *   API route handlers should validate incoming requests (using Zod schemas from `packages/api-service`), call the appropriate service methods, and format responses according to the OpenAPI specification.
    *   Implement authentication and authorization middleware as needed.
    *   Write integration tests for the API endpoints.
3.  **Database Migrations:**
    *   Generate and apply database migrations using Drizzle Kit (`pnpm run db:generate` and `pnpm run db:migrate` in `packages/database`).

### Phase 3: Documentation & UI/UX Development

1.  **API Documentation Site:**
    *   Ensure the OpenAPI specifications are up-to-date.
    *   Generate and publish user-facing API documentation (e.g., in `/apps/docs` or a dedicated portal).
2.  **UI/UX Implementation:**
    *   Develop the user interface components in the Next.js web application (`packages/web`).
    *   The UI should consume the defined and implemented APIs from `apps/api`.
    *   Follow design guidelines from `docs/design-ux.md`.

### Phase 4: Review & Merge

1.  **Code Reviews:**
    *   Open a Pull Request (PR) against the `main` branch (or relevant feature branch).
    *   Ensure the PR includes all necessary changes (code, tests, documentation, OpenAPI specs).
    *   Address feedback from reviewers.
2.  **Pre-merge Checks:**
    *   Ensure all automated checks (linting, tests) pass.
3.  **Merging:**
    *   Merge the PR once approved.

## Current Feature Example: Customer Management

This section details the application of the playbook to the "Customer Management" feature.

### Phase 1: Design & Definition (Customer Management)

*   **Feature:** Allow users to Create, Read, Update, and Delete customer records.
*   **Data Modeling:**
    *   Relevant database tables: `entities` (with `entity_type = 'Customer'`), potentially `contacts`, `addresses`.
    *   Zod schemas defined in `packages/api-service/src/types/customer.types.ts` for `NewCustomer`, `Customer`, and `UpdateCustomer`.
*   **API Contract Definition:**
    *   Specification stored in `docs/api-specs/customers.openapi.yaml`.
    *   Endpoints:
        *   `POST /customers`: Create a new customer.
        *   `GET /customers`: List all customers (with pagination).
        *   `GET /customers/{id}`: Retrieve a specific customer.
        *   `PUT /customers/{id}`: Update a specific customer (full update).
        *   `PATCH /customers/{id}`: Partially update a specific customer.
        *   `DELETE /customers/{id}`: Delete a specific customer.

### Phase 2: Implementation & Testing (Customer Management)

*   **Service Layer (`packages/api-service`):**
    *   `CustomerService` (`packages/api-service/src/services/customerService.ts`) implements `createCustomer`, `getCustomerById`, `getAllCustomers`, `updateCustomer`, `deleteCustomer` methods.
    *   Interacts with the `entities` table in the database via `@glapi/database`.
*   **API Layer (`apps/api` - Express.js):**
    *   Customer routes defined in `apps/api/src/routes/customerRoutes.ts`.
    *   Uses `CustomerService` to handle business logic.
    *   Input validation performed using Zod schemas from `customer.types.ts`.
    *   Decision: A dedicated Express.js application (`apps/api`) was chosen over Next.js API Routes for clearer separation of concerns, independent deployability, and a more direct path to potential future migration to serverless functions.
*   **Database Migrations:**
    *   Schema changes for `entities` and related tables (if any) are managed via Drizzle migrations.

*(Phases 3 & 4 for Customer Management will be filled in as development progresses)*

## Future Considerations

*   **Scalability:** As the application grows, the Express.js application in `apps/api` can be a candidate for decomposition into individual serverless functions (e.g., AWS Lambda functions, one per route or resource) for better scalability and independent deployment of API endpoints. The service-oriented architecture with `packages/api-service` facilitates this transition.
*   **CI/CD:** Implement a robust CI/CD pipeline for automated testing, building, and deployment of `apps/api`, `packages/web`, and database migrations. 