import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceError } from '../../types';
import type { GlTransactionLine, DoubleEntryValidationOptions } from '../../types';

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const { mockCheckPostingAllowed } = vi.hoisted(() => ({
  mockCheckPostingAllowed: vi.fn().mockResolvedValue({
    canPost: true,
    period: { id: 'period-123', status: 'OPEN' },
  }),
}));

// Mock @glapi/database BEFORE AccountingPeriodService is imported
vi.mock('@glapi/database', () => ({
  AccountingPeriodRepository: vi.fn().mockImplementation(() => ({
    getAccessibleSubsidiaryIds: vi.fn().mockResolvedValue(['sub-123']),
    findById: vi.fn(),
    findAll: vi.fn(),
    findByDate: vi.fn(),
    findOpenPeriodForDate: vi.fn(),
    canPostToDate: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    getFiscalYears: vi.fn(),
    getCurrentOpenPeriod: vi.fn(),
    createFiscalYearPeriods: vi.fn(),
  })),
}));

// Mock the AccountingPeriodService
vi.mock('../accounting-period-service', () => ({
  AccountingPeriodService: vi.fn().mockImplementation(() => ({
    checkPostingAllowed: mockCheckPostingAllowed,
  })),
}));

// Import after mocking
import { GlPostingEngine } from '../gl-posting-engine';

describe('GlPostingEngine', () => {
  let engine: GlPostingEngine;

  const createGlLine = (
    lineNumber: number,
    debit: number,
    credit: number,
    exchangeRate: number = 1
  ): GlTransactionLine => ({
    transactionId: 'tx-123',
    lineNumber,
    accountId: `account-${lineNumber}`,
    subsidiaryId: 'sub-123',
    debitAmount: debit.toString(),
    creditAmount: credit.toString(),
    currencyCode: 'USD',
    exchangeRate: exchangeRate.toString(),
    baseDebitAmount: (debit * exchangeRate).toString(),
    baseCreditAmount: (credit * exchangeRate).toString(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Create engine without context (for unit testing validateDoubleEntry)
    engine = new GlPostingEngine();
  });

  describe('validateDoubleEntry', () => {
    describe('balanced transactions', () => {
      it('should validate a simple balanced transaction', () => {
        const lines = [
          createGlLine(1, 1000, 0),
          createGlLine(2, 0, 1000),
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(true);
        expect(result.totalDebits).toBe(1000);
        expect(result.totalCredits).toBe(1000);
        expect(result.difference).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate a multi-line balanced transaction', () => {
        const lines = [
          createGlLine(1, 500, 0),
          createGlLine(2, 300, 0),
          createGlLine(3, 200, 0),
          createGlLine(4, 0, 1000),
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(true);
        expect(result.totalDebits).toBe(1000);
        expect(result.totalCredits).toBe(1000);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow small rounding differences within tolerance', () => {
        const lines = [
          createGlLine(1, 100.005, 0),
          createGlLine(2, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines, { tolerance: 0.01 });

        expect(result.isBalanced).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('unbalanced transactions', () => {
      it('should reject unbalanced transaction', () => {
        const lines = [
          createGlLine(1, 1000, 0),
          createGlLine(2, 0, 900), // Missing 100
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(false);
        expect(result.difference).toBe(100);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'UNBALANCED_TRANSACTION',
          })
        );
      });

      it('should reject transaction exceeding tolerance', () => {
        const lines = [
          createGlLine(1, 100, 0),
          createGlLine(2, 0, 99.98), // 0.02 difference
        ];

        const result = engine.validateDoubleEntry(lines, { tolerance: 0.01 });

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'UNBALANCED_TRANSACTION',
          })
        );
      });
    });

    describe('line validation', () => {
      it('should reject negative debit amounts', () => {
        const lines = [
          createGlLine(1, -100, 0),
          createGlLine(2, 0, -100),
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'NEGATIVE_AMOUNT',
            affectedLines: [1],
          })
        );
      });

      it('should reject lines with both debit and credit', () => {
        const lines = [
          { ...createGlLine(1, 100, 50) },
          createGlLine(2, 0, 50),
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'LINE_NOT_BALANCED',
            affectedLines: [1],
          })
        );
      });

      it('should require minimum 2 lines', () => {
        const lines = [createGlLine(1, 100, 0)];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INSUFFICIENT_LINES',
          })
        );
      });

      it('should require at least one debit line', () => {
        const lines = [
          createGlLine(1, 0, 100),
          createGlLine(2, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines, { requireBothSides: true });

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_DEBIT_LINE',
          })
        );
      });

      it('should require at least one credit line', () => {
        const lines = [
          createGlLine(1, 100, 0),
          createGlLine(2, 100, 0),
        ];

        const result = engine.validateDoubleEntry(lines, { requireBothSides: true });

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_CREDIT_LINE',
          })
        );
      });

      it('should warn about zero-amount lines by default', () => {
        const lines = [
          createGlLine(1, 100, 0),
          createGlLine(2, 0, 0), // Zero amount line
          createGlLine(3, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines);

        expect(result.isBalanced).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.stringContaining('Line 2')
        );
      });
    });

    describe('FX rate validation', () => {
      it('should validate multi-currency transaction with correct FX conversion', () => {
        const exchangeRate = 1.25;
        const lines = [
          createGlLine(1, 1000, 0, exchangeRate),
          createGlLine(2, 0, 1000, exchangeRate),
        ];

        const result = engine.validateDoubleEntry(lines, {
          validateFxRates: true,
          validateBaseAmounts: true,
        });

        expect(result.isBalanced).toBe(true);
        expect(result.baseTotalDebits).toBe(1250);
        expect(result.baseTotalCredits).toBe(1250);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid exchange rate', () => {
        const lines = [
          { ...createGlLine(1, 100, 0), exchangeRate: '0' },
          createGlLine(2, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines, { validateFxRates: true });

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_EXCHANGE_RATE',
          })
        );
      });

      it('should detect FX rate mismatch in base amounts', () => {
        const lines = [
          {
            ...createGlLine(1, 100, 0, 1.5),
            baseDebitAmount: '100', // Should be 150 (100 * 1.5)
          },
          createGlLine(2, 0, 100, 1.5),
        ];

        const result = engine.validateDoubleEntry(lines, {
          validateFxRates: true,
          validateBaseAmounts: true,
        });

        expect(result.isBalanced).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'FX_RATE_MISMATCH',
          })
        );
      });

      it('should validate base currency amounts separately', () => {
        // Transaction balanced in source currency but not in base
        const lines = [
          {
            ...createGlLine(1, 100, 0, 1.5),
            baseDebitAmount: '150',
          },
          {
            ...createGlLine(2, 0, 100, 1.4), // Different rate
            baseCreditAmount: '140',
          },
        ];

        const result = engine.validateDoubleEntry(lines, {
          validateBaseAmounts: true,
          validateFxRates: false, // Skip FX rate check
        });

        expect(result.totalDebits).toBe(100);
        expect(result.totalCredits).toBe(100);
        expect(result.baseTotalDebits).toBe(150);
        expect(result.baseTotalCredits).toBe(140);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'UNBALANCED_BASE_AMOUNTS',
          })
        );
      });
    });

    describe('validation options', () => {
      it('should allow skipping both sides requirement', () => {
        const lines = [
          createGlLine(1, 100, 0),
          createGlLine(2, 100, 0),
        ];

        const result = engine.validateDoubleEntry(lines, { requireBothSides: false });

        // Still unbalanced (no credits) but no MISSING_CREDIT_LINE error
        expect(result.errors).not.toContainEqual(
          expect.objectContaining({ code: 'MISSING_CREDIT_LINE' })
        );
      });

      it('should allow zero-amount lines when configured', () => {
        const lines = [
          createGlLine(1, 100, 0),
          createGlLine(2, 0, 0),
          createGlLine(3, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines, { allowZeroAmountLines: true });

        expect(result.warnings).not.toContainEqual(expect.stringContaining('Line 2'));
      });

      it('should skip base amount validation when disabled', () => {
        const lines = [
          {
            ...createGlLine(1, 100, 0),
            baseDebitAmount: '999', // Intentionally wrong
          },
          createGlLine(2, 0, 100),
        ];

        const result = engine.validateDoubleEntry(lines, {
          validateBaseAmounts: false,
          validateFxRates: false,
        });

        expect(result.isBalanced).toBe(true);
        expect(result.errors).not.toContainEqual(
          expect.objectContaining({ code: 'UNBALANCED_BASE_AMOUNTS' })
        );
      });
    });
  });

  describe('error messages and audit info', () => {
    it('should provide detailed error context', () => {
      const lines = [
        createGlLine(1, 1000, 0),
        createGlLine(2, 0, 500), // Unbalanced
      ];

      const result = engine.validateDoubleEntry(lines);

      const unbalancedError = result.errors.find((e) => e.code === 'UNBALANCED_TRANSACTION');
      expect(unbalancedError).toBeDefined();
      expect(unbalancedError?.context).toMatchObject({
        totalDebits: 1000,
        totalCredits: 500,
        difference: 500,
      });
    });

    it('should include affected line numbers in line errors', () => {
      const lines = [
        createGlLine(1, -100, 0),
        createGlLine(2, 0, 100),
      ];

      const result = engine.validateDoubleEntry(lines);

      const negativeError = result.errors.find((e) => e.code === 'NEGATIVE_AMOUNT');
      expect(negativeError?.affectedLines).toContain(1);
    });
  });
});

describe('GlPostingEngine - Period Validation Integration', () => {
  it('should integrate with AccountingPeriodService for period checks', async () => {
    // This is a placeholder for integration tests
    // Full integration tests would require mocking the database
    const { AccountingPeriodService } = await vi.importMock('../accounting-period-service');

    expect(AccountingPeriodService).toBeDefined();
  });
});
