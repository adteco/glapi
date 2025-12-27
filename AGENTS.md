# Repository Guidelines

## Project Structure & Module Organization
This pnpm + Turborepo workspace keeps runtime apps in `apps/`: `api` (Next.js API and contract mocks), `web` (Next.js client), and `docs`. Shared services reside in `packages/` (`business`, `database` with Drizzle migrations in `drizzle/`, `api-service`, `trpc`, `integration-tests`, `mcp-server`). `docs/api-specs` hosts OpenAPI sources for SDK generation, `scripts/` contains operational helpers, and browser regression suites sit under top-level `tests/`. Avoid editing compiled output in `dist/`, `.next/`, or generated `drizzle/` snapshots.

## Build, Test & Development Commands
Install deps with `pnpm install`. Use `pnpm dev` for the full workspace, `pnpm dev:api` or `pnpm --filter web dev` for focused work, and `pnpm dev:mcp` inside `packages/mcp-server` after `nvm use 20`. Build and verify with `pnpm build`, `pnpm lint`, and `pnpm type-check`. Database workflows run through `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:studio`. Contract tooling lives in `pnpm api:mock`, `pnpm api:validate`, and `pnpm api:generate-sdk`.

## Coding Style & Naming Conventions
TypeScript, Next.js, and TRPC share a single ESLint + Prettier toolchain with 2-space indentation and trailing commas. Run `pnpm lint:fix` or each package’s `lint` before committing, and keep imports path-alias friendly by colocating types with implementations. Components and classes use `PascalCase`, functions and variables `camelCase`, directories `kebab-case`, and environment variables `SCREAMING_SNAKE_CASE` in `.env` files. Execute `pnpm precommit` once to install the repo’s formatting and lint hooks.

## Testing Guidelines
API logic is validated with Jest; run `pnpm --filter @glapi/api test` or `test:watch` during development. Shared domain and contract suites sit in `packages/integration-tests` and execute via `pnpm --filter @glapi/integration-tests test` (use `test:coverage` if metrics are needed). UI regression lives in `tests/` and runs with `pnpm test:playwright`. Name new specs `*.test.ts`/`*.spec.ts`, keep fixtures under `__tests__/fixtures`, and document any new `.env` requirements in the pull request.

## Commit & Pull Request Guidelines
Follow the repo’s conventional commits (`feat:`, `fix:`, `chore:`) and write imperative subjects, appending task IDs when applicable (e.g., `feat: add deferred revenue metrics (TASK-042)`). Group related work into focused commits. Before submitting a PR, run `pnpm lint`, `pnpm type-check`, and the relevant test commands, attaching CLI output or UI screenshots as evidence. PR descriptions should link issues, call out schema or migration changes, and note follow-up steps for downstream agents.

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

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
