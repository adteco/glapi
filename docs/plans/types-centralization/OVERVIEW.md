# Types Centralization Implementation Plan

## Executive Summary

This plan outlines the creation of a centralized `@glapi/types` package that serves as the single source of truth for all Zod schemas and TypeScript types across the GLAPI monorepo. Currently, types are duplicated between `packages/api-service/src/types/` and `packages/trpc/src/routers/`, leading to maintenance burden and potential type drift. This refactoring will eliminate duplication, improve type safety, and enable consistent validation across all layers.

Additionally, this plan includes comprehensive integration tests for "client to cash" flows covering time entries, projects, and invoicing workflows.

---

## Task Analysis

**User Request**: Create a centralized types package and refactor existing code to use it, plus add integration tests for client-to-cash flows.

**Scope**:
- Included: New `@glapi/types` package, refactoring of trpc/api-service, web app updates, documentation, integration tests
- Excluded: Database schema changes, API breaking changes, new features

**Dependencies**:
- Existing Zod schemas in api-service
- Existing duplicated schemas in trpc routers
- pnpm workspace configuration
- Turborepo build pipeline

**Estimated Complexity**: Complex (multi-package refactoring)

**Estimated Time**: 3-5 days

---

## Architecture Compliance Check

### Layers Affected
- [x] Database Layer (Drizzle/Supabase/Neo4j) - Type imports only
- [x] Service Layer (Business Logic) - Import refactoring
- [x] API Layer (HTTP Endpoints) - Import refactoring
- [x] Web Layer (UI Components) - Form validation updates

### Architecture Principles Verified
- [x] Separation of Concerns maintained - Types are now a dedicated concern
- [x] No cross-layer dependencies - Types package is foundational
- [x] Proper dependency injection - No changes to DI patterns
- [x] Database transactions handled correctly - No transaction changes
- [x] Error handling at appropriate layers - No error handling changes

### Alignment with `/docs/ARCHITECTURE.md`
The architecture document emphasizes:
1. **TRPC Type Inference**: The document specifically calls out using `RouterOutputs` and `RouterInputs` for type safety. The new `@glapi/types` package will provide the underlying Zod schemas that feed into these inferred types.
2. **Zod Validation**: Zod is used throughout for runtime validation. Centralizing schemas ensures consistency.
3. **Monorepo Import Guidelines**: Package imports must use package names, not relative paths. This plan follows that pattern.

---

## Current State Analysis

### Type Duplication Identified

| Type Category | api-service Location | trpc Location | Duplication |
|---------------|---------------------|---------------|-------------|
| Time Entries | `types/time-entries.types.ts` | `routers/time-entries.ts` | **Full duplicate** |
| Projects | `types/` (missing) | `routers/projects.ts` | trpc only |
| Customers | `types/customer.types.ts` | `routers/customers.ts` | Partial |
| Invoices | `types/` (missing) | `routers/invoices.ts` | trpc only |
| Items | `types/items.types.ts` | `routers/items.ts` | Partial |
| Common (Address, Pagination) | `types/common.types.ts` | Inline in routers | Partial |

### Files to Migrate

**From `packages/api-service/src/types/`** (30 files):
- `common.types.ts` - Base types (Address, Pagination, ServiceContext)
- `organization.types.ts`
- `customer.types.ts`
- `user.types.ts`
- `subsidiary.types.ts`
- `accounting-dimensions.ts`
- `gl-transactions.types.ts`
- `account.types.ts`
- `items.types.ts`
- `accounting-periods.types.ts`
- `rbac.types.ts`
- `project-cost-codes.types.ts`
- `project-budgets.types.ts`
- `project-expenses.types.ts`
- `project-reporting.types.ts`
- `time-entries.types.ts`
- `sov.types.ts`
- `pay-applications.types.ts`
- `sales-orders.types.ts`
- `close-management.types.ts`
- `financial-statements.types.ts`
- `customer-payments.types.ts`
- `procure-to-pay.types.ts`
- `metrics.types.ts`
- `connector.types.ts`
- `bank-feed.types.ts`
- `payroll.types.ts`
- `crm.types.ts`
- `import.types.ts`

**From `packages/trpc/src/routers/`** (schemas to extract):
- Time entry schemas
- Project schemas
- Customer schemas
- Invoice schemas
- Item schemas
- Various other inline schemas

---

## Package Structure

```
packages/types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main barrel export
│   ├── common/
│   │   ├── index.ts
│   │   ├── pagination.ts           # PaginationParams, PaginatedResult
│   │   ├── address.ts              # Address schema
│   │   ├── service-context.ts      # ServiceContext interface
│   │   └── errors.ts               # ApiError, ServiceError
│   ├── entities/
│   │   ├── index.ts
│   │   ├── organization.ts
│   │   ├── customer.ts
│   │   ├── vendor.ts
│   │   ├── employee.ts
│   │   ├── user.ts
│   │   └── contact.ts
│   ├── accounting/
│   │   ├── index.ts
│   │   ├── subsidiary.ts
│   │   ├── department.ts
│   │   ├── location.ts
│   │   ├── class.ts
│   │   ├── account.ts
│   │   ├── accounting-period.ts
│   │   └── gl-transaction.ts
│   ├── items/
│   │   ├── index.ts
│   │   ├── item.ts
│   │   ├── item-category.ts
│   │   ├── unit-of-measure.ts
│   │   ├── pricing.ts
│   │   ├── vendor-item.ts
│   │   ├── inventory-tracking.ts
│   │   └── assembly-kit.ts
│   ├── projects/
│   │   ├── index.ts
│   │   ├── project.ts
│   │   ├── project-budget.ts
│   │   ├── project-cost-code.ts
│   │   ├── project-expense.ts
│   │   └── project-reporting.ts
│   ├── time-tracking/
│   │   ├── index.ts
│   │   ├── time-entry.ts
│   │   ├── labor-cost-rate.ts
│   │   └── employee-assignment.ts
│   ├── transactions/
│   │   ├── index.ts
│   │   ├── invoice.ts
│   │   ├── payment.ts
│   │   ├── sales-order.ts
│   │   └── pay-application.ts
│   ├── revenue/
│   │   ├── index.ts
│   │   ├── subscription.ts
│   │   ├── billing-schedule.ts
│   │   ├── schedule-of-values.ts
│   │   └── close-management.ts
│   ├── integrations/
│   │   ├── index.ts
│   │   ├── connector.ts
│   │   ├── bank-feed.ts
│   │   ├── payroll.ts
│   │   ├── crm.ts
│   │   └── import.ts
│   └── reporting/
│       ├── index.ts
│       ├── metrics.ts
│       ├── financial-statements.ts
│       └── wip-reporting.ts
└── tests/
    ├── common.test.ts
    ├── entities.test.ts
    └── ...
```

---

## Task Breakdown Summary

| Phase | Task ID | Task Name | Est. Hours | Dependencies |
|-------|---------|-----------|------------|--------------|
| 1 | TYPES-001 | Create `@glapi/types` package skeleton | 2h | None |
| 1 | TYPES-002 | Migrate common types (pagination, address, errors) | 3h | TYPES-001 |
| 1 | TYPES-003 | Migrate entity types (customer, vendor, employee) | 3h | TYPES-002 |
| 1 | TYPES-004 | Migrate accounting dimension types | 3h | TYPES-002 |
| 2 | TYPES-005 | Migrate items & inventory types | 4h | TYPES-002 |
| 2 | TYPES-006 | Migrate project & time tracking types | 4h | TYPES-002 |
| 2 | TYPES-007 | Migrate transaction types (invoice, payment) | 3h | TYPES-002 |
| 2 | TYPES-008 | Migrate revenue & subscription types | 3h | TYPES-002 |
| 2 | TYPES-009 | Migrate integration & reporting types | 3h | TYPES-002 |
| 3 | TYPES-010 | Refactor `@glapi/trpc` to use `@glapi/types` | 6h | TYPES-002 to TYPES-009 |
| 3 | TYPES-011 | Refactor `@glapi/api-service` to use `@glapi/types` | 4h | TYPES-002 to TYPES-009 |
| 3 | TYPES-012 | Update `apps/web` form validation | 4h | TYPES-010, TYPES-011 |
| 4 | TYPES-013 | Update architecture documentation | 2h | TYPES-010 to TYPES-012 |
| 4 | TYPES-014 | Create type package unit tests | 3h | TYPES-002 to TYPES-009 |
| 5 | TEST-001 | Create time entry integration tests | 4h | TYPES-010 |
| 5 | TEST-002 | Create time entry approval workflow tests | 4h | TEST-001 |
| 5 | TEST-003 | Create project assignment integration tests | 4h | TYPES-010 |
| 5 | TEST-004 | Create client-to-cash cycle integration tests | 6h | TEST-001 to TEST-003 |

**Total Estimated Hours**: ~62 hours (8-10 days at focused work)

---

## Git Strategy

### Branch Name
```
feature/types-centralization
```

### Commit Structure
1. `feat(types): create @glapi/types package skeleton`
2. `feat(types): add common types (pagination, address, errors)`
3. `feat(types): add entity types (customer, vendor, employee)`
4. `feat(types): add accounting dimension types`
5. `feat(types): add items and inventory types`
6. `feat(types): add project and time tracking types`
7. `feat(types): add transaction types`
8. `feat(types): add revenue and subscription types`
9. `feat(types): add integration and reporting types`
10. `refactor(trpc): use @glapi/types for schema definitions`
11. `refactor(api-service): use @glapi/types for type definitions`
12. `refactor(web): update form validation to use @glapi/types`
13. `docs: update ARCHITECTURE.md with types package`
14. `test(types): add unit tests for type package`
15. `test(integration): add time entry flow tests`
16. `test(integration): add time entry approval workflow tests`
17. `test(integration): add project assignment tests`
18. `test(integration): add client-to-cash cycle tests`

---

## Risk Assessment

### High Risk
1. **Breaking Changes During Migration**
   - *Mitigation*: Migrate in phases, maintain backward compatibility with re-exports
   - *Rollback*: Git revert to previous commit

2. **Type Mismatches**
   - *Mitigation*: Run `pnpm type-check` after each migration step
   - *Detection*: CI will catch type errors

### Medium Risk
1. **Build Order Issues**
   - *Mitigation*: Update `turbo.json` to build types package first
   - *Verification*: Test full build pipeline

2. **Runtime Validation Differences**
   - *Mitigation*: Ensure exact schema parity, add schema tests
   - *Detection*: Integration tests

### Low Risk
1. **Import Path Confusion**
   - *Mitigation*: Clear documentation, ESLint rules
   - *Detection*: Code review

---

## Alternative Approaches Considered

### Option A: Extend RouterOutputs/RouterInputs (Not Chosen)
- Pros: Less work, uses existing pattern
- Cons: Doesn't solve Zod schema duplication, limits form validation

### Option B: Monolithic Types File (Not Chosen)
- Pros: Simple structure
- Cons: Poor maintainability, large file, no logical grouping

### Option C: Domain-Driven Types Package (Chosen)
- Pros: Clear organization, scalable, follows DDD principles
- Cons: More initial setup

---

## Success Criteria

1. **Zero type duplication** between packages
2. **All existing tests pass** after migration
3. **Type-check passes** across all packages
4. **Build time** not increased significantly
5. **Documentation** updated and accurate
6. **Integration tests** cover critical flows:
   - Time entry creation: frontend to database
   - Time entry approval workflow: submit -> approve/reject -> post
   - Project assignment flow
   - Full client-to-cash cycle

---

## Next Steps

1. Review this plan with stakeholders
2. Begin with Phase 1: Package skeleton and common types
3. Iterate through phases with PR reviews at each phase boundary
4. Final documentation and testing

---

*Created: 2025-01-22*
*Author: Claude Code Planning Agent*
*Status: Draft - Pending Review*
