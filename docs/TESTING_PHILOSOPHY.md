# Testing Philosophy

This document defines **what to test** and **what not to test** for GLAPI. For commands and CI flow, see [TESTING.md](TESTING.md).

## The Test Pyramid

```
                  ┌─────────────────┐
                  │   E2E Tests     │  ← Post-deploy + critical PR paths
                  │    ~10%         │
                  └────────┬────────┘
                           │
            ┌──────────────┴──────────────┐
            │ API Integration + Smoke     │  ← PR + staging/prod gates
            │            ~20%             │
            └──────────────┬──────────────┘
                           │
  ┌────────────────────────┴────────────────────────┐
  │           Unit / Service Tests (Fast)           │  ← Every commit
  │                     ~70%                        │
  └─────────────────────────────────────────────────┘
```

### Tier 1: Unit and Service Tests (Jest/TS)

**When**: Every commit, PR quality gate

- Business rules in services (`packages/api-service/src/services/**`)
- Validation and type behavior (`packages/types`, `packages/shared-types`)
- Pure transformations and calculation logic
- Mock external boundaries (database access, third-party APIs, storage)

### Tier 2: API Integration and Smoke (Karate)

**When**: PR gate, staging/prod verification

- Real HTTP requests against tRPC/REST entry points
- Auth and org/user context behavior with Clerk-backed sessions
- Billing and analytics path expectations
- Regression checks for common failure modes (401/403/500)

Primary location: `tests/karate/**/*.feature`

### Tier 3: Browser Critical Paths (Playwright)

**When**: PR for high-risk UI changes, post-deploy checks

- Login and navigation flows
- Client/billing workflows and key UX paths
- Cross-page integration behavior

Primary location: `tests/**/*.spec.ts`

---

## Deploy Fast, Test Thoroughly

GLAPI uses a staged release model with fast quality gates and environment verification:

```
PR opened
  → Unit/service + API smoke checks (merge blockers)
  → Merge to staging
  → Deploy staging
  → Staging verification (Karate smoke + selected E2E)
  → Promote staging → main
  → Deploy production
  → Production-safe verification
```

Guiding principle: keep PR feedback fast, then increase confidence at environment boundaries.

---

## What Makes a Test Valuable

A valuable test:

1. Catches production-relevant bugs.
2. Documents expected behavior clearly.
3. Runs fast enough to stay in daily usage.
4. Avoids duplicate coverage across tiers.
5. Tests behavior rather than internal implementation.

---

## What to Test First (Priority Matrix)

| Priority   | What                              | Why                            | GLAPI Examples                                                             |
| ---------- | --------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| **High**   | Core accounting and billing rules | Financial correctness          | Invoicing, unbilled time calculations, project billing rollups             |
| **High**   | Authz boundaries                  | Security and tenant isolation  | Clerk auth context, org/user scoping, role-restricted endpoints            |
| **High**   | Data integrity workflows          | Prevent irreversible errors    | Order-to-invoice transitions, transactional updates, idempotent operations |
| **Medium** | Integration boundaries            | Frequent source of regressions | tRPC router/service boundaries, API-service/database interactions          |
| **Medium** | Error paths from incidents        | Real-world reliability         | Unauthorized access, missing context headers, partial failure handling     |
| **Low**    | Cosmetic UI behavior              | Lower business risk            | Layout-only changes, static rendering details                              |

---

## What Not to Test

### Library internals

Do not test behavior owned by third-party libraries (Zod, Drizzle, Clerk SDK internals). Test your usage and boundary conditions.

### Duplicate logic at multiple tiers

If business rules are thoroughly covered at service level, API and E2E should focus on transport, auth, and user flow behavior.

### Exhaustive permutations with low value

Use representative boundary sets instead of combinatorial explosion.

---

## Anti-Patterns to Avoid

1. Trivial assertions that cannot catch meaningful regressions.
2. Implementation-coupled tests that break during safe refactors.
3. Re-testing the same behavior in unit, API, and E2E without added value.
4. Missing boundary and invalid-input coverage.
5. Heavy I/O in unit tests.

---

## GLAPI-Specific Guidance

### Keep Strong Coverage On

- Client billing and invoicing computations
- Project analytics endpoints used by dashboard views
- Auth-sensitive workflow listing and mutations
- Time-entry to billing conversion logic

### Invest Next

- Service-layer tests for recently added billing features
- Additional Karate scenarios for unauthorized/forbidden access patterns
- Staging post-deploy Playwright smoke for customer-facing billing pages

### Explicitly Out of Scope

- Privy-specific testing (GLAPI uses Clerk)
- IPFS-related behaviors (not part of GLAPI architecture)
- Container-runtime concerns for API deployment at this stage

---

## Target Metrics (Set and Track in CI)

| Metric                       | Target                     |
| ---------------------------- | -------------------------- |
| Unit/service suite runtime   | < 60s per PR shard         |
| Karate smoke runtime         | < 90s                      |
| Staging verification runtime | < 15 minutes               |
| Flaky test rate              | < 2%                       |
| Escaped regression rate      | Downward trend per release |

---

## Related Docs

- [TESTING.md](TESTING.md)
- [plans/client-billing-platform](plans/client-billing-platform)
- [../AGENTS.md](../AGENTS.md)
