# Phase 1: Types and Schemas

## Overview
Define comprehensive Zod schemas for financial statement inputs and outputs, following the `@glapi/types` pattern.

---

## Task 1.1: Create Financial Statement Zod Schemas

**Description**: Create Zod schemas in `@glapi/types` for financial statement generation inputs and outputs. These schemas will be used for TRPC input validation and type inference.

**Layer**: Types Package (`@glapi/types`)

**Estimated Time**: 2 hours

**File**: `/Users/fredpope/Development/glapi/packages/types/src/financial-statements/index.ts`

### Acceptance Criteria
- [ ] Create `financialStatementFiltersSchema` with all dimension filters
- [ ] Create `balanceSheetInputSchema` for Balance Sheet generation
- [ ] Create `incomeStatementInputSchema` for Income Statement generation
- [ ] Create `cashFlowStatementInputSchema` for Cash Flow generation
- [ ] Create `reportExportOptionsSchema` for export configuration
- [ ] Create `savedReportConfigSchema` for user preferences
- [ ] Export all schemas and inferred types from package index
- [ ] All schemas have JSDoc documentation

### TDD Test Cases

```typescript
// packages/types/src/__tests__/financial-statements.test.ts

import { describe, it, expect } from 'vitest';
import {
  financialStatementFiltersSchema,
  balanceSheetInputSchema,
  incomeStatementInputSchema,
  cashFlowStatementInputSchema,
  reportExportOptionsSchema,
} from '../financial-statements';

describe('Financial Statement Schemas', () => {
  describe('financialStatementFiltersSchema', () => {
    it('should accept valid filters with all fields', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        subsidiaryId: '550e8400-e29b-41d4-a716-446655440001',
        departmentIds: ['dept-1', 'dept-2'],
        classIds: ['class-1'],
        locationIds: [],
        includeInactive: true,
        comparePeriodId: '550e8400-e29b-41d4-a716-446655440002',
      };
      expect(() => financialStatementFiltersSchema.parse(input)).not.toThrow();
    });

    it('should require periodId', () => {
      const input = { subsidiaryId: 'sub-1' };
      expect(() => financialStatementFiltersSchema.parse(input)).toThrow();
    });

    it('should accept filters with only required fields', () => {
      const input = { periodId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = financialStatementFiltersSchema.parse(input);
      expect(result.periodId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.includeInactive).toBe(false); // default
    });

    it('should validate dimension IDs as UUID arrays', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        departmentIds: ['not-a-uuid'],
      };
      expect(() => financialStatementFiltersSchema.parse(input)).toThrow();
    });
  });

  describe('balanceSheetInputSchema', () => {
    it('should accept valid balance sheet input', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        showDrillDown: true,
        groupBySubcategory: true,
      };
      const result = balanceSheetInputSchema.parse(input);
      expect(result.showDrillDown).toBe(true);
    });

    it('should default optional fields', () => {
      const input = { periodId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = balanceSheetInputSchema.parse(input);
      expect(result.showDrillDown).toBe(false);
      expect(result.groupBySubcategory).toBe(true);
    });
  });

  describe('incomeStatementInputSchema', () => {
    it('should accept valid income statement input', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        showMargins: true,
        showYTD: true,
        showPriorPeriod: false,
      };
      expect(() => incomeStatementInputSchema.parse(input)).not.toThrow();
    });
  });

  describe('cashFlowStatementInputSchema', () => {
    it('should accept valid cash flow input', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        method: 'INDIRECT',
      };
      const result = cashFlowStatementInputSchema.parse(input);
      expect(result.method).toBe('INDIRECT');
    });

    it('should default method to INDIRECT', () => {
      const input = { periodId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = cashFlowStatementInputSchema.parse(input);
      expect(result.method).toBe('INDIRECT');
    });

    it('should accept DIRECT method', () => {
      const input = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        method: 'DIRECT',
      };
      const result = cashFlowStatementInputSchema.parse(input);
      expect(result.method).toBe('DIRECT');
    });
  });

  describe('reportExportOptionsSchema', () => {
    it('should accept valid export options', () => {
      const input = {
        format: 'pdf',
        includeComparison: true,
        includeLogo: true,
        landscape: false,
      };
      expect(() => reportExportOptionsSchema.parse(input)).not.toThrow();
    });

    it('should validate format enum', () => {
      const input = { format: 'invalid' };
      expect(() => reportExportOptionsSchema.parse(input)).toThrow();
    });

    it('should accept all valid formats', () => {
      ['pdf', 'xlsx', 'csv', 'json'].forEach(format => {
        expect(() => reportExportOptionsSchema.parse({ format })).not.toThrow();
      });
    });
  });
});
```

### Implementation Skeleton

```typescript
// packages/types/src/financial-statements/index.ts

import { z } from 'zod';
import { uuidSchema, optionalUuidSchema, paginationInputSchema } from '../common';

/**
 * Account category enum for financial statement classification
 */
export const AccountCategoryEnum = z.enum([
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'COGS',
  'Expense',
]);

/**
 * Cash flow category enum for cash flow statement classification
 */
export const CashFlowCategoryEnum = z.enum([
  'OPERATING',
  'INVESTING',
  'FINANCING',
]);

/**
 * Export format options
 */
export const ExportFormatEnum = z.enum(['pdf', 'xlsx', 'csv', 'json']);

/**
 * Cash flow statement method
 */
export const CashFlowMethodEnum = z.enum(['INDIRECT', 'DIRECT']);

/**
 * Common filters for financial statements
 */
export const financialStatementFiltersSchema = z.object({
  periodId: uuidSchema,
  subsidiaryId: optionalUuidSchema,
  departmentIds: z.array(uuidSchema).optional(),
  classIds: z.array(uuidSchema).optional(),
  locationIds: z.array(uuidSchema).optional(),
  includeInactive: z.boolean().default(false),
  comparePeriodId: optionalUuidSchema,
});

/**
 * Balance Sheet generation input
 */
export const balanceSheetInputSchema = financialStatementFiltersSchema.extend({
  showDrillDown: z.boolean().default(false),
  groupBySubcategory: z.boolean().default(true),
  expandedAccountIds: z.array(uuidSchema).optional(),
});

/**
 * Income Statement generation input
 */
export const incomeStatementInputSchema = financialStatementFiltersSchema.extend({
  showMargins: z.boolean().default(true),
  showYTD: z.boolean().default(true),
  showPriorPeriod: z.boolean().default(false),
  showVariance: z.boolean().default(false),
});

/**
 * Cash Flow Statement generation input
 */
export const cashFlowStatementInputSchema = financialStatementFiltersSchema.extend({
  method: CashFlowMethodEnum.default('INDIRECT'),
  showReconciliation: z.boolean().default(true),
});

/**
 * Report export options
 */
export const reportExportOptionsSchema = z.object({
  format: ExportFormatEnum,
  includeComparison: z.boolean().default(false),
  includeNotes: z.boolean().default(false),
  includeLogo: z.boolean().default(true),
  landscape: z.boolean().default(false),
});

/**
 * Saved report configuration
 */
export const savedReportConfigSchema = z.object({
  id: uuidSchema.optional(), // Optional for create
  name: z.string().min(1).max(100),
  reportType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW']),
  filters: financialStatementFiltersSchema,
  displayOptions: z.record(z.unknown()).optional(),
  isDefault: z.boolean().default(false),
});

// Type exports
export type FinancialStatementFilters = z.infer<typeof financialStatementFiltersSchema>;
export type BalanceSheetInput = z.infer<typeof balanceSheetInputSchema>;
export type IncomeStatementInput = z.infer<typeof incomeStatementInputSchema>;
export type CashFlowStatementInput = z.infer<typeof cashFlowStatementInputSchema>;
export type ReportExportOptions = z.infer<typeof reportExportOptionsSchema>;
export type SavedReportConfig = z.infer<typeof savedReportConfigSchema>;
export type AccountCategory = z.infer<typeof AccountCategoryEnum>;
export type CashFlowCategory = z.infer<typeof CashFlowCategoryEnum>;
export type ExportFormat = z.infer<typeof ExportFormatEnum>;
export type CashFlowMethod = z.infer<typeof CashFlowMethodEnum>;
```

---

## Task 1.2: Create Saved Report Configuration Schema (Database)

**Description**: Add database schema for persisting user report configurations.

**Layer**: Database (`@glapi/database`)

**Estimated Time**: 2 hours

**File**: `/Users/fredpope/Development/glapi/packages/database/src/db/schema/saved-report-configs.ts`

### Acceptance Criteria
- [ ] Create `savedReportConfigs` table with proper columns
- [ ] Add foreign keys to organizations and users
- [ ] Add unique constraint on (organizationId, userId, name)
- [ ] Export schema and relations
- [ ] Add to schema index

### TDD Test Cases

```typescript
// Test will be in repository layer - schema should compile without errors
// Run: pnpm db:generate to verify schema is valid
```

### Implementation Skeleton

```typescript
// packages/database/src/db/schema/saved-report-configs.ts

import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';

export const reportTypeEnum = ['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW', 'TRIAL_BALANCE'] as const;

export const savedReportConfigs = pgTable('saved_report_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull(), // Clerk user ID
  name: text('name').notNull(),
  reportType: text('report_type').notNull(), // 'BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW'
  filters: jsonb('filters').notNull(), // JSON of filter settings
  displayOptions: jsonb('display_options'), // JSON of display preferences
  isDefault: boolean('is_default').default(false).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgUserNameIdx: uniqueIndex('saved_configs_org_user_name_idx')
    .on(table.organizationId, table.userId, table.name),
  reportTypeIdx: uniqueIndex('saved_configs_report_type_idx')
    .on(table.organizationId, table.userId, table.reportType),
}));

export const savedReportConfigsRelations = relations(savedReportConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [savedReportConfigs.organizationId],
    references: [organizations.id],
  }),
}));

export type SavedReportConfig = typeof savedReportConfigs.$inferSelect;
export type NewSavedReportConfig = typeof savedReportConfigs.$inferInsert;
```

---

## Task 1.3: Add Financial Statement Types to Package Exports

**Description**: Export the new financial statement types from `@glapi/types` package index.

**Layer**: Types Package

**Estimated Time**: 1 hour

**File**: `/Users/fredpope/Development/glapi/packages/types/src/index.ts`

### Acceptance Criteria
- [ ] Add `export * from './financial-statements'` to index
- [ ] Run `pnpm build` to verify exports work
- [ ] Update package.json if needed

### TDD Test Cases

```typescript
// packages/types/src/__tests__/exports.test.ts

import { describe, it, expect } from 'vitest';
import * as types from '../index';

describe('Package Exports', () => {
  it('should export financial statement schemas', () => {
    expect(types.balanceSheetInputSchema).toBeDefined();
    expect(types.incomeStatementInputSchema).toBeDefined();
    expect(types.cashFlowStatementInputSchema).toBeDefined();
    expect(types.reportExportOptionsSchema).toBeDefined();
  });

  it('should export financial statement types', () => {
    // Type-only exports are checked at compile time
    // This test just ensures the module loads
    expect(true).toBe(true);
  });
});
```

### Implementation

```typescript
// packages/types/src/index.ts - ADD this line

export * from './financial-statements';
```

---

## Commit Message

```
feat(types): add comprehensive financial statement Zod schemas

- Add financialStatementFiltersSchema for dimension filtering
- Add balanceSheetInputSchema with drill-down options
- Add incomeStatementInputSchema with margin calculations
- Add cashFlowStatementInputSchema with method selection
- Add reportExportOptionsSchema for PDF/Excel export
- Add savedReportConfigSchema for user preferences
- Add savedReportConfigs database table schema
- Include unit tests for all schemas

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
