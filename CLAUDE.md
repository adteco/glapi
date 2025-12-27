# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains a monorepo for the GLAPI project, which is a revenue recognition system with an accounting dimensions API. The project is structured using Turborepo and pnpm workspaces, with three main applications and several packages:

- **apps/api**: Express.js REST API server with authentication middleware
- **apps/docs**: Documentation site built with Next.js and MDX for API documentation  
- **apps/web**: Web application built with Next.js using Stytch for authentication and shadcn/ui components
- **packages/api-service**: Service layer with business logic for customers, organizations, and accounting dimensions
- **packages/business**: Core business logic and transaction handling
- **packages/database**: Database access layer using Drizzle ORM with PostgreSQL schemas

## Common Commands

### Development

```bash
# Install dependencies with pnpm
pnpm install

# Start development server for all workspaces
pnpm dev

# Start development servers for specific workspaces
pnpm --filter web dev
pnpm --filter docs dev
pnpm dev:api  # Start the Express API server only
```

### Building

```bash
# Build all workspaces
pnpm build

# Build specific workspace
pnpm --filter web build
pnpm --filter docs build
```

### Testing and Linting

```bash
# Run linting on all workspaces
pnpm lint

# Run linting on specific workspace
pnpm --filter web lint

# Type checking
pnpm type-check

# Type checking specific workspace
pnpm --filter web type-check
```

### Database Operations

```bash
# Generate database schemas from schema files
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Test database connection
pnpm --filter database test:connection
```

## Architecture

The project follows a monorepo structure using Turborepo for task orchestration and pnpm for package management:

1. **API Server (apps/api)**:
   - Express.js REST API with CORS support
   - Route handlers for customers, organizations, classes, departments, locations, subsidiaries
   - Authentication middleware
   - Uses packages/api-service for business logic

2. **Web Application (apps/web)**:
   - Next.js application with App Router
   - Clerk for authentication and user management
   - shadcn/ui components with Radix UI primitives
   - Forms with react-hook-form and zod validation
   - CRUD interfaces for accounting dimensions

3. **Documentation (apps/docs)**:
   - Next.js with MDX for API documentation
   - Tailwind CSS for styling
   - API endpoint documentation for all accounting dimensions

4. **API Service Layer (packages/api-service)**:
   - Service classes for each accounting dimension (customers, organizations, etc.)
   - Type definitions for all entities
   - Stytch utilities for authentication
   - Base service pattern for common CRUD operations

5. **Database Layer (packages/database)**:
   - Drizzle ORM with PostgreSQL
   - Repository pattern for data access
   - Schema definitions for accounting dimensions and revenue recognition entities
   - Migration scripts and database connection utilities

The system is designed around accounting dimensions (customers, organizations, subsidiaries, departments, locations, classes) with a focus on revenue recognition, contract management, and performance obligation tracking. The API follows RESTful conventions with consistent patterns across all dimension endpoints.

## Development Notes

- The project uses TypeScript throughout for type safety
- Zod is used for runtime validation across API and web layers
- The API server uses Express.js with middleware for authentication and CORS
- Repository and service patterns provide consistent data access and business logic
- All accounting dimensions follow the same CRUD pattern for consistency
- Tests can be run on individual packages with `pnpm --filter <package> test`

## Important: Monorepo Import Guidelines

- **DO NOT use relative paths between packages** - This is a monorepo managed by pnpm workspaces
- Always import packages using their package names as defined in their package.json
- Example: Use `import { something } from '@glapi/database'` NOT `import { something } from '../database'`
- Each package should be treated as an independent module with its own dependencies
- The monorepo tooling (pnpm and Turborepo) handles the linking between packages automatically

<!-- MCP_AGENT_MAIL_AND_BEADS_SNIPPET_START -->

## MCP Agent Mail: coordination for multi-agent workflows

What it is
- A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources.
- Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

Why it's useful
- Prevents agents from stepping on each other with explicit file reservations (leases) for files/globs.
- Keeps communication out of your token budget by storing messages in a per-project archive.
- Offers quick reads (`resource://inbox/...`, `resource://thread/...`) and macros that bundle common flows.

How to use effectively
1) Same repository
   - Register an identity: call `ensure_project`, then `register_agent` using this repo's absolute path as `project_key`.
   - Reserve files before you edit: `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)` to signal intent and avoid conflict.
   - Communicate with threads: use `send_message(..., thread_id="FEAT-123")`; check inbox with `fetch_inbox` and acknowledge with `acknowledge_message`.
   - Read fast: `resource://inbox/{Agent}?project=<abs-path>&limit=20` or `resource://thread/{id}?project=<abs-path>&include_bodies=true`.
   - Tip: set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

2) Across different repos in one project (e.g., Next.js frontend + FastAPI backend)
   - Option A (single project bus): register both sides under the same `project_key` (shared key/path). Keep reservation patterns specific (e.g., `frontend/**` vs `backend/**`).
   - Option B (separate projects): each repo has its own `project_key`; use `macro_contact_handshake` or `request_contact`/`respond_contact` to link agents, then message directly. Keep a shared `thread_id` (e.g., ticket key) across repos for clean summaries/audits.

Macros vs granular tools
- Prefer macros when you want speed or are on a smaller model: `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
- Use granular tools when you need control: `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`.

Common pitfalls
- "from_agent not registered": always `register_agent` in the correct `project_key` first.
- "FILE_RESERVATION_CONFLICT": adjust patterns, wait for expiry, or use a non-exclusive reservation when appropriate.
- Auth errors: if JWT+JWKS is enabled, include a bearer token with a `kid` that matches server JWKS; static bearer is used only when JWT is disabled.

## Integrating with Beads (dependency-aware task planning)

Beads provides a lightweight, dependency-aware issue database and a CLI (`bd`) for selecting "ready work," setting priorities, and tracking status. It complements MCP Agent Mail's messaging, audit trail, and file-reservation signals. Project: [steveyegge/beads](https://github.com/steveyegge/beads)

Recommended conventions
- **Single source of truth**: Use **Beads** for task status/priority/dependencies; use **Agent Mail** for conversation, decisions, and attachments (audit).
- **Shared identifiers**: Use the Beads issue id (e.g., `bd-123`) as the Mail `thread_id` and prefix message subjects with `[bd-123]`.
- **Reservations**: When starting a `bd-###` task, call `file_reservation_paths(...)` for the affected paths; include the issue id in the `reason` and release on completion.

Typical flow (agents)
1) **Pick ready work** (Beads)
   - `bd ready --json` → choose one item (highest priority, no blockers)
2) **Reserve edit surface** (Mail)
   - `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true, reason="bd-123")`
3) **Announce start** (Mail)
   - `send_message(..., thread_id="bd-123", subject="[bd-123] Start: <short title>", ack_required=true)`
4) **Work and update**
   - Reply in-thread with progress and attach artifacts/images; keep the discussion in one thread per issue id
5) **Complete and release**
   - `bd close bd-123 --reason "Completed"` (Beads is status authority)
   - `release_file_reservations(project_key, agent_name, paths=["src/**"])`
   - Final Mail reply: `[bd-123] Completed` with summary and links

Mapping cheat-sheet
- **Mail `thread_id`** ↔ `bd-###`
- **Mail subject**: `[bd-###] …`
- **File reservation `reason`**: `bd-###`
- **Commit messages (optional)**: include `bd-###` for traceability

Event mirroring (optional automation)
- On `bd update --status blocked`, send a high-importance Mail message in thread `bd-###` describing the blocker.
- On Mail "ACK overdue" for a critical decision, add a Beads label (e.g., `needs-ack`) or bump priority to surface it in `bd ready`.

Pitfalls to avoid
- Don't create or manage tasks in Mail; treat Beads as the single task queue.
- Always include `bd-###` in message `thread_id` to avoid ID drift across tools.


<!-- MCP_AGENT_MAIL_AND_BEADS_SNIPPET_END -->
