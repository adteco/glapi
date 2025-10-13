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
