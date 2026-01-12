/**
 * Posting Rules DSL Unit Tests
 *
 * Tests for parsing, validation, and transformation of posting rule configurations.
 *
 * @author OliveWolf
 * @task glapi-z5t
 */

import { describe, it, expect } from 'vitest';
import {
  parsePostingRule,
  parsePostingRuleSet,
  validatePostingRuleSet,
  type PostingRuleSetConfig,
  type PostingRuleDefinition,
} from '../posting-rules-dsl.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMinimalRuleSet = (): PostingRuleSetConfig => ({
  metadata: {
    name: 'Test Rules',
    version: '1.0.0',
    effectiveDate: '2024-01-01',
  },
  rules: [],
});

const createBasicRule = (): PostingRuleDefinition => ({
  id: 'TEST_RULE',
  name: 'Test Rule',
  transactionType: 'INVOICE',
  post: [
    {
      side: 'debit',
      account: { default: 'accountsReceivable' },
      amount: { field: 'totalAmount' },
    },
    {
      side: 'credit',
      account: { default: 'deferredRevenue' },
      amount: { field: 'totalAmount' },
    },
  ],
});

// ============================================================================
// parsePostingRule Tests
// ============================================================================

describe('parsePostingRule', () => {
  const defaults = { isActive: true };
  const metadata = {
    name: 'Test',
    version: '1.0.0',
    effectiveDate: '2024-01-01',
  };

  it('should parse a basic posting rule with debit and credit', () => {
    const rule = createBasicRule();
    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed).toHaveLength(2);

    // Check debit entry
    expect(parsed[0]).toMatchObject({
      ruleName: 'Test Rule - DEBIT',
      transactionTypeCode: 'INVOICE',
      debitAccountId: '{{default.accountsReceivable}}',
      creditAccountId: null,
      amountFormula: '{{field.totalAmount}}',
      isActive: true,
    });

    // Check credit entry
    expect(parsed[1]).toMatchObject({
      ruleName: 'Test Rule - CREDIT',
      creditAccountId: '{{default.deferredRevenue}}',
      debitAccountId: null,
    });
  });

  it('should handle direct account numbers', () => {
    const rule: PostingRuleDefinition = {
      id: 'DIRECT_ACCOUNT',
      name: 'Direct Account Rule',
      transactionType: 'INVOICE',
      post: [
        {
          side: 'debit',
          account: '1100',
          amount: 100,
        },
        {
          side: 'credit',
          account: '4000',
          amount: 100,
        },
      ],
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.debitAccountId).toBe('1100');
    expect(parsed[0]?.amountFormula).toBe('100');
    expect(parsed[1]?.creditAccountId).toBe('4000');
  });

  it('should handle field-based account lookup', () => {
    const rule: PostingRuleDefinition = {
      id: 'FIELD_ACCOUNT',
      name: 'Field Account Rule',
      transactionType: 'INVOICE',
      post: [
        {
          side: 'debit',
          account: { field: 'customAccountId' },
          amount: { field: 'lineAmount' },
        },
        {
          side: 'credit',
          account: { config: 'defaultRevenueAccount' },
          amount: { field: 'lineAmount' },
        },
      ],
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.debitAccountId).toBe('{{field.customAccountId}}');
    expect(parsed[1]?.creditAccountId).toBe('{{config.defaultRevenueAccount}}');
  });

  it('should handle formula-based amounts', () => {
    const rule: PostingRuleDefinition = {
      id: 'FORMULA_AMOUNT',
      name: 'Formula Amount Rule',
      transactionType: 'INVOICE',
      post: [
        {
          side: 'debit',
          account: '1100',
          amount: { formula: 'quantity * unit_price * (1 - discount_rate)' },
        },
        {
          side: 'credit',
          account: '4000',
          amount: { lineAmount: true },
        },
      ],
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.amountFormula).toBe('quantity * unit_price * (1 - discount_rate)');
    expect(parsed[1]?.amountFormula).toBe('{{line.amount}}');
  });

  it('should parse transaction type with line type', () => {
    const rule: PostingRuleDefinition = {
      id: 'LINE_TYPE',
      name: 'Line Type Rule',
      transactionType: {
        code: 'SHIPMENT',
        lineType: 'PRODUCT',
      },
      post: [
        {
          side: 'debit',
          account: '5000',
          amount: { field: 'costAmount' },
        },
        {
          side: 'credit',
          account: '1300',
          amount: { field: 'costAmount' },
        },
      ],
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.transactionTypeCode).toBe('SHIPMENT');
    expect(parsed[0]?.lineType).toBe('PRODUCT');
  });

  it('should parse description templates', () => {
    const rule: PostingRuleDefinition = {
      id: 'DESC_TEMPLATE',
      name: 'Description Template Rule',
      transactionType: 'INVOICE',
      post: [
        {
          side: 'debit',
          account: '1100',
          amount: 100,
          description: {
            template: 'Invoice {{invoiceNumber}} - {{customerName}}',
            fallback: 'Invoice posting',
          },
        },
        {
          side: 'credit',
          account: '4000',
          amount: 100,
          description: 'Simple string description',
        },
      ],
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.descriptionTemplate).toBe('Invoice {{invoiceNumber}} - {{customerName}}');
    expect(parsed[1]?.descriptionTemplate).toBe('Simple string description');
  });

  it('should respect sequence numbers', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      sequence: 50,
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.sequenceNumber).toBe(500); // 50 * 10 + 0
    expect(parsed[1]?.sequenceNumber).toBe(501); // 50 * 10 + 1
  });

  it('should handle subsidiary restrictions', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      subsidiary: 'SUB001',
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.subsidiaryId).toBe('SUB001');
  });

  it('should handle effective and expiration dates', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      effectiveDate: '2024-06-01',
      expirationDate: '2024-12-31',
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.effectiveDate).toEqual(new Date('2024-06-01'));
    expect(parsed[0]?.expirationDate).toEqual(new Date('2024-12-31'));
  });
});

// ============================================================================
// Condition SQL Building Tests
// ============================================================================

describe('parsePostingRule - conditions', () => {
  const defaults = { isActive: true };
  const metadata = {
    name: 'Test',
    version: '1.0.0',
    effectiveDate: '2024-01-01',
  };

  it('should build condition SQL for line type filter', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        lineType: 'SUBSCRIPTION',
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toBe("line_type IN ('SUBSCRIPTION')");
  });

  it('should build condition SQL for multiple line types', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        lineType: ['SUBSCRIPTION', 'SERVICE'],
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toBe("line_type IN ('SUBSCRIPTION', 'SERVICE')");
  });

  it('should build condition SQL for simple field matching', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        match: {
          status: 'APPROVED',
          amount: 1000,
          isRecurring: true,
        },
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toContain("status = 'APPROVED'");
    expect(parsed[0]?.conditionSql).toContain('amount = 1000');
    expect(parsed[0]?.conditionSql).toContain('isRecurring = true');
  });

  it('should build condition SQL for null matching', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        match: {
          parentId: null,
        },
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toBe('parentId IS NULL');
  });

  it('should build condition SQL for expressions', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        expression: "amount > 1000 AND currency_code = 'USD'",
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toBe("(amount > 1000 AND currency_code = 'USD')");
  });

  it('should combine multiple condition types', () => {
    const rule: PostingRuleDefinition = {
      ...createBasicRule(),
      when: {
        lineType: 'PRODUCT',
        match: { status: 'SHIPPED' },
        expression: 'quantity > 0',
      },
    };

    const parsed = parsePostingRule(rule, defaults, metadata);

    expect(parsed[0]?.conditionSql).toContain("line_type IN ('PRODUCT')");
    expect(parsed[0]?.conditionSql).toContain("status = 'SHIPPED'");
    expect(parsed[0]?.conditionSql).toContain('(quantity > 0)');
    expect(parsed[0]?.conditionSql).toContain(' AND ');
  });
});

// ============================================================================
// parsePostingRuleSet Tests
// ============================================================================

describe('parsePostingRuleSet', () => {
  it('should parse an entire rule set', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [createBasicRule()],
    };

    const parsed = parsePostingRuleSet(ruleSet);

    expect(parsed).toHaveLength(2); // One rule with debit + credit
  });

  it('should parse multiple rules', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        { ...createBasicRule(), id: 'RULE_1', name: 'Rule 1' },
        { ...createBasicRule(), id: 'RULE_2', name: 'Rule 2' },
      ],
    };

    const parsed = parsePostingRuleSet(ruleSet);

    expect(parsed).toHaveLength(4); // Two rules with debit + credit each
  });

  it('should apply rule set defaults', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      defaults: {
        subsidiaryId: 'GLOBAL',
        isActive: false,
      },
      rules: [
        {
          ...createBasicRule(),
          // No subsidiary or active override
        },
      ],
    };

    const parsed = parsePostingRuleSet(ruleSet);

    expect(parsed[0]?.subsidiaryId).toBe('GLOBAL');
    expect(parsed[0]?.isActive).toBe(false);
  });

  it('should use metadata effective date as fallback', () => {
    const ruleSet: PostingRuleSetConfig = {
      metadata: {
        name: 'Test',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
        expirationDate: '2025-12-31',
      },
      rules: [createBasicRule()],
    };

    const parsed = parsePostingRuleSet(ruleSet);

    expect(parsed[0]?.effectiveDate).toEqual(new Date('2024-01-01'));
    expect(parsed[0]?.expirationDate).toEqual(new Date('2025-12-31'));
  });
});

// ============================================================================
// validatePostingRuleSet Tests
// ============================================================================

describe('validatePostingRuleSet', () => {
  it('should pass validation for a valid rule set', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [createBasicRule()],
    };

    const errors = validatePostingRuleSet(ruleSet);

    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should fail validation when metadata name is missing', () => {
    const ruleSet: PostingRuleSetConfig = {
      metadata: {
        name: '',
        version: '1.0.0',
        effectiveDate: '2024-01-01',
      },
      rules: [],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'metadata',
        field: 'name',
        severity: 'error',
      })
    );
  });

  it('should fail validation when effective date is missing', () => {
    const ruleSet: PostingRuleSetConfig = {
      metadata: {
        name: 'Test',
        version: '1.0.0',
        effectiveDate: '',
      },
      rules: [],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'metadata',
        field: 'effectiveDate',
        severity: 'error',
      })
    );
  });

  it('should fail validation for duplicate rule IDs', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        { ...createBasicRule(), id: 'DUPLICATE' },
        { ...createBasicRule(), id: 'DUPLICATE' },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'DUPLICATE',
        field: 'id',
        message: 'Duplicate rule ID: DUPLICATE',
        severity: 'error',
      })
    );
  });

  it('should fail validation when rule ID is missing', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: '',
          name: 'Test Rule',
          transactionType: 'INVOICE',
          post: [
            { side: 'debit', account: '1100', amount: 100 },
            { side: 'credit', account: '4000', amount: 100 },
          ],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'id',
        message: 'Rule ID is required',
        severity: 'error',
      })
    );
  });

  it('should fail validation when rule name is missing', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: 'TEST',
          name: '',
          transactionType: 'INVOICE',
          post: [
            { side: 'debit', account: '1100', amount: 100 },
            { side: 'credit', account: '4000', amount: 100 },
          ],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'TEST',
        field: 'name',
        message: 'Rule name is required',
        severity: 'error',
      })
    );
  });

  it('should fail validation when transaction type is missing', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: 'TEST',
          name: 'Test Rule',
          transactionType: '',
          post: [
            { side: 'debit', account: '1100', amount: 100 },
            { side: 'credit', account: '4000', amount: 100 },
          ],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'TEST',
        field: 'transactionType',
        message: 'Transaction type is required',
        severity: 'error',
      })
    );
  });

  it('should fail validation when posting actions are empty', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: 'TEST',
          name: 'Test Rule',
          transactionType: 'INVOICE',
          post: [],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'TEST',
        field: 'post',
        message: 'At least one posting action is required',
        severity: 'error',
      })
    );
  });

  it('should warn when rule has only debits (no credits)', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: 'DEBIT_ONLY',
          name: 'Debit Only Rule',
          transactionType: 'INVOICE',
          post: [{ side: 'debit', account: '1100', amount: 100 }],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'DEBIT_ONLY',
        field: 'post',
        severity: 'warning',
      })
    );
  });

  it('should warn when rule has only credits (no debits)', () => {
    const ruleSet: PostingRuleSetConfig = {
      ...createMinimalRuleSet(),
      rules: [
        {
          id: 'CREDIT_ONLY',
          name: 'Credit Only Rule',
          transactionType: 'INVOICE',
          post: [{ side: 'credit', account: '4000', amount: 100 }],
        },
      ],
    };

    const errors = validatePostingRuleSet(ruleSet);

    expect(errors).toContainEqual(
      expect.objectContaining({
        ruleId: 'CREDIT_ONLY',
        field: 'post',
        severity: 'warning',
      })
    );
  });
});

// ============================================================================
// Standard Rule Set Validation Tests
// ============================================================================

describe('Standard Rule Sets', () => {
  it('should validate revenueRecognitionRules without errors', async () => {
    const { revenueRecognitionRules } = await import('../posting-rules-examples.js');
    const errors = validatePostingRuleSet(revenueRecognitionRules);
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should validate orderToCashRules without errors', async () => {
    const { orderToCashRules } = await import('../posting-rules-examples.js');
    const errors = validatePostingRuleSet(orderToCashRules);
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should validate procureToPayRules without errors', async () => {
    const { procureToPayRules } = await import('../posting-rules-examples.js');
    const errors = validatePostingRuleSet(procureToPayRules);
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should validate multiCurrencyRules without errors', async () => {
    const { multiCurrencyRules } = await import('../posting-rules-examples.js');
    const errors = validatePostingRuleSet(multiCurrencyRules);
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should validate periodEndRules without errors', async () => {
    const { periodEndRules } = await import('../posting-rules-examples.js');
    const errors = validatePostingRuleSet(periodEndRules);
    const criticalErrors = errors.filter((e) => e.severity === 'error');
    expect(criticalErrors).toHaveLength(0);
  });

  it('should parse all standard rule sets without throwing', async () => {
    const { getAllStandardRules } = await import('../posting-rules-examples.js');
    const allRuleSets = getAllStandardRules();

    expect(() => {
      for (const ruleSet of allRuleSets) {
        parsePostingRuleSet(ruleSet);
      }
    }).not.toThrow();
  });
});
