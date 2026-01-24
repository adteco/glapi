# Financial Statements Implementation Plan

## Overview

This plan covers the implementation of three core financial statements:
1. **Balance Sheet** - Statement of Financial Position
2. **Income Statement** - Statement of Operations/Profit & Loss
3. **Cash Flow Statement** - Statement of Cash Flows (Indirect Method)

## Executive Summary

**User Request**: Implement comprehensive financial statement reporting with dimension filtering, period comparison, account hierarchy drill-down, user customization, and export capabilities.

**Scope**:
- Complete backend service layer for financial statement generation
- TRPC router with procedures for each statement type
- Enhanced repository queries for GL aggregation
- React components with TRPC hooks
- PDF/Excel export functionality
- User preference persistence
- E2E Playwright tests

**Excluded from Scope**:
- Direct method cash flow (future enhancement)
- Multi-currency consolidation
- Intercompany eliminations
- Custom report builder

**Estimated Complexity**: Complex
**Estimated Time**: 8-10 development days

## Current State Analysis

### Existing Infrastructure

**Database Schema** (`packages/database/src/db/schema/`):
- `accounts.ts`: Account with `accountCategory`, `accountSubcategory`, `cashFlowCategory`, `financialStatementLine`, `rollupAccountId` (hierarchy)
- `gl-transactions.ts`: `glTransactions` and `glTransactionLines` with dimension columns (`subsidiaryId`, `departmentId`, `classId`, `locationId`)
- `gl-transactions.ts`: `glAccountBalances` - pre-aggregated balances by period/account/dimensions
- `accounting-periods.ts`: Period lifecycle (OPEN, SOFT_CLOSED, CLOSED, LOCKED)

**Service Layer** (`packages/api-service/src/services/`):
- `financial-statements-service.ts`: Basic Income Statement/Balance Sheet generation (calls repository)
- `gl-reporting-service.ts`: Trial balance, account activity, general ledger
- `gl-balance-service.ts`: Fast access to pre-calculated `glAccountBalances`

**Types** (`packages/api-service/src/types/`):
- `financial-statements.types.ts`: Complete type definitions for all three statements

**UI Pages** (`apps/web/src/app/reports/financial/`):
- `balance-sheet/page.tsx`: Working page with options dialog, fetches from `/api/gl/reports/balance-sheet`
- `income-statement/page.tsx`: Working page with options dialog, fetches from `/api/gl/reports/income-statement`
- `cash-flow-statement/page.tsx`: **Mock data only** - needs full implementation

### Gaps Identified

1. **No TRPC Router**: Pages use REST fetch, not TRPC - needs `financialStatements` router
2. **Cash Flow Statement**: No backend implementation - only mock UI
3. **Missing Features**:
   - Account hierarchy drill-down
   - Multi-select dimension filters
   - Saved report configurations
   - PDF/Excel export (only JSON/CSV)
   - Prior period comparison in UI

## Architecture Compliance Check

**Layers Affected**:
- [x] Database Layer (Drizzle/PostgreSQL) - New queries, possible migration
- [x] Service Layer (Business Logic) - Enhanced FinancialStatementsService
- [x] API Layer (TRPC Routers) - New `financialStatements` router
- [x] Web Layer (UI Components) - Enhanced report pages

**Architecture Principles Verified**:
- [x] Separation of Concerns maintained (Repository -> Service -> Router -> UI)
- [x] No cross-layer dependencies (UI uses TRPC, not direct service calls)
- [x] Proper dependency injection (ServiceContext pattern)
- [x] Database transactions handled correctly (read-only for reports)
- [x] Error handling at appropriate layers (ServiceError pattern)
- [x] Multi-tenancy enforced (organizationId in all queries)

## Dependencies & Prerequisites

1. **Existing Routers**: `accounts`, `accountingPeriods`, `subsidiaries`, `departments`, `classes`, `locations`
2. **Database**: `glAccountBalances` table must be populated (via GL posting)
3. **Auth**: Clerk organization context available

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance with large GL datasets | Medium | High | Use pre-aggregated balances, add indexes |
| Inaccurate cash flow categorization | Medium | High | Validate cashFlowCategory on accounts |
| Account hierarchy complexity | Low | Medium | Recursive CTE queries, cache results |
| Export library bundle size | Low | Low | Dynamic imports for PDF/Excel libs |

## Branch & Commit Strategy

**Branch Name**: `feature/financial-statements-complete`

**Commit Structure**:
1. `feat(types): add comprehensive financial statement Zod schemas`
2. `feat(db): add financial statement repository queries`
3. `feat(service): implement CashFlowStatementService`
4. `feat(service): enhance FinancialStatementsService with drill-down`
5. `feat(trpc): add financialStatements router`
6. `test(service): add financial statement service unit tests`
7. `test(trpc): add financial statement router integration tests`
8. `feat(web): implement Balance Sheet with TRPC and drill-down`
9. `feat(web): implement Income Statement with TRPC and margins`
10. `feat(web): implement Cash Flow Statement with TRPC`
11. `feat(web): add dimension filter component with multi-select`
12. `feat(web): add report customization and saved configs`
13. `feat(service): implement PDF/Excel export`
14. `test(e2e): add financial statements Playwright tests`
15. `docs: update API documentation for financial statements`

## Task Summary

| Phase | Task Count | Estimated Hours |
|-------|------------|-----------------|
| Phase 1: Types & Schema | 3 | 6 |
| Phase 2: Repository Layer | 4 | 12 |
| Phase 3: Service Layer | 4 | 16 |
| Phase 4: TRPC Router | 3 | 8 |
| Phase 5: UI Components | 6 | 24 |
| Phase 6: Testing | 4 | 16 |
| Phase 7: Documentation | 2 | 4 |
| **Total** | **26** | **86 hours** |

## File References

**Detailed Task Files**:
- [01-types-and-schemas.md](./01-types-and-schemas.md)
- [02-repository-layer.md](./02-repository-layer.md)
- [03-service-layer.md](./03-service-layer.md)
- [04-trpc-router.md](./04-trpc-router.md)
- [05-ui-components.md](./05-ui-components.md)
- [06-testing.md](./06-testing.md)
- [07-documentation.md](./07-documentation.md)

**Key Existing Files**:
- `/Users/fredpope/Development/glapi/packages/database/src/db/schema/accounts.ts`
- `/Users/fredpope/Development/glapi/packages/database/src/db/schema/gl-transactions.ts`
- `/Users/fredpope/Development/glapi/packages/api-service/src/services/financial-statements-service.ts`
- `/Users/fredpope/Development/glapi/packages/api-service/src/types/financial-statements.types.ts`
- `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/balance-sheet/page.tsx`
- `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/income-statement/page.tsx`
- `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/cash-flow-statement/page.tsx`
