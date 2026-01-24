# Financial Statements - Beads Task List

This document provides a task list suitable for import into the beads issue tracker.
Each task includes dependencies (blockedBy) for proper ordering.

---

## Phase 1: Types & Schema

### bd-fs-001: Create Financial Statement Zod Schemas
- **Priority**: High
- **Estimated Hours**: 2
- **Dependencies**: None
- **Description**: Create Zod schemas in `@glapi/types` for financial statement inputs (balanceSheetInputSchema, incomeStatementInputSchema, cashFlowStatementInputSchema, reportExportOptionsSchema)
- **Acceptance Criteria**:
  - All schemas defined with JSDoc
  - Unit tests passing
  - Types exported from package index
- **Files**: `packages/types/src/financial-statements/index.ts`

### bd-fs-002: Create Saved Report Config Database Schema
- **Priority**: High
- **Estimated Hours**: 2
- **Dependencies**: None
- **Description**: Add database schema for persisting user report configurations
- **Acceptance Criteria**:
  - Table created with proper columns
  - Foreign keys to organizations
  - Unique constraint on (org, user, name)
- **Files**: `packages/database/src/db/schema/saved-report-configs.ts`

### bd-fs-003: Export Types from Package Index
- **Priority**: High
- **Estimated Hours**: 1
- **Dependencies**: bd-fs-001
- **Description**: Export new types from @glapi/types package index
- **Files**: `packages/types/src/index.ts`

---

## Phase 2: Repository Layer

### bd-fs-004: Add Balance Sheet Repository Query
- **Priority**: High
- **Estimated Hours**: 3
- **Dependencies**: bd-fs-003
- **Description**: Add getBalanceSheetData() method that returns categorized account balances with hierarchy support
- **Acceptance Criteria**:
  - Returns assets, liabilities, equity grouped by subcategory
  - Supports dimension filtering
  - Supports prior period comparison
  - Unit tests passing
- **Files**: `packages/database/src/repositories/gl-reporting.repository.ts`

### bd-fs-005: Add Income Statement Repository Query
- **Priority**: High
- **Estimated Hours**: 3
- **Dependencies**: bd-fs-003
- **Description**: Add getIncomeStatementData() method for revenue, COGS, and expense aggregation
- **Acceptance Criteria**:
  - Returns revenue, COGS, operating expenses sections
  - Supports YTD calculations
  - Supports prior period comparison
  - Unit tests passing
- **Files**: `packages/database/src/repositories/gl-reporting.repository.ts`

### bd-fs-006: Add Cash Flow Statement Repository Query
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-003
- **Description**: Add getCashFlowStatementData() method using indirect method
- **Acceptance Criteria**:
  - Calculates net income from P&L
  - Identifies non-cash adjustments
  - Calculates working capital changes
  - Groups by cashFlowCategory
  - Unit tests passing
- **Files**: `packages/database/src/repositories/gl-reporting.repository.ts`

### bd-fs-007: Add Saved Report Configs Repository
- **Priority**: Medium
- **Estimated Hours**: 2
- **Dependencies**: bd-fs-002
- **Description**: Add CRUD operations for saved report configurations
- **Acceptance Criteria**:
  - create, update, delete, findByUser methods
  - setDefault method with unset others logic
  - Unit tests passing
- **Files**: `packages/database/src/repositories/saved-report-configs.repository.ts`

---

## Phase 3: Service Layer

### bd-fs-008: Enhance Balance Sheet Service
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-004
- **Description**: Enhance generateBalanceSheet() with drill-down, working capital, and variance calculations
- **Acceptance Criteria**:
  - Account hierarchy resolution
  - Working capital calculation
  - Balance check validation
  - Prior period variance
  - Unit tests passing (>80% coverage)
- **Files**: `packages/api-service/src/services/financial-statements-service.ts`

### bd-fs-009: Enhance Income Statement Service
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-005
- **Description**: Enhance generateIncomeStatement() with margin calculations and YTD support
- **Acceptance Criteria**:
  - Gross, operating, net margin calculations
  - Handle zero revenue gracefully
  - YTD amounts
  - Prior period variance
  - Unit tests passing
- **Files**: `packages/api-service/src/services/financial-statements-service.ts`

### bd-fs-010: Implement Cash Flow Statement Service
- **Priority**: High
- **Estimated Hours**: 5
- **Dependencies**: bd-fs-006
- **Description**: Create generateCashFlowStatement() with indirect method and reconciliation
- **Acceptance Criteria**:
  - Starts with net income
  - Adds non-cash adjustments
  - Calculates working capital changes
  - Validates cash reconciliation
  - Unit tests passing
- **Files**: `packages/api-service/src/services/financial-statements-service.ts`

### bd-fs-011: Implement Report Export Service
- **Priority**: Medium
- **Estimated Hours**: 3
- **Dependencies**: bd-fs-008, bd-fs-009, bd-fs-010
- **Description**: Create ReportExportService for PDF/Excel/CSV export
- **Acceptance Criteria**:
  - PDF generation with pdfmake
  - Excel generation with exceljs
  - CSV generation
  - Company logo support
  - Unit tests passing
- **Files**: `packages/api-service/src/services/report-export-service.ts`

---

## Phase 4: TRPC Router

### bd-fs-012: Create Financial Statements Router
- **Priority**: High
- **Estimated Hours**: 3
- **Dependencies**: bd-fs-008, bd-fs-009, bd-fs-010
- **Description**: Create TRPC router with procedures for all three statements and export
- **Acceptance Criteria**:
  - balanceSheet, incomeStatement, cashFlowStatement queries
  - export mutation
  - Input validation with Zod schemas
  - Proper error handling
- **Files**: `packages/trpc/src/routers/financial-statements.ts`

### bd-fs-013: Create Saved Report Configs Router
- **Priority**: Medium
- **Estimated Hours**: 2
- **Dependencies**: bd-fs-007
- **Description**: Create TRPC router for saved configuration CRUD
- **Acceptance Criteria**:
  - list, get, create, update, delete procedures
  - setDefault procedure
  - User ownership validation
- **Files**: `packages/trpc/src/routers/saved-report-configs.ts`

### bd-fs-014: Register Routers in App Router
- **Priority**: High
- **Estimated Hours**: 1
- **Dependencies**: bd-fs-012, bd-fs-013
- **Description**: Add new routers to app router and verify type exports
- **Files**: `packages/trpc/src/routers/index.ts`, `packages/trpc/src/root.ts`

---

## Phase 5: UI Components

### bd-fs-015: Create Dimension Filter Component
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-014
- **Description**: Create reusable multi-select dimension filter component
- **Acceptance Criteria**:
  - Multi-select for departments, classes, locations
  - Single select for subsidiary
  - Persist to localStorage
  - Select all / clear all shortcuts
- **Files**: `apps/web/src/components/reports/DimensionFilters.tsx`

### bd-fs-016: Refactor Balance Sheet Page to TRPC
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-015
- **Description**: Update Balance Sheet page to use TRPC with drill-down and filters
- **Acceptance Criteria**:
  - Uses trpc.financialStatements.balanceSheet
  - Account hierarchy drill-down
  - Working capital display
  - Prior period comparison
  - Integration tests passing
- **Files**: `apps/web/src/app/reports/financial/balance-sheet/page.tsx`

### bd-fs-017: Refactor Income Statement Page to TRPC
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-015
- **Description**: Update Income Statement page with TRPC and margins
- **Acceptance Criteria**:
  - Uses trpc.financialStatements.incomeStatement
  - Margin displays
  - YTD column toggle
  - Prior period variance
- **Files**: `apps/web/src/app/reports/financial/income-statement/page.tsx`

### bd-fs-018: Implement Cash Flow Statement Page
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-015
- **Description**: Replace mock data with TRPC query
- **Acceptance Criteria**:
  - Uses trpc.financialStatements.cashFlowStatement
  - Three activity sections
  - Cash reconciliation display
  - Cash flow trend indicator
- **Files**: `apps/web/src/app/reports/financial/cash-flow-statement/page.tsx`

### bd-fs-019: Create Saved Configuration UI
- **Priority**: Medium
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-016, bd-fs-017, bd-fs-018
- **Description**: Add UI for saving and loading report configurations
- **Acceptance Criteria**:
  - SavedConfigsDropdown component
  - SaveConfigDialog component
  - Set default functionality
  - Load default on page mount
- **Files**: `apps/web/src/components/reports/SavedConfigsDropdown.tsx`, `apps/web/src/components/reports/SaveConfigDialog.tsx`

### bd-fs-020: Create Export Dropdown Component
- **Priority**: Medium
- **Estimated Hours**: 3
- **Dependencies**: bd-fs-011, bd-fs-014
- **Description**: Create reusable export dropdown for PDF/Excel/CSV
- **Acceptance Criteria**:
  - Loading state during export
  - File download handling
  - Error handling
- **Files**: `apps/web/src/components/reports/ExportDropdown.tsx`

---

## Phase 6: Testing

### bd-fs-021: Service Layer Unit Tests
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-008, bd-fs-009, bd-fs-010
- **Description**: Complete unit tests for FinancialStatementsService
- **Acceptance Criteria**:
  - >80% code coverage
  - Edge cases covered
  - Error handling tested
- **Files**: `packages/api-service/src/services/__tests__/financial-statements-service.test.ts`

### bd-fs-022: TRPC Router Integration Tests
- **Priority**: High
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-014
- **Description**: Integration tests for financial statements router
- **Acceptance Criteria**:
  - Full request/response flow tested
  - Input validation tested
  - Error responses tested
- **Files**: `packages/trpc/src/routers/__tests__/financial-statements.integration.test.ts`

### bd-fs-023: Playwright E2E Tests
- **Priority**: High
- **Estimated Hours**: 6
- **Dependencies**: bd-fs-016, bd-fs-017, bd-fs-018, bd-fs-019, bd-fs-020
- **Description**: E2E tests for all financial statement pages
- **Acceptance Criteria**:
  - Page load tests
  - Filter interaction tests
  - Drill-down tests
  - Export tests
  - Saved config tests
  - Responsive design tests
- **Files**: `tests/reports/financial-statements.spec.ts`

### bd-fs-024: Repository Layer Unit Tests
- **Priority**: Medium
- **Estimated Hours**: 4
- **Dependencies**: bd-fs-004, bd-fs-005, bd-fs-006, bd-fs-007
- **Description**: Unit tests for GL reporting repository queries
- **Acceptance Criteria**:
  - Data aggregation tested
  - Dimension filtering tested
  - Empty data handling tested
- **Files**: `packages/database/src/repositories/__tests__/gl-reporting.repository.test.ts`

---

## Phase 7: Documentation

### bd-fs-025: API Documentation
- **Priority**: Medium
- **Estimated Hours**: 2
- **Dependencies**: bd-fs-012
- **Description**: Add financial statements to API documentation
- **Acceptance Criteria**:
  - All endpoints documented
  - Request/response examples
  - Error codes documented
- **Files**: `apps/docs/content/api/financial-statements.mdx`

### bd-fs-026: Feature Documentation
- **Priority**: Low
- **Estimated Hours**: 2
- **Dependencies**: bd-fs-025
- **Description**: Update README and create feature documentation
- **Acceptance Criteria**:
  - README features section updated
  - Feature guide created
  - Troubleshooting section
- **Files**: `README.md`, `docs/features/financial-statements.md`

---

## Dependency Graph Summary

```
Phase 1 (Types):
  bd-fs-001 → bd-fs-003
  bd-fs-002 (parallel)

Phase 2 (Repository):
  bd-fs-003 → bd-fs-004, bd-fs-005, bd-fs-006
  bd-fs-002 → bd-fs-007

Phase 3 (Service):
  bd-fs-004 → bd-fs-008
  bd-fs-005 → bd-fs-009
  bd-fs-006 → bd-fs-010
  bd-fs-008, bd-fs-009, bd-fs-010 → bd-fs-011

Phase 4 (TRPC):
  bd-fs-008, bd-fs-009, bd-fs-010 → bd-fs-012
  bd-fs-007 → bd-fs-013
  bd-fs-012, bd-fs-013 → bd-fs-014

Phase 5 (UI):
  bd-fs-014 → bd-fs-015
  bd-fs-015 → bd-fs-016, bd-fs-017, bd-fs-018
  bd-fs-016, bd-fs-017, bd-fs-018 → bd-fs-019
  bd-fs-011, bd-fs-014 → bd-fs-020

Phase 6 (Testing):
  bd-fs-008, bd-fs-009, bd-fs-010 → bd-fs-021
  bd-fs-014 → bd-fs-022
  bd-fs-016, bd-fs-017, bd-fs-018, bd-fs-019, bd-fs-020 → bd-fs-023
  bd-fs-004, bd-fs-005, bd-fs-006, bd-fs-007 → bd-fs-024

Phase 7 (Docs):
  bd-fs-012 → bd-fs-025
  bd-fs-025 → bd-fs-026
```

---

## Critical Path

The minimum path to a working feature:

1. **bd-fs-001** - Zod schemas (2h)
2. **bd-fs-003** - Export types (1h)
3. **bd-fs-004** - Balance Sheet repository (3h)
4. **bd-fs-008** - Balance Sheet service (4h)
5. **bd-fs-012** - TRPC router (3h)
6. **bd-fs-014** - Register router (1h)
7. **bd-fs-015** - Dimension filters (4h)
8. **bd-fs-016** - Balance Sheet page (4h)

**Critical Path Total**: 22 hours (approximately 3 days)

After the critical path, Income Statement and Cash Flow Statement can be done in parallel.
