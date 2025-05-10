# MCP Server (Model Context Protocol)

## 1. Introduction & Purpose

The MCP (Model Context Protocol) Server is a backend component designed to act as a specialized API layer or an orchestration service within the Revenue Recognition System. The concept is inspired by the architecture found in the `stytchauth/mcp-stytch-b2b-okr-manager` example project, which utilizes Cloudflare Workers for this purpose.

**MCP Definition (for this project):**
While "Model Context Protocol" can be broad, in this system, it refers to a server that handles specific, potentially complex, client-facing interactions that may require orchestration of multiple backend services (Lambdas, database queries) or manage real-time/streaming communication with the frontend.

**Purpose in Revenue Recognition System:**
*   **Orchestrate Complex Workflows:** Manage multi-step processes that might be too cumbersome for a single Lambda or require coordination across different services (e.g., previewing the financial impact of a complex contract modification before committing).
*   **Serve Real-Time Updates:** Utilize technologies like Server-Sent Events (SSE) to provide live updates to the frontend for long-running tasks (e.g., progress of bulk data imports/exports, status of large report generation).
*   **Specialized API Interface:** Offer a tailored API to the frontend that might be more use-case specific than the granular APIs exposed by individual Lambda functions.
*   **Encapsulate Business Logic:** House business logic that is broader in scope than a single microservice (Lambda) or requires maintaining some state or context across multiple user interactions (potentially using Cloudflare KV store).

**Primary Reference Implementation:**
*   [stytchauth/mcp-stytch-b2b-okr-manager](https://github.com/stytchauth/mcp-stytch-b2b-okr-manager)

## 2. Technology Stack & Hosting

*   **Hosting Platform:** Cloudflare Workers (leveraging its serverless execution environment, global distribution, and integration with other Cloudflare services).
*   **Primary Language:** TypeScript.
*   **State Management/Storage:** Cloudflare KV Store (for caching, temporary state for workflows, or user-specific context if needed by MCP operations).
*   **Authentication:** Stytch B2B authentication will be used to protect all MCP Server endpoints. The server will expect a Stytch JWT in the Authorization header.

## 3. Key Functionalities (Examples - To Be Refined)

The specific functionalities of the MCP server will evolve, but here are initial candidates relevant to the Revenue Recognition System:

*   **A. Contract Modification Impact Analysis (Preview):**
    *   **Description:** Allow users to model a contract modification (e.g., change quantities, add/remove products, change dates) and see the potential impact on SSP allocation, revenue schedules, and deferred revenue *before* the modification is finalized and saved.
    *   **Interaction:** Frontend sends proposed modification details; MCP Server orchestrates calls to SSP logic (perhaps a Lambda), recalculates schedules (potentially new logic or another Lambda), and returns a summary of changes.

*   **B. Complex Report Generation & Streaming:**
    *   **Description:** For reports that are computationally intensive or involve large datasets (e.g., detailed multi-year revenue waterfall across many contracts), the MCP Server can initiate the report generation (possibly triggering a series of Lambda functions or a batch process) and stream progress or results back to the client using SSE.
    *   **Interaction:** Frontend requests a complex report; MCP Server starts the process, provides a job ID, and opens an SSE stream for status updates. Final report might be stored (e.g., S3 via a Lambda) and a link provided.

*   **C. Bulk Data Operations Management:**
    *   **Description:** Manage the process for bulk importing contracts or bulk updating SSP evidence. Provides feedback on progress, validation errors, and final status.
    *   **Interaction:** User uploads a file (e.g., CSV) via the frontend; file is sent to an ingestion Lambda. MCP Server can track the processing of this bulk job and provide updates.

*   **D. Real-time Dashboard Aggregations (Conditional):**
    *   **Description:** If certain dashboard components require real-time aggregated data that is too complex for direct Supabase queries or benefits from caching at the edge, the MCP server could provide these data points.
    *   **Interaction:** Frontend requests dashboard data; MCP Server fetches, aggregates (possibly from multiple sources or cached results), and returns it.

## 4. API Contracts (Illustrative MCP Server Endpoints)

These are examples and will be defined in more detail in the API Contracts document.

*   **Contract Modification Preview:**
    *   `POST /mcp/v1/contracts/preview-modification`
    *   Request Body: `{ contract_id: string, proposed_changes: object }`
    *   Response Body: `{ impact_summary: object, preview_schedules: object[] }`

*   **Complex Report Status (SSE):**
    *   `GET /mcp/v1/reports/{reportJobId}/status` (Returns an SSE stream)
    *   Events: `progress`, `validationError`, `completed`, `failed`

*   **Initiate Complex Report:**
    *   `POST /mcp/v1/reports/generate-custom`
    *   Request Body: `{ report_type: string, parameters: object }`
    *   Response Body: `{ reportJobId: string, status_endpoint: string }`

## 5. Data Flow & Interactions

*   **Frontend (Next.js) <-> MCP Server (Cloudflare Worker):**
    *   Frontend makes HTTPS requests to MCP Server endpoints, including Stytch JWT for auth.
    *   MCP Server may use SSE to stream data back to the frontend.

*   **MCP Server <-> Supabase DB (PostgreSQL):**
    *   MCP Server can directly query the Supabase database.
    *   It will need to set the `request.jwt.claims` for the Stytch user to ensure RLS policies are correctly applied if fetching user-specific data.
    *   Alternatively, for data modifications or complex queries already encapsulated in Lambdas, it might invoke those Lambdas.

*   **MCP Server <-> AWS Lambda Functions:**
    *   MCP Server can invoke AWS Lambda functions via AWS API Gateway (or directly if architected for it, though API Gateway is more common for external invocation).
    *   This allows leveraging existing business logic within Lambdas for specific tasks (e.g., running SSP allocation logic, generating a piece of a report).
    *   Requires secure authentication from MCP Server to the API Gateway (e.g., IAM authorization or API keys if appropriate).

*   **MCP Server <-> Cloudflare KV Store:**
    *   Used for storing temporary state related to ongoing operations managed by the MCP Server (e.g., status of a report job, intermediate data for a complex workflow).
    *   Can also be used for caching data frequently accessed by MCP Server logic.

## 6. Authentication & Authorization

*   **Endpoint Protection:** All MCP Server endpoints will be protected. Requests must include a valid Stytch session JWT in the `Authorization: Bearer <token>` header.
*   **Stytch Integration:** The MCP Server (Cloudflare Worker) will need access to Stytch Project ID and Secret to validate incoming JWTs (similar to how Lambdas would, or by calling a Stytch /authenticate endpoint).
*   **User Context Propagation:** When the MCP Server interacts with Supabase or invokes other backend services (like Lambdas) on behalf of a user, it must correctly propagate the user's identity (e.g., Stytch user ID from the JWT) so that appropriate RLS and permissions are enforced downstream.

## 7. Local Development & Deployment

*   **Local Development:** Utilize Cloudflare's `wrangler` CLI for local development and testing of the Worker functions.
    *   `wrangler dev` command.
    *   Local mocking or connection to development instances of Supabase/Stytch.
*   **Deployment:** Deploy to Cloudflare Workers using `wrangler publish` (or `npm run deploy` if configured in `package.json`).
*   **Configuration:** Environment variables and secrets (Stytch Project ID, Secret, KV Namespace bindings) will be managed through `wrangler.toml` (or `wrangler.jsonc` as seen in example) and Cloudflare dashboard/API for secrets.

## 8. Relationship to Next.js Frontend

The Next.js application (drawing patterns from `stytchauth/stytch-b2b-nextjs-quickstart-example` [https://github.com/stytchauth/stytch-b2b-nextjs-quickstart-example](https://github.com/stytchauth/stytch-b2b-nextjs-quickstart-example)) will be the primary client of the MCP Server.

*   The frontend will initiate requests to the MCP Server for functionalities that are best handled by this layer (e.g., complex previews, SSE updates).
*   Standard CRUD operations or simpler API interactions might still go directly from the frontend to AWS Lambda functions via API Gateway, depending on the defined architectural boundaries. 