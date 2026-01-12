import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceError } from '../../types';
import type {
  BusinessTransaction,
  BusinessTransactionLine,
  GlPostingRule,
  FxRateMetadata,
} from '../../types';

/**
 * Integration tests for GL posting flows
 * Tests order-to-cash and procure-to-pay scenarios
 */

// Use vi.hoisted() to properly hoist mock functions for use in vi.mock factory
const { mockCheckPostingAllowed } = vi.hoisted(() => ({
  mockCheckPostingAllowed: vi.fn(),
}));

// Mock AccountingPeriodService
vi.mock('../accounting-period-service', () => ({
  AccountingPeriodService: vi.fn().mockImplementation(() => ({
    checkPostingAllowed: mockCheckPostingAllowed,
  })),
}));

// Mock database repositories
vi.mock('@glapi/database', () => ({
  AccountingPeriodRepository: vi.fn().mockImplementation(() => ({
    getAccessibleSubsidiaryIds: vi.fn().mockResolvedValue(['sub-123']),
    canPostToDate: vi.fn().mockResolvedValue({ canPost: true, period: { status: 'OPEN' } }),
  })),
}));

// Import after mocking
import { GlPostingEngine, PostingContext } from '../gl-posting-engine';

describe('GL Posting Integration Tests', () => {
  let engine: GlPostingEngine;
  const testOrgId = 'org-123';
  const testUserId = 'user-123';
  const testSubsidiaryId = 'sub-123';
  const testPeriodId = 'period-123';

  // Test accounts
  const ACCOUNTS = {
    CASH: 'acc-cash',
    ACCOUNTS_RECEIVABLE: 'acc-ar',
    ACCOUNTS_PAYABLE: 'acc-ap',
    REVENUE: 'acc-revenue',
    COGS: 'acc-cogs',
    INVENTORY: 'acc-inventory',
    EXPENSE: 'acc-expense',
    TAX_PAYABLE: 'acc-tax-payable',
    FX_GAIN_LOSS: 'acc-fx-gain-loss',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPostingAllowed.mockResolvedValue({
      canPost: true,
      period: { id: testPeriodId, status: 'OPEN' },
    });

    engine = new GlPostingEngine({
      organizationId: testOrgId,
      userId: testUserId,
    });
  });

  describe('Order-to-Cash Flow', () => {
    describe('Sales Invoice Posting', () => {
      it('should generate balanced GL entries for a simple sales invoice', async () => {
        // Sales invoice: Customer owes $1000 for services
        const salesInvoice: BusinessTransaction = {
          id: 'inv-001',
          transactionNumber: 'INV-2024-001',
          transactionTypeId: 'type-invoice',
          subsidiaryId: testSubsidiaryId,
          entityId: 'customer-123',
          entityType: 'CUSTOMER',
          transactionDate: '2024-01-15',
          currencyCode: 'USD',
          exchangeRate: '1',
          subtotalAmount: '1000',
          taxAmount: '0',
          discountAmount: '0',
          totalAmount: '1000',
          baseTotalAmount: '1000',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const invoiceLines: BusinessTransactionLine[] = [
          {
            id: 'line-1',
            businessTransactionId: 'inv-001',
            lineNumber: 1,
            lineType: 'SERVICE',
            description: 'Consulting Services',
            quantity: '10',
            unitPrice: '100',
            lineAmount: '1000',
            taxAmount: '0',
            totalLineAmount: '1000',
            accountId: ACCOUNTS.REVENUE,
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-1',
            transactionTypeId: 'type-invoice',
            ruleName: 'Debit AR',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.ACCOUNTS_RECEIVABLE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-2',
            transactionTypeId: 'type-invoice',
            ruleName: 'Credit Revenue',
            sequenceNumber: 2,
            creditAccountId: ACCOUNTS.REVENUE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const context: PostingContext = {
          businessTransaction: salesInvoice,
          businessTransactionLines: invoiceLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        const result = await engine.generateGlEntries(context);

        // Verify balanced posting
        expect(result.validationResult.isBalanced).toBe(true);
        expect(result.validationResult.totalDebits).toBe(1000);
        expect(result.validationResult.totalCredits).toBe(1000);
        expect(result.validationResult.errors).toHaveLength(0);

        // Verify GL lines
        expect(result.glLines.length).toBeGreaterThanOrEqual(2);

        // Verify audit entry was created
        expect(result.auditEntryId).toBeDefined();
      });

      it('should handle multi-currency sales with FX metadata', async () => {
        // EUR invoice at 1.10 USD/EUR exchange rate
        const eurInvoice: BusinessTransaction = {
          id: 'inv-002',
          transactionNumber: 'INV-2024-002',
          transactionTypeId: 'type-invoice',
          subsidiaryId: testSubsidiaryId,
          entityId: 'customer-456',
          entityType: 'CUSTOMER',
          transactionDate: '2024-01-15',
          currencyCode: 'EUR',
          exchangeRate: '1.10', // 1 EUR = 1.10 USD
          subtotalAmount: '1000',
          taxAmount: '0',
          discountAmount: '0',
          totalAmount: '1000',
          baseTotalAmount: '1100', // 1000 EUR * 1.10
          status: 'APPROVED',
          versionNumber: 1,
        };

        const invoiceLines: BusinessTransactionLine[] = [
          {
            id: 'line-1',
            businessTransactionId: 'inv-002',
            lineNumber: 1,
            lineType: 'SERVICE',
            description: 'International Services',
            quantity: '1',
            unitPrice: '1000',
            lineAmount: '1000',
            taxAmount: '0',
            totalLineAmount: '1000',
            accountId: ACCOUNTS.REVENUE,
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-1',
            transactionTypeId: 'type-invoice',
            ruleName: 'Debit AR',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.ACCOUNTS_RECEIVABLE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-2',
            transactionTypeId: 'type-invoice',
            ruleName: 'Credit Revenue',
            sequenceNumber: 2,
            creditAccountId: ACCOUNTS.REVENUE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const fxMetadata: FxRateMetadata = {
          sourceCurrency: 'EUR',
          targetCurrency: 'USD',
          exchangeRate: '1.10',
          inverseRate: '0.909091',
          rateSource: 'MARKET',
          rateDate: '2024-01-15',
          rateProvider: 'ECB',
          isLockedRate: true,
        };

        const context: PostingContext = {
          businessTransaction: eurInvoice,
          businessTransactionLines: invoiceLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
          fxMetadata,
        };

        const result = await engine.generateGlEntries(context);

        // Verify balanced in both currencies
        expect(result.validationResult.isBalanced).toBe(true);

        // Verify FX metadata captured
        expect(result.fxMetadata).toBeDefined();
        expect(result.fxMetadata?.sourceCurrency).toBe('EUR');
        expect(result.fxMetadata?.targetCurrency).toBe('USD');
        expect(result.fxMetadata?.rateSource).toBe('MARKET');
      });

      it('should reject posting to closed period', async () => {
        mockCheckPostingAllowed.mockResolvedValue({
          canPost: false,
          period: { id: testPeriodId, status: 'CLOSED' },
          reason: 'Period is closed - only adjustment entries allowed',
        });

        const salesInvoice: BusinessTransaction = {
          id: 'inv-003',
          transactionNumber: 'INV-2024-003',
          transactionTypeId: 'type-invoice',
          subsidiaryId: testSubsidiaryId,
          transactionDate: '2024-01-15',
          currencyCode: 'USD',
          exchangeRate: '1',
          totalAmount: '1000',
          baseTotalAmount: '1000',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const context: PostingContext = {
          businessTransaction: salesInvoice,
          businessTransactionLines: [
            {
              businessTransactionId: 'inv-003',
              lineNumber: 1,
              lineType: 'SERVICE',
              description: 'Service',
              lineAmount: '1000',
              totalLineAmount: '1000',
            },
          ],
          postingRules: [
            {
              id: 'rule-1',
              transactionTypeId: 'type-invoice',
              ruleName: 'Post',
              sequenceNumber: 1,
              debitAccountId: ACCOUNTS.ACCOUNTS_RECEIVABLE,
              creditAccountId: ACCOUNTS.REVENUE,
              effectiveDate: '2024-01-01',
              isActive: true,
            },
          ],
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        await expect(engine.generateGlEntries(context)).rejects.toThrow(ServiceError);
        await expect(engine.generateGlEntries(context)).rejects.toMatchObject({
          code: 'PERIOD_CLOSED',
        });
      });
    });

    describe('Payment Receipt Posting', () => {
      it('should generate balanced GL entries for payment receipt', async () => {
        // Customer pays invoice: Debit Cash, Credit AR
        const paymentReceipt: BusinessTransaction = {
          id: 'pmt-001',
          transactionNumber: 'PMT-2024-001',
          transactionTypeId: 'type-payment',
          subsidiaryId: testSubsidiaryId,
          entityId: 'customer-123',
          entityType: 'CUSTOMER',
          transactionDate: '2024-01-20',
          currencyCode: 'USD',
          exchangeRate: '1',
          totalAmount: '1000',
          baseTotalAmount: '1000',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const paymentLines: BusinessTransactionLine[] = [
          {
            businessTransactionId: 'pmt-001',
            lineNumber: 1,
            lineType: 'ITEM',
            description: 'Payment for INV-2024-001',
            lineAmount: '1000',
            totalLineAmount: '1000',
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-pmt-1',
            transactionTypeId: 'type-payment',
            ruleName: 'Debit Cash',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.CASH,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-pmt-2',
            transactionTypeId: 'type-payment',
            ruleName: 'Credit AR',
            sequenceNumber: 2,
            creditAccountId: ACCOUNTS.ACCOUNTS_RECEIVABLE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const context: PostingContext = {
          businessTransaction: paymentReceipt,
          businessTransactionLines: paymentLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        const result = await engine.generateGlEntries(context);

        expect(result.validationResult.isBalanced).toBe(true);
        expect(result.validationResult.totalDebits).toBe(1000);
        expect(result.validationResult.totalCredits).toBe(1000);
      });
    });
  });

  describe('Procure-to-Pay Flow', () => {
    describe('Purchase Invoice Posting', () => {
      it('should generate balanced GL entries for purchase invoice', async () => {
        // Vendor invoice: Credit AP, Debit Expense/Inventory
        const purchaseInvoice: BusinessTransaction = {
          id: 'bill-001',
          transactionNumber: 'BILL-2024-001',
          transactionTypeId: 'type-bill',
          subsidiaryId: testSubsidiaryId,
          entityId: 'vendor-123',
          entityType: 'VENDOR',
          transactionDate: '2024-01-15',
          currencyCode: 'USD',
          exchangeRate: '1',
          subtotalAmount: '5000',
          taxAmount: '400',
          discountAmount: '0',
          totalAmount: '5400',
          baseTotalAmount: '5400',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const billLines: BusinessTransactionLine[] = [
          {
            businessTransactionId: 'bill-001',
            lineNumber: 1,
            lineType: 'ITEM',
            description: 'Office Supplies',
            quantity: '100',
            unitPrice: '50',
            lineAmount: '5000',
            taxAmount: '400',
            totalLineAmount: '5400',
            accountId: ACCOUNTS.EXPENSE,
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-bill-1',
            transactionTypeId: 'type-bill',
            ruleName: 'Debit Expense',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.EXPENSE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-bill-2',
            transactionTypeId: 'type-bill',
            ruleName: 'Debit Tax',
            sequenceNumber: 2,
            debitAccountId: ACCOUNTS.TAX_PAYABLE,
            amountFormula: 'tax_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-bill-3',
            transactionTypeId: 'type-bill',
            ruleName: 'Credit AP',
            sequenceNumber: 3,
            creditAccountId: ACCOUNTS.ACCOUNTS_PAYABLE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const context: PostingContext = {
          businessTransaction: purchaseInvoice,
          businessTransactionLines: billLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        const result = await engine.generateGlEntries(context);

        expect(result.validationResult.isBalanced).toBe(true);
        expect(result.validationResult.errors).toHaveLength(0);
      });

      it('should handle inventory purchase with COGS', async () => {
        // Inventory purchase with cost tracking
        const inventoryPurchase: BusinessTransaction = {
          id: 'po-001',
          transactionNumber: 'PO-2024-001',
          transactionTypeId: 'type-purchase',
          subsidiaryId: testSubsidiaryId,
          entityId: 'vendor-456',
          entityType: 'VENDOR',
          transactionDate: '2024-01-15',
          currencyCode: 'USD',
          exchangeRate: '1',
          totalAmount: '10000',
          baseTotalAmount: '10000',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const purchaseLines: BusinessTransactionLine[] = [
          {
            businessTransactionId: 'po-001',
            lineNumber: 1,
            lineType: 'ITEM',
            itemId: 'item-123',
            description: 'Raw Materials',
            quantity: '1000',
            unitPrice: '10',
            lineAmount: '10000',
            costAmount: '10000',
            totalLineAmount: '10000',
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-po-1',
            transactionTypeId: 'type-purchase',
            ruleName: 'Debit Inventory',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.INVENTORY,
            amountFormula: 'cost_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-po-2',
            transactionTypeId: 'type-purchase',
            ruleName: 'Credit AP',
            sequenceNumber: 2,
            creditAccountId: ACCOUNTS.ACCOUNTS_PAYABLE,
            amountFormula: 'cost_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const context: PostingContext = {
          businessTransaction: inventoryPurchase,
          businessTransactionLines: purchaseLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        const result = await engine.generateGlEntries(context);

        expect(result.validationResult.isBalanced).toBe(true);
        expect(result.validationResult.totalDebits).toBe(10000);
        expect(result.validationResult.totalCredits).toBe(10000);
      });
    });

    describe('Vendor Payment Posting', () => {
      it('should generate balanced GL entries for vendor payment', async () => {
        // Pay vendor: Debit AP, Credit Cash
        const vendorPayment: BusinessTransaction = {
          id: 'pay-001',
          transactionNumber: 'PAY-2024-001',
          transactionTypeId: 'type-vendor-payment',
          subsidiaryId: testSubsidiaryId,
          entityId: 'vendor-123',
          entityType: 'VENDOR',
          transactionDate: '2024-01-25',
          currencyCode: 'USD',
          exchangeRate: '1',
          totalAmount: '5400',
          baseTotalAmount: '5400',
          status: 'APPROVED',
          versionNumber: 1,
        };

        const paymentLines: BusinessTransactionLine[] = [
          {
            businessTransactionId: 'pay-001',
            lineNumber: 1,
            lineType: 'ITEM',
            description: 'Payment for BILL-2024-001',
            lineAmount: '5400',
            totalLineAmount: '5400',
          },
        ];

        const postingRules: GlPostingRule[] = [
          {
            id: 'rule-vpmt-1',
            transactionTypeId: 'type-vendor-payment',
            ruleName: 'Debit AP',
            sequenceNumber: 1,
            debitAccountId: ACCOUNTS.ACCOUNTS_PAYABLE,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
          {
            id: 'rule-vpmt-2',
            transactionTypeId: 'type-vendor-payment',
            ruleName: 'Credit Cash',
            sequenceNumber: 2,
            creditAccountId: ACCOUNTS.CASH,
            amountFormula: 'line_amount',
            effectiveDate: '2024-01-01',
            isActive: true,
          },
        ];

        const context: PostingContext = {
          businessTransaction: vendorPayment,
          businessTransactionLines: paymentLines,
          postingRules,
          baseCurrencyCode: 'USD',
          periodId: testPeriodId,
        };

        const result = await engine.generateGlEntries(context);

        expect(result.validationResult.isBalanced).toBe(true);
        expect(result.validationResult.totalDebits).toBe(5400);
        expect(result.validationResult.totalCredits).toBe(5400);
      });
    });
  });

  describe('Error Cases - Unbalanced Postings', () => {
    it('should reject posting with missing credit rule', async () => {
      const transaction: BusinessTransaction = {
        id: 'bad-001',
        transactionNumber: 'BAD-2024-001',
        transactionTypeId: 'type-bad',
        subsidiaryId: testSubsidiaryId,
        transactionDate: '2024-01-15',
        currencyCode: 'USD',
        exchangeRate: '1',
        totalAmount: '1000',
        baseTotalAmount: '1000',
        status: 'APPROVED',
        versionNumber: 1,
      };

      const lines: BusinessTransactionLine[] = [
        {
          businessTransactionId: 'bad-001',
          lineNumber: 1,
          lineType: 'ITEM',
          description: 'Test',
          lineAmount: '1000',
          totalLineAmount: '1000',
        },
      ];

      // Only debit rule, no credit rule
      const postingRules: GlPostingRule[] = [
        {
          id: 'rule-bad-1',
          transactionTypeId: 'type-bad',
          ruleName: 'Debit Only',
          sequenceNumber: 1,
          debitAccountId: ACCOUNTS.EXPENSE,
          amountFormula: 'line_amount',
          effectiveDate: '2024-01-01',
          isActive: true,
        },
      ];

      const context: PostingContext = {
        businessTransaction: transaction,
        businessTransactionLines: lines,
        postingRules,
        baseCurrencyCode: 'USD',
        periodId: testPeriodId,
      };

      await expect(engine.generateGlEntries(context)).rejects.toThrow(ServiceError);
      await expect(engine.generateGlEntries(context)).rejects.toMatchObject({
        code: 'GL_TRANSACTION_NOT_BALANCED',
      });
    });

    it('should log audit entry for failed postings', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transaction: BusinessTransaction = {
        id: 'audit-test',
        transactionNumber: 'AUDIT-001',
        transactionTypeId: 'type-test',
        subsidiaryId: testSubsidiaryId,
        transactionDate: '2024-01-15',
        currencyCode: 'USD',
        exchangeRate: '1',
        totalAmount: '1000',
        baseTotalAmount: '1000',
        status: 'APPROVED',
        versionNumber: 1,
      };

      // Unbalanced posting rules
      const postingRules: GlPostingRule[] = [
        {
          id: 'rule-1',
          transactionTypeId: 'type-test',
          ruleName: 'Debit',
          sequenceNumber: 1,
          debitAccountId: ACCOUNTS.CASH,
          amountFormula: 'line_amount',
          effectiveDate: '2024-01-01',
          isActive: true,
        },
      ];

      const context: PostingContext = {
        businessTransaction: transaction,
        businessTransactionLines: [
          {
            businessTransactionId: 'audit-test',
            lineNumber: 1,
            lineType: 'ITEM',
            description: 'Test',
            lineAmount: '1000',
            totalLineAmount: '1000',
          },
        ],
        postingRules,
        baseCurrencyCode: 'USD',
        periodId: testPeriodId,
      };

      try {
        await engine.generateGlEntries(context);
      } catch {
        // Expected to fail
      }

      // Verify audit was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[GL_POSTING_AUDIT]',
        expect.stringContaining('"success":false')
      );

      consoleSpy.mockRestore();
    });
  });
});
