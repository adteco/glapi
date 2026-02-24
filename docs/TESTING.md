# Testing and Release Pipeline

## Objective

Define a practical test strategy and CI/CD release flow for GLAPI with **staging** and **production** environments, without moving API runtime to containers.

## Current Test Layers

| Layer                     | Purpose                                | Primary Commands                                        | Typical Trigger          |
| ------------------------- | -------------------------------------- | ------------------------------------------------------- | ------------------------ |
| Quality gates             | Keep mainline healthy                  | `pnpm lint`, `pnpm type-check`, `pnpm build`            | Every PR / push          |
| API smoke (Karate)        | Validate auth + critical tRPC behavior | `pnpm test:karate:trpc-auth`                            | Post-deploy staging/prod |
| Domain API tests (Karate) | Validate ASC606 and domain workflows   | `pnpm test:karate:asc606`, `pnpm test:karate:demo-seed` | On-demand / nightly      |
| Browser E2E (Playwright)  | Validate UI-level flows                | `pnpm test:playwright`                                  | PR and pre-release       |

## Environment Matrix

| Environment | Branch           | API Base URL                                               | Web URL                                                | Purpose                                        |
| ----------- | ---------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Local       | feature branches | `http://localhost:3031`                                    | `http://localhost:3000`                                | Development and debugging                      |
| Staging     | `staging`        | `https://api-staging.glapi.net` (or configured equivalent) | `https://staging.glapi.net` (or configured equivalent) | Integration and release candidate verification |
| Production  | `main`           | `https://api.glapi.net`                                    | `https://www.glapi.net`                                | Customer-facing runtime                        |

## Non-Container Deployment Stance

We are **not** using container deployment for API right now.

- Keep Next.js + API deployment on current platform path (Vercel/GitHub integration).
- Use pipeline gates around deployment quality instead of introducing container orchestration complexity.
- Revisit containerization only if we need stronger runtime isolation, custom networking, or cost/perf control that current hosting cannot provide.

## Staging and Production Pipeline

### 1. PR Quality Gate

On pull request:

1. Run generated-file checks.
2. Run lint + type-check + build.
3. Run targeted tests as needed (Playwright/API suites).
4. Require green checks before merge.

Source workflows today:

- `.github/workflows/ci.yml`
- `.github/workflows/e2e-tests.yml`

### 2. Staging Verification Gate

On push to `staging` (or manual dispatch):

1. Deploy staging (existing hosting integration).
2. Run post-deploy API smoke against staging:
   - `pnpm test:karate:trpc-auth`
3. Fail fast on auth-context regressions (`401` vs `200` expectations).

Workflow:

- `.github/workflows/environment-verification.yml` (added)

### 3. Production Verification Gate

On push to `main` (or manual dispatch):

1. Deploy production.
2. Run production-safe API smoke:
   - `pnpm test:karate:trpc-auth`
3. Treat failure as release regression; fix-forward with highest priority.

Workflow:

- `.github/workflows/environment-verification.yml` (added)

## Required GitHub Environment Configuration

Create GitHub Environments:

- `staging`
- `production`

Set the following environment variables/secrets in each:

- `vars.API_BASE_URL` (required)
- `vars.KARATE_ORG_ID` (optional but recommended; defaults exist in `tests/karate/karate-config.js`)
- `vars.KARATE_USER_ID` (optional but recommended)
- `secrets.KARATE_API_KEY` (optional)

## Commands

### Local quality check

```bash
pnpm lint
pnpm type-check
pnpm build
```

### Local API smoke check

```bash
KARATE_BASE_URL=http://localhost:3031 pnpm test:karate:trpc-auth
```

### Against staging

```bash
KARATE_BASE_URL=https://api-staging.glapi.net pnpm test:karate:trpc-auth
```

### Against production

```bash
KARATE_BASE_URL=https://api.glapi.net pnpm test:karate:trpc-auth
```

## Promotion Model

- Preferred: merge feature branches into `staging`, validate there, then promote `staging` into `main`.
- `main` remains production-only.
- No direct production hotfix without running at least the staging-equivalent verification unless incident response demands it.

## Immediate Next Steps

1. Ensure `staging` branch exists and is protected.
2. Configure `staging` and `production` GitHub environments with `API_BASE_URL`.
3. Enable required status checks on branch protection using:
   - CI Quality Gate
   - Environment Verification (staging/production)
4. Add broader post-deploy suites (Playwright smoke, additional Karate tags) after this baseline is stable.
