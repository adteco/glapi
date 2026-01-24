# Phase 4: TRPC Router

## Overview
Create the `financialStatements` TRPC router to expose financial statement generation, export, and saved configuration endpoints with proper authentication and input validation.

---

## Task 4.1: Create Financial Statements TRPC Router

**Description**: Create a new TRPC router for financial statement generation with procedures for Balance Sheet, Income Statement, and Cash Flow Statement.

**Layer**: TRPC (`@glapi/trpc`)

**Estimated Time**: 3 hours

**File**: `/Users/fredpope/Development/glapi/packages/trpc/src/routers/financial-statements.ts`

### Acceptance Criteria
- [ ] Create `financialStatementsRouter` with procedures for each statement type
- [ ] Use Zod schemas from `@glapi/types` for input validation
- [ ] Use `authenticatedProcedure` for all endpoints
- [ ] Include proper error handling with TRPCError
- [ ] Add procedures for: `balanceSheet`, `incomeStatement`, `cashFlowStatement`
- [ ] Add `export` procedure for PDF/Excel generation

### TDD Test Cases

```typescript
// packages/trpc/src/routers/__tests__/financial-statements.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCallerFactory } from '../../trpc';
import { financialStatementsRouter } from '../financial-statements';
import { FinancialStatementsService } from '@glapi/api-service';

vi.mock('@glapi/api-service');

describe('Financial Statements Router', () => {
  const createCaller = createCallerFactory(financialStatementsRouter);
  let caller: ReturnType<typeof createCaller>;

  const mockContext = {
    serviceContext: {
      organizationId: 'org-123',
      userId: 'user-123',
    },
    user: { id: 'user-123' },
  };

  beforeEach(() => {
    caller = createCaller(mockContext);
    vi.clearAllMocks();
  });

  describe('balanceSheet', () => {
    it('should generate balance sheet with valid input', async () => {
      const mockBalanceSheet = {
        reportName: 'Balance Sheet',
        totalAssets: 100000,
        totalLiabilities: 40000,
        totalEquity: 60000,
        balanceCheck: 0,
      };

      vi.mocked(FinancialStatementsService.prototype.generateBalanceSheet)
        .mockResolvedValue(mockBalanceSheet);

      const result = await caller.balanceSheet({
        periodId: 'period-123',
      });

      expect(result).toEqual(mockBalanceSheet);
    });

    it('should pass dimension filters to service', async () => {
      await caller.balanceSheet({
        periodId: 'period-123',
        subsidiaryId: 'sub-1',
        departmentIds: ['dept-1', 'dept-2'],
        classIds: ['class-1'],
      });

      expect(FinancialStatementsService.prototype.generateBalanceSheet)
        .toHaveBeenCalledWith(expect.objectContaining({
          periodId: 'period-123',
          subsidiaryId: 'sub-1',
          departmentIds: ['dept-1', 'dept-2'],
          classIds: ['class-1'],
        }));
    });

    it('should reject invalid periodId', async () => {
      await expect(
        caller.balanceSheet({ periodId: 'not-a-uuid' })
      ).rejects.toThrow();
    });

    it('should handle service errors', async () => {
      vi.mocked(FinancialStatementsService.prototype.generateBalanceSheet)
        .mockRejectedValue(new Error('Database error'));

      await expect(
        caller.balanceSheet({ periodId: 'period-123' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('incomeStatement', () => {
    it('should generate income statement with valid input', async () => {
      const mockIncomeStatement = {
        reportName: 'Income Statement',
        totalRevenue: 100000,
        grossProfit: 60000,
        netIncome: 25000,
      };

      vi.mocked(FinancialStatementsService.prototype.generateIncomeStatement)
        .mockResolvedValue(mockIncomeStatement);

      const result = await caller.incomeStatement({
        periodId: 'period-123',
        showMargins: true,
      });

      expect(result).toEqual(mockIncomeStatement);
    });

    it('should support prior period comparison', async () => {
      await caller.incomeStatement({
        periodId: 'period-123',
        comparePeriodId: 'period-122',
        showVariance: true,
      });

      expect(FinancialStatementsService.prototype.generateIncomeStatement)
        .toHaveBeenCalledWith(expect.objectContaining({
          comparePeriodId: 'period-122',
          showVariance: true,
        }));
    });
  });

  describe('cashFlowStatement', () => {
    it('should generate cash flow statement with indirect method', async () => {
      const mockCashFlow = {
        reportName: 'Statement of Cash Flows',
        netCashFromOperations: 30000,
        netCashFromInvesting: -10000,
        netCashFromFinancing: -5000,
        netChangeInCash: 15000,
      };

      vi.mocked(FinancialStatementsService.prototype.generateCashFlowStatement)
        .mockResolvedValue(mockCashFlow);

      const result = await caller.cashFlowStatement({
        periodId: 'period-123',
        method: 'INDIRECT',
      });

      expect(result).toEqual(mockCashFlow);
    });

    it('should default to indirect method', async () => {
      await caller.cashFlowStatement({
        periodId: 'period-123',
      });

      expect(FinancialStatementsService.prototype.generateCashFlowStatement)
        .toHaveBeenCalledWith(expect.objectContaining({
          method: 'INDIRECT',
        }));
    });
  });

  describe('export', () => {
    it('should export balance sheet to PDF', async () => {
      const mockExport = {
        buffer: Buffer.from('pdf content'),
        contentType: 'application/pdf',
        filename: 'balance-sheet-2024-01-31.pdf',
      };

      vi.mocked(FinancialStatementsService.prototype.exportReport)
        .mockResolvedValue(mockExport);

      const result = await caller.export({
        reportType: 'BALANCE_SHEET',
        periodId: 'period-123',
        format: 'pdf',
      });

      expect(result.contentType).toBe('application/pdf');
    });

    it('should export to Excel format', async () => {
      const mockExport = {
        buffer: Buffer.from('excel content'),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'income-statement-2024-01-31.xlsx',
      };

      vi.mocked(FinancialStatementsService.prototype.exportReport)
        .mockResolvedValue(mockExport);

      const result = await caller.export({
        reportType: 'INCOME_STATEMENT',
        periodId: 'period-123',
        format: 'xlsx',
      });

      expect(result.contentType).toContain('spreadsheet');
    });
  });
});
```

### Implementation

```typescript
// packages/trpc/src/routers/financial-statements.ts

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { authenticatedProcedure, router } from '../trpc';
import { FinancialStatementsService } from '@glapi/api-service';
import {
  balanceSheetInputSchema,
  incomeStatementInputSchema,
  cashFlowStatementInputSchema,
  reportExportOptionsSchema,
  financialStatementFiltersSchema,
} from '@glapi/types';

const exportInputSchema = z.object({
  reportType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW']),
}).merge(financialStatementFiltersSchema).merge(reportExportOptionsSchema);

export const financialStatementsRouter = router({
  /**
   * Generate a Balance Sheet
   */
  balanceSheet: authenticatedProcedure
    .input(balanceSheetInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const service = new FinancialStatementsService(ctx.serviceContext);
        return await service.generateBalanceSheet({
          organizationId: ctx.serviceContext.organizationId,
          ...input,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Organization mismatch') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate balance sheet',
        });
      }
    }),

  /**
   * Generate an Income Statement
   */
  incomeStatement: authenticatedProcedure
    .input(incomeStatementInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const service = new FinancialStatementsService(ctx.serviceContext);
        return await service.generateIncomeStatement({
          organizationId: ctx.serviceContext.organizationId,
          ...input,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate income statement',
        });
      }
    }),

  /**
   * Generate a Cash Flow Statement
   */
  cashFlowStatement: authenticatedProcedure
    .input(cashFlowStatementInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const service = new FinancialStatementsService(ctx.serviceContext);
        return await service.generateCashFlowStatement({
          organizationId: ctx.serviceContext.organizationId,
          ...input,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('reconciliation')) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Cash flow reconciliation failed. Please verify GL balances.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate cash flow statement',
        });
      }
    }),

  /**
   * Export a financial statement to PDF/Excel
   */
  export: authenticatedProcedure
    .input(exportInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new FinancialStatementsService(ctx.serviceContext);

        // Generate the report first
        let reportData;
        switch (input.reportType) {
          case 'BALANCE_SHEET':
            reportData = await service.generateBalanceSheet({
              organizationId: ctx.serviceContext.organizationId,
              periodId: input.periodId,
              subsidiaryId: input.subsidiaryId,
              departmentIds: input.departmentIds,
              classIds: input.classIds,
              locationIds: input.locationIds,
              comparePeriodId: input.includeComparison ? input.comparePeriodId : undefined,
            });
            break;
          case 'INCOME_STATEMENT':
            reportData = await service.generateIncomeStatement({
              organizationId: ctx.serviceContext.organizationId,
              periodId: input.periodId,
              subsidiaryId: input.subsidiaryId,
              departmentIds: input.departmentIds,
              classIds: input.classIds,
              locationIds: input.locationIds,
              comparePeriodId: input.includeComparison ? input.comparePeriodId : undefined,
            });
            break;
          case 'CASH_FLOW':
            reportData = await service.generateCashFlowStatement({
              organizationId: ctx.serviceContext.organizationId,
              periodId: input.periodId,
              subsidiaryId: input.subsidiaryId,
            });
            break;
        }

        // Export to requested format
        const exportResult = await service.exportReport(
          input.reportType,
          reportData,
          {
            format: input.format,
            includeComparison: input.includeComparison,
            includeNotes: input.includeNotes,
            includeLogo: input.includeLogo,
            landscape: input.landscape,
          }
        );

        return {
          buffer: exportResult.buffer.toString('base64'), // Encode for JSON transport
          contentType: exportResult.contentType,
          filename: exportResult.filename,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to export report',
        });
      }
    }),
});
```

---

## Task 4.2: Create Saved Report Configurations Router

**Description**: Create TRPC router for managing saved report configurations.

**Layer**: TRPC (`@glapi/trpc`)

**Estimated Time**: 2 hours

**File**: `/Users/fredpope/Development/glapi/packages/trpc/src/routers/saved-report-configs.ts`

### Acceptance Criteria
- [ ] Add `list`, `get`, `create`, `update`, `delete` procedures
- [ ] Add `setDefault` procedure
- [ ] Ensure user can only access their own configs
- [ ] Validate unique name constraint

### TDD Test Cases

```typescript
describe('Saved Report Configs Router', () => {
  describe('list', () => {
    it('should return configs for current user only', async () => {
      const result = await caller.list({ reportType: 'BALANCE_SHEET' });

      expect(Array.isArray(result)).toBe(true);
      result.forEach(config => {
        expect(config.userId).toBe('user-123');
      });
    });
  });

  describe('create', () => {
    it('should create a new saved config', async () => {
      const result = await caller.create({
        name: 'Monthly Balance Sheet',
        reportType: 'BALANCE_SHEET',
        filters: { periodId: 'period-123' },
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Monthly Balance Sheet');
    });

    it('should reject duplicate names', async () => {
      await caller.create({
        name: 'Duplicate Name',
        reportType: 'BALANCE_SHEET',
        filters: {},
      });

      await expect(
        caller.create({
          name: 'Duplicate Name',
          reportType: 'INCOME_STATEMENT',
          filters: {},
        })
      ).rejects.toThrow();
    });
  });

  describe('setDefault', () => {
    it('should set config as default', async () => {
      await caller.setDefault({ id: 'config-123' });

      const config = await caller.get({ id: 'config-123' });
      expect(config.isDefault).toBe(true);
    });

    it('should unset other defaults for same report type', async () => {
      // Create two configs
      const config1 = await caller.create({
        name: 'Config 1',
        reportType: 'BALANCE_SHEET',
        filters: {},
        isDefault: true,
      });

      const config2 = await caller.create({
        name: 'Config 2',
        reportType: 'BALANCE_SHEET',
        filters: {},
      });

      // Set config2 as default
      await caller.setDefault({ id: config2.id });

      // Config1 should no longer be default
      const updated1 = await caller.get({ id: config1.id });
      expect(updated1.isDefault).toBe(false);
    });
  });
});
```

### Implementation

```typescript
// packages/trpc/src/routers/saved-report-configs.ts

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { authenticatedProcedure, router } from '../trpc';
import { savedReportConfigSchema, uuidSchema } from '@glapi/types';
import { savedReportConfigsRepository } from '@glapi/database';

export const savedReportConfigsRouter = router({
  /**
   * List saved report configurations for current user
   */
  list: authenticatedProcedure
    .input(
      z.object({
        reportType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW']).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return savedReportConfigsRepository.findByUser(
        ctx.serviceContext.organizationId,
        ctx.serviceContext.userId,
        input?.reportType
      );
    }),

  /**
   * Get a specific saved configuration
   */
  get: authenticatedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const config = await savedReportConfigsRepository.findById(input.id);

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved configuration not found',
        });
      }

      // Verify ownership
      if (config.userId !== ctx.serviceContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return config;
    }),

  /**
   * Create a new saved configuration
   */
  create: authenticatedProcedure
    .input(savedReportConfigSchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await savedReportConfigsRepository.create({
          ...input,
          organizationId: ctx.serviceContext.organizationId,
          userId: ctx.serviceContext.userId,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A configuration with this name already exists',
          });
        }
        throw error;
      }
    }),

  /**
   * Update a saved configuration
   */
  update: authenticatedProcedure
    .input(
      z.object({
        id: uuidSchema,
        data: savedReportConfigSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await savedReportConfigsRepository.findById(input.id);

      if (!existing || existing.userId !== ctx.serviceContext.userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Configuration not found',
        });
      }

      return savedReportConfigsRepository.update(input.id, input.data);
    }),

  /**
   * Delete a saved configuration
   */
  delete: authenticatedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await savedReportConfigsRepository.findById(input.id);

      if (!existing || existing.userId !== ctx.serviceContext.userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Configuration not found',
        });
      }

      await savedReportConfigsRepository.delete(input.id);
      return { success: true };
    }),

  /**
   * Set a configuration as the default for its report type
   */
  setDefault: authenticatedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await savedReportConfigsRepository.findById(input.id);

      if (!existing || existing.userId !== ctx.serviceContext.userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Configuration not found',
        });
      }

      return savedReportConfigsRepository.setDefault(
        input.id,
        ctx.serviceContext.organizationId,
        ctx.serviceContext.userId
      );
    }),
});
```

---

## Task 4.3: Register Routers in App Router

**Description**: Add the new routers to the main app router and export types.

**Layer**: TRPC (`@glapi/trpc`)

**Estimated Time**: 1 hour

**File**: `/Users/fredpope/Development/glapi/packages/trpc/src/routers/index.ts`

### Acceptance Criteria
- [ ] Export `financialStatementsRouter` from index
- [ ] Export `savedReportConfigsRouter` from index
- [ ] Add to app router in main TRPC setup
- [ ] Verify types are correctly exported for RouterOutputs/RouterInputs

### Implementation

```typescript
// packages/trpc/src/routers/index.ts - ADD these exports

export * from './financial-statements';
export * from './saved-report-configs';
```

```typescript
// packages/trpc/src/root.ts - ADD to app router

import { financialStatementsRouter } from './routers/financial-statements';
import { savedReportConfigsRouter } from './routers/saved-report-configs';

export const appRouter = router({
  // ... existing routers
  financialStatements: financialStatementsRouter,
  savedReportConfigs: savedReportConfigsRouter,
});
```

---

## Commit Message

```
feat(trpc): add financialStatements router

- Add balanceSheet, incomeStatement, cashFlowStatement queries
- Add export mutation for PDF/Excel generation
- Add savedReportConfigs router for user preferences
- Use Zod schemas from @glapi/types for validation
- Include user ownership validation for saved configs
- Add comprehensive router tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
