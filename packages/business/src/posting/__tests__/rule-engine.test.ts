import { describe, it, expect, beforeEach } from 'vitest';
import {
  PostingRuleEngine,
  createPostingRuleEngine,
  createDefaultValidationSettings,
  BusinessTransactionInput,
  BusinessTransactionLineInput,
} from '../rule-engine';
import {
  PostingRuleSet,
  PostingRule,
  TransactionType,
  LineType,
  ConditionOperator,
  ConditionField,
  AmountField,
  ValidationErrorCode,
  ValidationSettings,
  GeneratedGlLine,
} from '../types';
import { AccountDimension } from '../../chart-of-accounts/types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestRuleSet(rules: PostingRule[], validationOverrides?: Partial<ValidationSettings>): PostingRuleSet {
  return {
    id: 'test-ruleset-1',
    organizationId: 'org-123',
    name: 'Test Rule Set',
    version: '1.0.0',
    rules,
    defaultDimensionRules: [
      {
        targetDimension: AccountDimension.DEPARTMENT,
        source: { type: 'line', field: 'departmentId' },
        required: false,
      },
      {
        targetDimension: AccountDimension.PROJECT,
        source: { type: 'transaction', field: 'projectId' },
        required: false,
      },
    ],
    validationSettings: {
      ...createDefaultValidationSettings(),
      ...validationOverrides,
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function createTestTransaction(overrides?: Partial<BusinessTransactionInput>): BusinessTransactionInput {
  return {
    id: 'txn-123',
    transactionNumber: 'INV-001',
    transactionType: TransactionType.CUSTOMER_INVOICE,
    transactionDate: '2024-01-15',
    subsidiaryId: 'sub-001',
    currencyCode: 'USD',
    exchangeRate: 1.0,
    customerId: 'cust-001',
    totalAmount: 1000,
    taxTotal: 100,
    discountTotal: 50,
    subtotal: 950,
    ...overrides,
  };
}

function createTestLine(overrides?: Partial<BusinessTransactionLineInput>): BusinessTransactionLineInput {
  return {
    id: 'line-1',
    lineNumber: 1,
    lineType: LineType.ITEM,
    itemId: 'item-001',
    description: 'Product Sale',
    quantity: 10,
    unitPrice: 100,
    amount: 1000,
    taxAmount: 100,
    departmentId: 'dept-001',
    ...overrides,
  };
}

function createSimpleInvoiceRule(): PostingRule {
  return {
    id: 'rule-1',
    name: 'Customer Invoice Revenue',
    transactionType: TransactionType.CUSTOMER_INVOICE,
    sequenceNumber: 10,
    debitAccountId: '1200', // Accounts Receivable
    creditAccountId: '4100', // Revenue
    amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
    isActive: true,
    effectiveDate: '2024-01-01',
    priority: 100,
  };
}

// ============================================================================
// Rule Engine Tests
// ============================================================================

describe('PostingRuleEngine', () => {
  describe('evaluate', () => {
    it('should generate balanced GL entries for simple invoice', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(2);
      expect(result.validation.isBalanced).toBe(true);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleName).toBe('Customer Invoice Revenue');

      // Check debit line
      const debitLine = result.lines.find(l => l.debitAmount > 0);
      expect(debitLine).toBeDefined();
      expect(debitLine?.accountId).toBe('1200');
      expect(debitLine?.debitAmount).toBe(1000);

      // Check credit line
      const creditLine = result.lines.find(l => l.creditAmount > 0);
      expect(creditLine).toBeDefined();
      expect(creditLine?.accountId).toBe('4100');
      expect(creditLine?.creditAmount).toBe(1000);
    });

    it('should handle multiple lines generating multiple GL entries', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', lineNumber: 1, amount: 500 }),
        createTestLine({ id: 'line-2', lineNumber: 2, amount: 300 }),
        createTestLine({ id: 'line-3', lineNumber: 3, amount: 200 }),
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(6); // 2 GL lines per transaction line
      expect(result.validation.isBalanced).toBe(true);
      expect(result.validation.totalDebits).toBe(1000);
      expect(result.validation.totalCredits).toBe(1000);
    });

    it('should apply line type filter correctly', () => {
      const itemRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        id: 'rule-item',
        lineType: LineType.ITEM,
      };
      const serviceRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        id: 'rule-service',
        lineType: LineType.SERVICE,
        sequenceNumber: 20,
        creditAccountId: '4200', // Service Revenue
      };

      const ruleSet = createTestRuleSet([itemRule, serviceRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', lineType: LineType.ITEM, amount: 500 }),
        createTestLine({ id: 'line-2', lineType: LineType.SERVICE, amount: 300 }),
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(4);
      expect(result.validation.isBalanced).toBe(true);

      // Verify item goes to 4100 and service to 4200
      const itemCredit = result.lines.find(
        l => l.sourceLineId === 'line-1' && l.creditAmount > 0
      );
      expect(itemCredit?.accountId).toBe('4100');

      const serviceCredit = result.lines.find(
        l => l.sourceLineId === 'line-2' && l.creditAmount > 0
      );
      expect(serviceCredit?.accountId).toBe('4200');
    });

    it('should filter rules by effective date', () => {
      const futureRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        effectiveDate: '2099-01-01', // Future date
      };

      const ruleSet = createTestRuleSet([futureRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine()];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(0);
      expect(result.warnings).toContain(
        `No posting rules found for transaction type: ${TransactionType.CUSTOMER_INVOICE}`
      );
    });

    it('should filter expired rules', () => {
      const expiredRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        effectiveDate: '2020-01-01',
        expirationDate: '2021-01-01', // Expired
      };

      const ruleSet = createTestRuleSet([expiredRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine()];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(0);
    });

    it('should filter inactive rules', () => {
      const inactiveRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        isActive: false,
      };

      const ruleSet = createTestRuleSet([inactiveRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine()];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(0);
    });

    it('should filter by subsidiary', () => {
      const subsidiaryRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        subsidiaryId: 'sub-002', // Different subsidiary
      };

      const ruleSet = createTestRuleSet([subsidiaryRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction({ subsidiaryId: 'sub-001' });
      const lines = [createTestLine()];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(0);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate simple EQUALS condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'simple',
          field: ConditionField.LINE_TYPE,
          operator: ConditionOperator.EQUALS,
          value: LineType.ITEM,
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const itemLine = createTestLine({ lineType: LineType.ITEM, amount: 500 });
      const serviceLine = createTestLine({ id: 'line-2', lineType: LineType.SERVICE, amount: 300 });

      const result = engine.evaluate(transaction, [itemLine, serviceLine]);

      // Only item line should generate entries
      expect(result.lines).toHaveLength(2);
      expect(result.validation.totalDebits).toBe(500);
    });

    it('should evaluate GREATER_THAN condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'simple',
          field: ConditionField.LINE_AMOUNT,
          operator: ConditionOperator.GREATER_THAN,
          value: 500,
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', amount: 600 }), // > 500, included
        createTestLine({ id: 'line-2', amount: 500 }), // = 500, excluded
        createTestLine({ id: 'line-3', amount: 400 }), // < 500, excluded
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(2);
      expect(result.validation.totalDebits).toBe(600);
    });

    it('should evaluate IN condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'simple',
          field: ConditionField.ITEM_ID,
          operator: ConditionOperator.IN,
          value: ['item-001', 'item-002'],
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', itemId: 'item-001', amount: 100 }),
        createTestLine({ id: 'line-2', itemId: 'item-003', amount: 200 }), // excluded
        createTestLine({ id: 'line-3', itemId: 'item-002', amount: 150 }),
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(4);
      expect(result.validation.totalDebits).toBe(250); // 100 + 150
    });

    it('should evaluate IS_NULL condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'simple',
          field: ConditionField.IS_BILLABLE,
          operator: ConditionOperator.IS_NULL,
          value: true,
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', isBillable: undefined, amount: 100 }),
        createTestLine({ id: 'line-2', isBillable: true, amount: 200 }),
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(2);
      expect(result.validation.totalDebits).toBe(100);
    });

    it('should evaluate composite AND condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'composite',
          operator: 'AND',
          conditions: [
            {
              type: 'simple',
              field: ConditionField.LINE_TYPE,
              operator: ConditionOperator.EQUALS,
              value: LineType.ITEM,
            },
            {
              type: 'simple',
              field: ConditionField.LINE_AMOUNT,
              operator: ConditionOperator.GREATER_THAN,
              value: 500,
            },
          ],
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', lineType: LineType.ITEM, amount: 600 }), // Both true
        createTestLine({ id: 'line-2', lineType: LineType.ITEM, amount: 400 }), // Type true, amount false
        createTestLine({ id: 'line-3', lineType: LineType.SERVICE, amount: 700 }), // Type false
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(2);
      expect(result.validation.totalDebits).toBe(600);
    });

    it('should evaluate composite OR condition', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        condition: {
          type: 'composite',
          operator: 'OR',
          conditions: [
            {
              type: 'simple',
              field: ConditionField.LINE_TYPE,
              operator: ConditionOperator.EQUALS,
              value: LineType.SERVICE,
            },
            {
              type: 'simple',
              field: ConditionField.LINE_AMOUNT,
              operator: ConditionOperator.GREATER_THAN,
              value: 500,
            },
          ],
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', lineType: LineType.ITEM, amount: 600 }), // Amount matches
        createTestLine({ id: 'line-2', lineType: LineType.SERVICE, amount: 100 }), // Type matches
        createTestLine({ id: 'line-3', lineType: LineType.ITEM, amount: 400 }), // Neither
      ];

      const result = engine.evaluate(transaction, lines);

      expect(result.lines).toHaveLength(4);
      expect(result.validation.totalDebits).toBe(700); // 600 + 100
    });
  });

  describe('amount formula evaluation', () => {
    it('should evaluate field formula', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 750 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.totalDebits).toBe(750);
    });

    it('should evaluate constant formula', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: { type: 'constant', value: 100 },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 750 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.totalDebits).toBe(100);
    });

    it('should evaluate arithmetic addition formula', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: {
          type: 'arithmetic',
          operator: '+',
          left: { type: 'field', field: AmountField.LINE_AMOUNT },
          right: { type: 'field', field: AmountField.LINE_TAX_AMOUNT },
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000, taxAmount: 100 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.totalDebits).toBe(1100);
    });

    it('should evaluate arithmetic multiplication formula', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: {
          type: 'arithmetic',
          operator: '*',
          left: { type: 'field', field: AmountField.LINE_QUANTITY },
          right: { type: 'field', field: AmountField.LINE_UNIT_PRICE },
        },
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ quantity: 5, unitPrice: 200 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.totalDebits).toBe(1000);
    });

    it('should handle division by zero gracefully', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: {
          type: 'arithmetic',
          operator: '/',
          left: { type: 'field', field: AmountField.LINE_AMOUNT },
          right: { type: 'constant', value: 0 },
        },
      };

      const ruleSet = createTestRuleSet([rule], { allowZeroAmountLines: true });
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.totalDebits).toBe(0);
    });

    it('should evaluate conditional formula', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        amountFormula: {
          type: 'conditional',
          condition: {
            type: 'simple',
            field: ConditionField.LINE_AMOUNT,
            operator: ConditionOperator.GREATER_THAN,
            value: 500,
          },
          ifTrue: { type: 'field', field: AmountField.LINE_AMOUNT },
          ifFalse: { type: 'constant', value: 0 },
        },
      };

      const ruleSet = createTestRuleSet([rule], { allowZeroAmountLines: true });
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [
        createTestLine({ id: 'line-1', amount: 600 }), // > 500, use amount
        createTestLine({ id: 'line-2', amount: 400 }), // <= 500, use 0
      ];

      const result = engine.evaluate(transaction, lines);

      // Line 1 generates 600 in entries, line 2 generates 0 (still creates entries with allowZeroAmountLines)
      expect(result.validation.totalDebits).toBe(600);
    });
  });

  describe('balance validation', () => {
    it('should validate balanced transaction', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.isBalanced).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
      expect(result.validation.difference).toBe(0);
    });

    it('should detect unbalanced transaction', () => {
      // Create a rule that only debits
      const debitOnlyRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        creditAccountId: undefined,
      };

      const ruleSet = createTestRuleSet([debitOnlyRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.isBalanced).toBe(false);
      expect(result.validation.errors.some(
        e => e.code === ValidationErrorCode.UNBALANCED_TRANSACTION
      )).toBe(true);
    });

    it('should detect insufficient lines', () => {
      const debitOnlyRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        creditAccountId: undefined,
      };

      const ruleSet = createTestRuleSet([debitOnlyRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.errors.some(
        e => e.code === ValidationErrorCode.INSUFFICIENT_LINES
      )).toBe(true);
    });

    it('should detect missing debit line when required', () => {
      const creditOnlyRule: PostingRule = {
        ...createSimpleInvoiceRule(),
        debitAccountId: undefined,
      };

      const ruleSet = createTestRuleSet([creditOnlyRule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      expect(result.validation.errors.some(
        e => e.code === ValidationErrorCode.MISSING_DEBIT_LINE
      )).toBe(true);
    });

    it('should validate within tolerance', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule], { balanceTolerance: 0.01 });
      const engine = createPostingRuleEngine(ruleSet);

      const glLines: GeneratedGlLine[] = [
        {
          lineNumber: 1,
          accountId: '1200',
          debitAmount: 100.005,
          creditAmount: 0,
          currencyCode: 'USD',
          exchangeRate: 1,
          baseDebitAmount: 100.005,
          baseCreditAmount: 0,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
        {
          lineNumber: 2,
          accountId: '4100',
          debitAmount: 0,
          creditAmount: 100,
          currencyCode: 'USD',
          exchangeRate: 1,
          baseDebitAmount: 0,
          baseCreditAmount: 100,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
      ];

      const validation = engine.validateBalance(glLines, ruleSet.validationSettings);

      expect(validation.isBalanced).toBe(true); // 0.005 is within 0.01 tolerance
    });

    it('should detect negative amounts', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const glLines: GeneratedGlLine[] = [
        {
          lineNumber: 1,
          accountId: '1200',
          debitAmount: -100,
          creditAmount: 0,
          currencyCode: 'USD',
          exchangeRate: 1,
          baseDebitAmount: -100,
          baseCreditAmount: 0,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
        {
          lineNumber: 2,
          accountId: '4100',
          debitAmount: 0,
          creditAmount: 100,
          currencyCode: 'USD',
          exchangeRate: 1,
          baseDebitAmount: 0,
          baseCreditAmount: 100,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
      ];

      const validation = engine.validateBalance(glLines, ruleSet.validationSettings);

      expect(validation.isBalanced).toBe(false);
      expect(validation.errors.some(
        e => e.code === ValidationErrorCode.NEGATIVE_AMOUNT
      )).toBe(true);
    });

    it('should validate exchange rate conversion', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule], { validateFxRates: true, validateBaseAmounts: true });
      const engine = createPostingRuleEngine(ruleSet);

      const glLines: GeneratedGlLine[] = [
        {
          lineNumber: 1,
          accountId: '1200',
          debitAmount: 100,
          creditAmount: 0,
          currencyCode: 'EUR',
          exchangeRate: 1.1,
          baseDebitAmount: 110, // Correct: 100 * 1.1
          baseCreditAmount: 0,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
        {
          lineNumber: 2,
          accountId: '4100',
          debitAmount: 0,
          creditAmount: 100,
          currencyCode: 'EUR',
          exchangeRate: 1.1,
          baseDebitAmount: 0,
          baseCreditAmount: 110,
          description: 'Test',
          subsidiaryId: 'sub-001',
          sourceRuleId: 'rule-1',
        },
      ];

      const validation = engine.validateBalance(glLines, ruleSet.validationSettings);

      expect(validation.isBalanced).toBe(true);
    });
  });

  describe('dimension inheritance', () => {
    it('should inherit dimensions from transaction line', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction({ projectId: 'proj-001' });
      const lines = [createTestLine({ departmentId: 'dept-sales', amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      // All generated lines should have inherited dimensions
      for (const line of result.lines) {
        expect(line.departmentId).toBe('dept-sales');
        expect(line.projectId).toBe('proj-001');
      }
    });

    it('should use default value when source is empty', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        dimensionRules: [
          {
            targetDimension: AccountDimension.DEPARTMENT,
            source: { type: 'line', field: 'departmentId' },
            required: false,
            defaultValue: 'default-dept',
          },
        ],
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction();
      const lines = [createTestLine({ departmentId: undefined, amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      for (const line of result.lines) {
        expect(line.departmentId).toBe('default-dept');
      }
    });
  });

  describe('description generation', () => {
    it('should use description template with variable substitution', () => {
      const rule: PostingRule = {
        ...createSimpleInvoiceRule(),
        descriptionTemplate: '{line.description} - {transaction.number}',
      };

      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction({ transactionNumber: 'INV-2024-001' });
      const lines = [createTestLine({ description: 'Widget Sale', amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      for (const line of result.lines) {
        expect(line.description).toBe('Widget Sale - INV-2024-001');
      }
    });

    it('should use default description when no template', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction({ transactionNumber: 'INV-001' });
      const lines = [createTestLine({ description: undefined, amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      for (const line of result.lines) {
        expect(line.description).toContain('INV-001');
      }
    });
  });

  describe('multi-currency support', () => {
    it('should calculate base amounts with exchange rate', () => {
      const rule = createSimpleInvoiceRule();
      const ruleSet = createTestRuleSet([rule]);
      const engine = createPostingRuleEngine(ruleSet);

      const transaction = createTestTransaction({
        currencyCode: 'EUR',
        exchangeRate: 1.1, // 1 EUR = 1.1 USD
      });
      const lines = [createTestLine({ amount: 1000 })];

      const result = engine.evaluate(transaction, lines);

      const debitLine = result.lines.find(l => l.debitAmount > 0);
      expect(debitLine?.debitAmount).toBe(1000);
      expect(debitLine?.baseDebitAmount).toBe(1100); // 1000 * 1.1

      const creditLine = result.lines.find(l => l.creditAmount > 0);
      expect(creditLine?.creditAmount).toBe(1000);
      expect(creditLine?.baseCreditAmount).toBe(1100);
    });
  });

  describe('factory functions', () => {
    it('should create engine with createPostingRuleEngine', () => {
      const ruleSet = createTestRuleSet([createSimpleInvoiceRule()]);
      const engine = createPostingRuleEngine(ruleSet);

      expect(engine).toBeInstanceOf(PostingRuleEngine);
    });

    it('should create default validation settings', () => {
      const settings = createDefaultValidationSettings();

      expect(settings.balanceTolerance).toBe(0.01);
      expect(settings.validateBaseAmounts).toBe(true);
      expect(settings.requireBothSides).toBe(true);
      expect(settings.allowZeroAmountLines).toBe(false);
      expect(settings.validateFxRates).toBe(true);
      expect(settings.checkPeriodStatus).toBe(true);
    });
  });
});
