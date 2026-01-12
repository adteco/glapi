# Posting Engine Developer Guide

This guide explains how to configure and use the posting engine to generate balanced GL entries from business transactions.

## Overview

The posting engine provides:
- **Chart of Accounts Configuration**: Define account metadata with GAAP compliance
- **Posting Rules DSL**: Configure how transactions map to GL entries
- **Balance Validation**: Ensure all entries follow double-entry accounting

## Quick Start

### 1. Import the modules

```typescript
import {
  // Chart of Accounts
  getSaaSChartOfAccounts,
  createCustomChartOfAccounts,
  validateChartOfAccounts,
  AccountCategory,
  AccountSubcategory,

  // Posting Engine
  PostingRuleEngine,
  createPostingRuleEngine,
  createDefaultValidationSettings,
  TransactionType,
  LineType,
  ConditionOperator,
  ConditionField,
  AmountField,
} from '@glapi/business';
```

### 2. Get or create a Chart of Accounts

```typescript
// Use the standard SaaS template
const coa = getSaaSChartOfAccounts();

// Or create a custom chart
const customCoa = createCustomChartOfAccounts({
  name: 'My Company Chart',
  baseCurrency: 'EUR',
});

// Validate the chart
const validation = validateChartOfAccounts(coa);
if (!validation.valid) {
  console.error('Chart validation errors:', validation.errors);
}
```

### 3. Define Posting Rules

```typescript
import { PostingRuleSet, PostingRule } from '@glapi/business';

const invoiceRevenueRule: PostingRule = {
  id: 'rule-customer-invoice-revenue',
  name: 'Customer Invoice Revenue Recognition',
  transactionType: TransactionType.CUSTOMER_INVOICE,
  sequenceNumber: 10,
  debitAccountId: '1200',  // Accounts Receivable
  creditAccountId: '4000', // Revenue
  amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
  isActive: true,
  effectiveDate: '2024-01-01',
  priority: 100,
};

const ruleSet: PostingRuleSet = {
  id: 'my-rules-v1',
  organizationId: 'org-123',
  name: 'Standard Posting Rules',
  version: '1.0.0',
  rules: [invoiceRevenueRule],
  defaultDimensionRules: [],
  validationSettings: createDefaultValidationSettings(),
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### 4. Create the Engine and Evaluate Transactions

```typescript
const engine = createPostingRuleEngine(ruleSet);

const transaction = {
  id: 'txn-001',
  transactionNumber: 'INV-2024-001',
  transactionType: TransactionType.CUSTOMER_INVOICE,
  transactionDate: '2024-01-15',
  subsidiaryId: 'sub-001',
  currencyCode: 'USD',
  exchangeRate: 1.0,
  customerId: 'cust-123',
  totalAmount: 1500,
};

const lines = [
  {
    id: 'line-1',
    lineNumber: 1,
    lineType: LineType.ITEM,
    itemId: 'widget-001',
    description: 'Widget Pro License',
    quantity: 5,
    unitPrice: 200,
    amount: 1000,
  },
  {
    id: 'line-2',
    lineNumber: 2,
    lineType: LineType.SERVICE,
    description: 'Implementation Services',
    quantity: 1,
    unitPrice: 500,
    amount: 500,
  },
];

const result = engine.evaluate(transaction, lines);

if (result.validation.isBalanced) {
  console.log('Generated balanced GL entries:', result.lines);
} else {
  console.error('Validation errors:', result.validation.errors);
}
```

## Posting Rules DSL Reference

### Transaction Types

The DSL supports these transaction types:

| Type | Description |
|------|-------------|
| `CUSTOMER_INVOICE` | Customer invoices |
| `CUSTOMER_PAYMENT` | Payment receipts |
| `CREDIT_MEMO` | Credit memos |
| `VENDOR_BILL` | Vendor bills |
| `BILL_PAYMENT` | Bill payments |
| `SUBSCRIPTION_INVOICE` | Subscription invoices |
| `REVENUE_RECOGNITION` | Rev rec adjustments |
| `JOURNAL_ENTRY` | Manual GL entries |

### Line Types

| Type | Description |
|------|-------------|
| `ITEM` | Physical products |
| `SERVICE` | Services |
| `DISCOUNT` | Discounts |
| `TAX` | Tax lines |
| `SHIPPING` | Shipping charges |
| `ALL` | Match all line types |

### Conditions

Conditions control when rules apply:

#### Simple Conditions

```typescript
// Equal check
const condition = {
  type: 'simple',
  field: ConditionField.LINE_TYPE,
  operator: ConditionOperator.EQUALS,
  value: LineType.ITEM,
};

// Numeric comparison
const amountCondition = {
  type: 'simple',
  field: ConditionField.LINE_AMOUNT,
  operator: ConditionOperator.GREATER_THAN,
  value: 1000,
};

// IN operator for multiple values
const itemCondition = {
  type: 'simple',
  field: ConditionField.ITEM_ID,
  operator: ConditionOperator.IN,
  value: ['item-001', 'item-002', 'item-003'],
};

// NULL checks
const nullCondition = {
  type: 'simple',
  field: ConditionField.IS_BILLABLE,
  operator: ConditionOperator.IS_NULL,
  value: true,
};
```

#### Composite Conditions (AND/OR)

```typescript
// AND condition: all must be true
const andCondition = {
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
};

// OR condition: any can be true
const orCondition = {
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
      field: ConditionField.LINE_TYPE,
      operator: ConditionOperator.EQUALS,
      value: LineType.ITEM,
    },
  ],
};
```

### Amount Formulas

Control how amounts are calculated:

#### Field Reference

```typescript
// Use line amount directly
const formula = {
  type: 'field',
  field: AmountField.LINE_AMOUNT,
};
```

#### Constant Value

```typescript
const formula = {
  type: 'constant',
  value: 100,
};
```

#### Arithmetic Operations

```typescript
// Add tax to amount
const formula = {
  type: 'arithmetic',
  operator: '+',
  left: { type: 'field', field: AmountField.LINE_AMOUNT },
  right: { type: 'field', field: AmountField.LINE_TAX_AMOUNT },
};

// Calculate extended price
const extendedPrice = {
  type: 'arithmetic',
  operator: '*',
  left: { type: 'field', field: AmountField.LINE_QUANTITY },
  right: { type: 'field', field: AmountField.LINE_UNIT_PRICE },
};
```

#### Conditional Formulas

```typescript
// Use different amounts based on condition
const formula = {
  type: 'conditional',
  condition: {
    type: 'simple',
    field: ConditionField.LINE_AMOUNT,
    operator: ConditionOperator.GREATER_THAN,
    value: 1000,
  },
  ifTrue: { type: 'field', field: AmountField.LINE_AMOUNT },
  ifFalse: { type: 'constant', value: 0 },
};
```

### Dimension Inheritance

Control how dimensions flow from transaction to GL lines:

```typescript
const ruleWithDimensions: PostingRule = {
  id: 'rule-with-dims',
  name: 'Revenue with Dimensions',
  transactionType: TransactionType.CUSTOMER_INVOICE,
  sequenceNumber: 10,
  debitAccountId: '1200',
  creditAccountId: '4000',
  amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
  isActive: true,
  effectiveDate: '2024-01-01',
  priority: 100,
  dimensionRules: [
    {
      targetDimension: 'DEPARTMENT',
      source: { type: 'line', field: 'departmentId' },
      required: false,
      defaultValue: 'default-dept',
    },
    {
      targetDimension: 'PROJECT',
      source: { type: 'transaction', field: 'projectId' },
      required: false,
    },
    {
      targetDimension: 'CUSTOMER',
      source: { type: 'transaction', field: 'customerId' },
      required: true,
    },
  ],
};
```

## Multi-Currency Support

The engine handles multi-currency transactions automatically:

```typescript
const foreignTransaction = {
  id: 'txn-002',
  transactionNumber: 'INV-2024-002',
  transactionType: TransactionType.CUSTOMER_INVOICE,
  transactionDate: '2024-01-15',
  subsidiaryId: 'sub-001',
  currencyCode: 'EUR',
  exchangeRate: 1.10, // 1 EUR = 1.10 USD
  customerId: 'cust-eu-001',
  totalAmount: 1000, // EUR
};

const result = engine.evaluate(foreignTransaction, lines);

// GL lines will have both currency amounts:
// - debitAmount/creditAmount in EUR
// - baseDebitAmount/baseCreditAmount in USD (converted)
```

## Validation Settings

Configure validation behavior:

```typescript
const settings = {
  balanceTolerance: 0.01,        // Allow small rounding differences
  validateBaseAmounts: true,     // Validate base currency totals
  requireBothSides: true,        // Require debit and credit lines
  allowZeroAmountLines: false,   // Reject zero-amount lines
  validateFxRates: true,         // Validate exchange rates
  checkPeriodStatus: true,       // Check accounting period (when implemented)
  maxLinesPerTransaction: 1000,  // Maximum GL lines
};
```

## Error Handling

The engine provides detailed validation errors:

```typescript
const result = engine.evaluate(transaction, lines);

if (!result.validation.isBalanced) {
  for (const error of result.validation.errors) {
    switch (error.code) {
      case 'UNBALANCED_TRANSACTION':
        console.error('Transaction not balanced:', error.context);
        break;
      case 'MISSING_DEBIT_LINE':
        console.error('No debit lines generated');
        break;
      case 'MISSING_CREDIT_LINE':
        console.error('No credit lines generated');
        break;
      case 'NEGATIVE_AMOUNT':
        console.error('Negative amount on lines:', error.affectedLines);
        break;
      // Handle other error codes...
    }
  }
}
```

## Example: Complete Invoice Posting

```typescript
// Define multiple rules for invoice posting
const invoiceRules: PostingRule[] = [
  // Product revenue
  {
    id: 'rule-product-revenue',
    name: 'Product Revenue',
    transactionType: TransactionType.CUSTOMER_INVOICE,
    sequenceNumber: 10,
    lineType: LineType.ITEM,
    debitAccountId: '1200',  // AR
    creditAccountId: '4100', // Product Revenue
    amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
    isActive: true,
    effectiveDate: '2024-01-01',
    priority: 100,
  },
  // Service revenue
  {
    id: 'rule-service-revenue',
    name: 'Service Revenue',
    transactionType: TransactionType.CUSTOMER_INVOICE,
    sequenceNumber: 20,
    lineType: LineType.SERVICE,
    debitAccountId: '1200',  // AR
    creditAccountId: '4200', // Service Revenue
    amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
    isActive: true,
    effectiveDate: '2024-01-01',
    priority: 100,
  },
  // Tax
  {
    id: 'rule-tax',
    name: 'Sales Tax',
    transactionType: TransactionType.CUSTOMER_INVOICE,
    sequenceNumber: 30,
    lineType: LineType.TAX,
    debitAccountId: '1200',  // AR
    creditAccountId: '2200', // Sales Tax Payable
    amountFormula: { type: 'field', field: AmountField.LINE_AMOUNT },
    isActive: true,
    effectiveDate: '2024-01-01',
    priority: 100,
  },
];

// Create rule set and engine
const ruleSet: PostingRuleSet = {
  id: 'invoice-rules-v1',
  organizationId: 'org-123',
  name: 'Invoice Posting Rules',
  version: '1.0.0',
  rules: invoiceRules,
  defaultDimensionRules: [
    {
      targetDimension: 'CUSTOMER',
      source: { type: 'transaction', field: 'customerId' },
      required: true,
    },
    {
      targetDimension: 'DEPARTMENT',
      source: { type: 'line', field: 'departmentId' },
      required: false,
    },
  ],
  validationSettings: createDefaultValidationSettings(),
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const engine = createPostingRuleEngine(ruleSet);

// Process an invoice
const invoice = {
  id: 'inv-001',
  transactionNumber: 'INV-2024-100',
  transactionType: TransactionType.CUSTOMER_INVOICE,
  transactionDate: '2024-01-15',
  subsidiaryId: 'sub-001',
  currencyCode: 'USD',
  exchangeRate: 1.0,
  customerId: 'cust-123',
  departmentId: 'sales',
  totalAmount: 1100,
};

const invoiceLines = [
  {
    id: 'line-1',
    lineNumber: 1,
    lineType: LineType.ITEM,
    itemId: 'prod-001',
    description: 'Software License',
    quantity: 1,
    unitPrice: 1000,
    amount: 1000,
    departmentId: 'sales',
  },
  {
    id: 'line-2',
    lineNumber: 2,
    lineType: LineType.TAX,
    description: 'Sales Tax (10%)',
    quantity: 1,
    unitPrice: 100,
    amount: 100,
  },
];

const result = engine.evaluate(invoice, invoiceLines);

console.log('Applied rules:', result.appliedRules.map(r => r.ruleName));
console.log('Generated GL lines:', result.lines.length);
console.log('Balanced:', result.validation.isBalanced);
console.log('Total debits:', result.validation.totalDebits);
console.log('Total credits:', result.validation.totalCredits);
```

## Best Practices

1. **Always validate rule sets** before using them in production
2. **Use meaningful rule IDs** that include the transaction type
3. **Set appropriate sequence numbers** to control rule execution order
4. **Use line type filters** to separate product vs service revenue
5. **Configure dimension inheritance** for proper reporting segmentation
6. **Test with representative transactions** before going live
7. **Monitor validation warnings** for potential configuration issues
