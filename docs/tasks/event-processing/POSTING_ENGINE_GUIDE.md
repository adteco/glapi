# Posting Engine & Chart-of-Accounts Guide (glapi-z5t)

## Overview

This document describes the posting engine configuration system, including the posting rules DSL and chart-of-accounts setup.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Posting Engine Flow                               │
│                                                                      │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────────────┐│
│  │ Business    │──▶│ Posting      │──▶│ GL Transaction + Lines     ││
│  │ Transaction │   │ Rules Engine │   │ (Double-entry validated)   ││
│  └─────────────┘   └──────────────┘   └────────────────────────────┘│
│         │                  │                        │               │
│         │                  ▼                        │               │
│         │         ┌──────────────┐                  │               │
│         │         │ gl_posting_  │                  │               │
│         └────────▶│ rules table  │                  │               │
│                   └──────────────┘                  │               │
│                                                     ▼               │
│                                          ┌────────────────────────┐ │
│                                          │ gl-posting-engine.ts   │ │
│                                          │ (Validation)           │ │
│                                          └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Posting Rules DSL

### What is the DSL?

The Posting Rules DSL is a human-readable format for defining how business transactions should be posted to the general ledger. Instead of writing SQL or database records directly, you define rules in a structured TypeScript/JSON format.

### Basic Structure

```typescript
import { PostingRuleSetConfig } from '@glapi/business/config';

const myRules: PostingRuleSetConfig = {
  metadata: {
    name: 'My Posting Rules',
    version: '1.0.0',
    effectiveDate: '2024-01-01',
  },
  rules: [
    {
      id: 'INVOICE_STANDARD',
      name: 'Standard Invoice Posting',
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
    },
  ],
};
```

### Rule Components

#### 1. Metadata

```typescript
metadata: {
  name: string;           // Rule set name
  version: string;        // Semantic version
  description?: string;   // Optional description
  baseCurrency?: string;  // Default currency
  effectiveDate: string;  // When rules take effect (ISO date)
  expirationDate?: string; // Optional end date
}
```

#### 2. Transaction Type

```typescript
// Simple: just the type code
transactionType: 'INVOICE'

// With line type filter
transactionType: {
  code: 'SHIPMENT',
  lineType: 'PRODUCT'
}
```

#### 3. Conditions

```typescript
when: {
  // Line type filter
  lineType: 'SUBSCRIPTION' | ['TYPE1', 'TYPE2'],

  // Simple field matching
  match: {
    status: 'APPROVED',
    amount: 1000,
    isRecurring: true,
  },

  // SQL expression for complex logic
  expression: 'amount > 1000 AND currency_code = \'USD\''
}
```

#### 4. Account References

```typescript
// Direct account number
account: '1100'

// Default account mapping
account: { default: 'accountsReceivable' }

// From transaction field
account: { field: 'revenueAccountId' }

// From configuration
account: { config: 'defaultCashAccount' }
```

#### 5. Amount References

```typescript
// Fixed amount
amount: 100.00

// From transaction field
amount: { field: 'lineAmount' }

// Use line amount directly
amount: { lineAmount: true }

// Formula
amount: { formula: 'quantity * unit_price * (1 - discount_rate)' }
```

#### 6. Description Templates

```typescript
// Simple string
description: 'Revenue recognition entry'

// Template with variables
description: {
  template: 'Invoice {{invoiceNumber}} - {{customerName}}',
  fallback: 'Invoice posting'
}
```

### Standard Rule Sets

The system includes pre-configured rule sets for common scenarios:

| Rule Set | Description |
|----------|-------------|
| `revenueRecognitionRules` | ASC 606 compliant revenue recognition |
| `orderToCashRules` | Sales, shipments, credit memos |
| `procureToPayRules` | Purchasing, receiving, vendor bills |
| `multiCurrencyRules` | FX gain/loss handling |
| `periodEndRules` | Depreciation, accruals, closing |

### Loading Rules

```typescript
import { parsePostingRuleSet, validatePostingRuleSet } from '@glapi/business/config';
import { revenueRecognitionRules } from '@glapi/business/config';

// Validate the rule set
const errors = validatePostingRuleSet(revenueRecognitionRules);
if (errors.some(e => e.severity === 'error')) {
  throw new Error('Invalid rule set');
}

// Parse to database format
const parsedRules = parsePostingRuleSet(revenueRecognitionRules);

// Insert into gl_posting_rules table
for (const rule of parsedRules) {
  await db.insert(glPostingRules).values({
    ruleName: rule.ruleName,
    transactionTypeId: await getTransactionTypeId(rule.transactionTypeCode),
    // ... other fields
  });
}
```

## Chart of Accounts

### Structure

The chart of accounts is defined in `packages/business/src/chart-of-accounts/`:

- `types.ts` - Type definitions for accounts
- `templates.ts` - Pre-configured chart templates

### Account Categories

| Category | Normal Balance | Account Range |
|----------|---------------|---------------|
| Assets | Debit | 1000-1999 |
| Liabilities | Credit | 2000-2999 |
| Equity | Credit | 3000-3999 |
| Revenue | Credit | 4000-4999 |
| Expenses | Debit | 5000-9999 |

### Default Account Mappings

Every chart of accounts should define these default mappings:

```typescript
const defaultAccounts: DefaultAccountMappings = {
  accountsReceivable: '1100',
  accountsPayable: '2000',
  deferredRevenue: '2200',
  revenue: '4000',
  costOfGoodsSold: '5000',
  inventory: '1300',
  cash: '1000',
  retainedEarnings: '3200',
  fxGainLoss: '7500',
  roundingAdjustment: '7900',
  suspense: '9999',
};
```

## Double-Entry Validation

The posting engine validates all journal entries using the `GlPostingEngine` class:

### Validation Rules

1. **Balance Check**: Total debits must equal total credits
2. **Minimum Lines**: At least 2 lines required
3. **Debit/Credit Required**: Must have at least one debit and one credit
4. **No Negative Amounts**: All amounts must be positive
5. **Single-Sided Lines**: Each line can only have debit OR credit, not both
6. **FX Validation**: Exchange rates must be valid, base amounts must balance

### Tolerance

A small tolerance (default 0.01) allows for rounding differences:

```typescript
const validationOptions = {
  tolerance: 0.01,
  requireBothSides: true,
  validateFxRates: true,
};
```

## Examples

### Revenue Recognition

```typescript
// When a subscription invoice is created:
// DR: Accounts Receivable    $1,200
// CR: Deferred Revenue       $1,200

// Each month (1/12 of annual subscription):
// DR: Deferred Revenue       $100
// CR: Revenue                $100
```

### Inventory Purchase

```typescript
// When goods are received:
// DR: Inventory              $5,000
// CR: AP Accrual             $5,000

// When vendor bill arrives:
// DR: AP Accrual             $5,000
// CR: Accounts Payable       $5,000

// When bill is paid:
// DR: Accounts Payable       $5,000
// CR: Cash                   $5,000
```

### Multi-Currency FX Gain

```typescript
// Invoice created (EUR 1,000 @ 1.10 = $1,100):
// DR: Accounts Receivable    $1,100
// CR: Revenue                $1,100

// Payment received (EUR 1,000 @ 1.15 = $1,150):
// DR: Cash                   $1,150
// CR: Accounts Receivable    $1,100
// CR: FX Gain                $50
```

## Testing

### Unit Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { GlPostingEngine } from '@glapi/api-service';

describe('Posting Engine', () => {
  it('should validate balanced journal entry', async () => {
    const engine = new GlPostingEngine();

    const entry = {
      lines: [
        { accountId: '1100', debitAmount: 1000, creditAmount: 0 },
        { accountId: '4000', debitAmount: 0, creditAmount: 1000 },
      ],
    };

    const result = await engine.validateDoubleEntry(entry);
    expect(result.isValid).toBe(true);
  });

  it('should reject unbalanced entry', async () => {
    const engine = new GlPostingEngine();

    const entry = {
      lines: [
        { accountId: '1100', debitAmount: 1000, creditAmount: 0 },
        { accountId: '4000', debitAmount: 0, creditAmount: 900 },
      ],
    };

    const result = await engine.validateDoubleEntry(entry);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'UNBALANCED_TRANSACTION' })
    );
  });
});
```

## Related Files

| File | Purpose |
|------|---------|
| `packages/business/src/config/posting-rules-dsl.ts` | DSL types and parser |
| `packages/business/src/config/posting-rules-examples.ts` | Standard rule sets |
| `packages/business/src/chart-of-accounts/types.ts` | CoA type definitions |
| `packages/api-service/src/services/gl-posting-engine.ts` | Validation engine |
| `packages/database/src/db/schema/gl-transactions.ts` | Database schemas |

---

*Author: OliveWolf*
*Task: glapi-z5t*
*Created: 2026-01-12*
