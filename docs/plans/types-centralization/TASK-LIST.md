# Types Centralization - Task List

## Overview

This document provides a quick reference to all tasks in the types centralization initiative.

---

## Phase 1: Foundation (Days 1-2)

| Task ID | Task Name | Est. Hours | Status | Dependencies | Doc Link |
|---------|-----------|------------|--------|--------------|----------|
| TYPES-001 | Create @glapi/types package skeleton | 2h | Pending | None | [TYPES-001](./TYPES-001-package-skeleton.md) |
| TYPES-002 | Migrate common types | 3h | Pending | TYPES-001 | [TYPES-002](./TYPES-002-common-types.md) |
| TYPES-003 | Migrate entity types (customer, vendor) | 3h | Pending | TYPES-002 | Not created |
| TYPES-004 | Migrate accounting dimension types | 3h | Pending | TYPES-002 | Not created |

---

## Phase 2: Domain Types (Days 2-4)

| Task ID | Task Name | Est. Hours | Status | Dependencies | Doc Link |
|---------|-----------|------------|--------|--------------|----------|
| TYPES-005 | Migrate items & inventory types | 4h | Pending | TYPES-002 | Not created |
| TYPES-006 | Migrate project & time tracking types | 4h | Pending | TYPES-002 | [TYPES-006](./TYPES-006-time-tracking-types.md) |
| TYPES-007 | Migrate transaction types | 3h | Pending | TYPES-002 | Not created |
| TYPES-008 | Migrate revenue & subscription types | 3h | Pending | TYPES-002 | Not created |
| TYPES-009 | Migrate integration & reporting types | 3h | Pending | TYPES-002 | Not created |

---

## Phase 3: Refactoring (Days 4-6)

| Task ID | Task Name | Est. Hours | Status | Dependencies | Doc Link |
|---------|-----------|------------|--------|--------------|----------|
| TYPES-010 | Refactor @glapi/trpc | 6h | Pending | TYPES-002 to TYPES-009 | [TYPES-010](./TYPES-010-refactor-trpc.md) |
| TYPES-011 | Refactor @glapi/api-service | 4h | Pending | TYPES-002 to TYPES-009 | Not created |
| TYPES-012 | Update apps/web form validation | 4h | Pending | TYPES-010, TYPES-011 | Not created |

---

## Phase 4: Documentation & Cleanup (Day 6-7)

| Task ID | Task Name | Est. Hours | Status | Dependencies | Doc Link |
|---------|-----------|------------|--------|--------------|----------|
| TYPES-013 | Update ARCHITECTURE.md | 2h | Pending | TYPES-010 to TYPES-012 | Not created |
| TYPES-014 | Create type package unit tests | 3h | Pending | TYPES-002 to TYPES-009 | Not created |

---

## Phase 5: Integration Tests (Days 7-10)

| Task ID | Task Name | Est. Hours | Status | Dependencies | Doc Link |
|---------|-----------|------------|--------|--------------|----------|
| TEST-001 | Time entry integration tests | 4h | Pending | TYPES-010 | [TEST-001](./TEST-001-time-entry-integration.md) |
| TEST-002 | Time entry approval workflow tests | 4h | Pending | TEST-001 | [TEST-002](./TEST-002-approval-workflow.md) |
| TEST-003 | Project assignment tests | 4h | Pending | TYPES-010 | Not created |
| TEST-004 | Client-to-cash cycle tests | 6h | Pending | TEST-001 to TEST-003 | [TEST-004](./TEST-004-client-to-cash.md) |

---

## Dependency Graph

```
TYPES-001 (Package Skeleton)
    │
    └──> TYPES-002 (Common Types)
              │
              ├──> TYPES-003 (Entity Types)
              ├──> TYPES-004 (Accounting Types)
              ├──> TYPES-005 (Items Types)
              ├──> TYPES-006 (Time Tracking Types)
              ├──> TYPES-007 (Transaction Types)
              ├──> TYPES-008 (Revenue Types)
              └──> TYPES-009 (Integration Types)
                        │
                        ├──> TYPES-010 (Refactor TRPC)
                        │         │
                        │         ├──> TYPES-012 (Update Web)
                        │         │
                        │         └──> TEST-001 (Time Entry Tests)
                        │                   │
                        │                   ├──> TEST-002 (Approval Tests)
                        │                   │
                        │                   └──> TEST-003 (Project Tests)
                        │                              │
                        │                              └──> TEST-004 (Client-to-Cash)
                        │
                        └──> TYPES-011 (Refactor API-Service)
                                  │
                                  └──> TYPES-012 (Update Web)
                                            │
                                            └──> TYPES-013 (Documentation)
                                                      │
                                                      └──> TYPES-014 (Unit Tests)
```

---

## Quick Commands

### Start Development
```bash
# Create the types package
mkdir -p packages/types/src
cd packages/types
pnpm init
```

### Verify Changes
```bash
# Type check all packages
pnpm type-check

# Run all tests
pnpm test

# Build all packages
pnpm build
```

### Run Specific Tests
```bash
# Types package tests
pnpm --filter @glapi/types test

# Integration tests
pnpm --filter @glapi/integration-tests test
```

---

## Progress Tracking

### Week 1 Goals
- [ ] Complete Phase 1 (Foundation)
- [ ] Complete Phase 2 (Domain Types)
- [ ] Start Phase 3 (Refactoring)

### Week 2 Goals
- [ ] Complete Phase 3 (Refactoring)
- [ ] Complete Phase 4 (Documentation)
- [ ] Start Phase 5 (Integration Tests)
- [ ] Complete all integration tests

---

## Risk Mitigation Checkpoints

### After Phase 1
- [ ] `@glapi/types` builds successfully
- [ ] Package is recognized by pnpm workspace
- [ ] Can import from other packages

### After Phase 3
- [ ] All TRPC routers use centralized types
- [ ] No type errors across packages
- [ ] Existing tests still pass

### After Phase 5
- [ ] Full client-to-cash flow works
- [ ] All integration tests pass
- [ ] Documentation is complete

---

*Last Updated: 2025-01-22*
