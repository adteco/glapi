# Multi-Book Consolidation Guide

This guide provides step-by-step procedures for setting up and running consolidated financial statements across multiple subsidiaries.

## Table of Contents

1. [Overview](#overview)
2. [Setting Up Consolidation Groups](#setting-up-consolidation-groups)
3. [Configuring Elimination Rules](#configuring-elimination-rules)
4. [FX Translation Setup](#fx-translation-setup)
5. [Running Consolidations](#running-consolidations)
6. [Viewing Consolidated Reports](#viewing-consolidated-reports)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Multi-Book Consolidation?

Multi-book consolidation combines financial data from multiple legal entities (subsidiaries) into a single set of consolidated financial statements. This process involves:

- **Aggregating** financial data from all subsidiaries
- **Eliminating** intercompany transactions to avoid double-counting
- **Translating** foreign currency amounts to the reporting currency
- **Allocating** minority interest for partially-owned subsidiaries

### Key Concepts

| Term | Description |
|------|-------------|
| **Consolidation Group** | A defined set of subsidiaries to consolidate together |
| **Parent Subsidiary** | The holding company/parent entity |
| **Consolidation Currency** | The currency used for consolidated reporting (typically parent's functional currency) |
| **Elimination** | Removal of intercompany transactions and balances |
| **Translation** | Converting foreign subsidiary amounts to reporting currency |
| **Minority Interest** | The portion of equity and net income not owned by the parent |
| **CTA** | Cumulative Translation Adjustment - equity account for FX differences |

### Consolidation Methods

| Method | Ownership | Description |
|--------|-----------|-------------|
| **Full Consolidation** | >50% | Combine 100% of subsidiary, then calculate minority interest |
| **Proportional** | 20-50% | Include only owned percentage of each line item |
| **Equity Method** | 20-50% | Include share of net income as single line item |

---

## Setting Up Consolidation Groups

### Step 1: Create a Consolidation Group

```typescript
// Via TRPC
const group = await trpc.consolidation.createGroup.mutate({
  organizationId: 'your-org-id',
  name: 'Global Consolidation',
  code: 'GLOBAL-CONSOL',
  description: 'Primary consolidation group',
  parentSubsidiaryId: 'parent-subsidiary-uuid',
  consolidationCurrencyId: 'usd-currency-uuid',
  translationMethod: 'CURRENT_RATE', // or 'TEMPORAL', 'MONETARY_NONMONETARY'
  effectiveDate: '2025-01-01',
});
```

### Step 2: Add Subsidiaries to the Group

```typescript
// Add each subsidiary as a member
await trpc.consolidation.addGroupMember.mutate({
  groupId: 'group-uuid',
  subsidiaryId: 'subsidiary-uuid',
  ownershipPercent: 80, // Parent owns 80%
  consolidationMethod: 'FULL', // or 'PROPORTIONAL', 'EQUITY'
  minorityInterestAccountId: 'minority-interest-account-uuid',
  effectiveDate: '2025-01-01',
  sequenceNumber: 1, // Order of processing
});
```

### Step 3: Verify Group Configuration

```typescript
// Get group summary
const summary = await trpc.consolidation.getGroupSummary.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
});

console.log(`Members: ${summary.memberCount}`);
console.log(`Elimination Rules: ${summary.eliminationRuleCount}`);
```

---

## Configuring Elimination Rules

### Common Elimination Types

| Type | Description | Example |
|------|-------------|---------|
| `INTERCOMPANY_RECEIVABLE` | AR/AP between subsidiaries | Sub A owes Sub B $10,000 |
| `INTERCOMPANY_REVENUE` | Sales/purchases between subsidiaries | Sub A sells goods to Sub B |
| `INTERCOMPANY_INVESTMENT` | Parent's investment in subsidiary | Parent's shares in Sub |
| `INTERCOMPANY_DIVIDEND` | Dividends from subsidiary to parent | Sub pays dividend to Parent |
| `UNREALIZED_PROFIT` | Profit on intercompany inventory | Markup on goods not yet sold externally |

### Creating Elimination Rules

```typescript
// Intercompany AR/AP Elimination
await trpc.consolidation.createEliminationRule.mutate({
  groupId: 'group-uuid',
  name: 'IC Receivable/Payable Elimination',
  eliminationType: 'INTERCOMPANY_RECEIVABLE',
  description: 'Eliminates intercompany AR against corresponding AP',
  sourceAccountId: 'ic-receivable-account-uuid',
  targetAccountId: 'ic-payable-account-uuid',
  eliminationDebitAccountId: 'elimination-entry-account-uuid',
  eliminationCreditAccountId: 'elimination-entry-account-uuid',
  isAutomatic: true,
  effectiveDate: '2025-01-01',
  sequenceNumber: 10, // Lower numbers run first
});

// Intercompany Revenue/Expense Elimination
await trpc.consolidation.createEliminationRule.mutate({
  groupId: 'group-uuid',
  name: 'IC Revenue/Expense Elimination',
  eliminationType: 'INTERCOMPANY_REVENUE',
  description: 'Eliminates intercompany sales against corresponding purchases',
  sourceAccountId: 'ic-revenue-account-uuid',
  targetAccountId: 'ic-expense-account-uuid',
  eliminationDebitAccountId: 'elimination-entry-account-uuid',
  eliminationCreditAccountId: 'elimination-entry-account-uuid',
  isAutomatic: true,
  effectiveDate: '2025-01-01',
  sequenceNumber: 20,
});
```

### Intercompany Account Mappings

For automatic matching of intercompany transactions:

```typescript
await trpc.consolidation.createIntercompanyMapping.mutate({
  organizationId: 'your-org-id',
  name: 'IC Receivable to IC Payable',
  sourceAccountId: 'ic-receivable-account-uuid',
  targetAccountId: 'ic-payable-account-uuid',
  eliminationDebitAccountId: 'elimination-entry-uuid',
  eliminationCreditAccountId: 'elimination-entry-uuid',
});
```

---

## FX Translation Setup

### Translation Methods

| Method | Assets/Liabilities | Equity | Income/Expense |
|--------|-------------------|--------|----------------|
| **Current Rate** | Period-end rate | Historical rate | Average rate |
| **Temporal** | Based on account type | Historical | Based on account type |
| **Monetary/Non-Monetary** | Monetary: current; Non-monetary: historical | Historical | Average |

### Setting Up Exchange Rates

```typescript
// Current (period-end) rate
await trpc.consolidation.upsertExchangeRate.mutate({
  organizationId: 'your-org-id',
  fromCurrencyId: 'eur-uuid',
  toCurrencyId: 'usd-uuid',
  periodId: 'period-uuid',
  rateType: 'CURRENT',
  rate: 1.0850, // 1 EUR = 1.0850 USD
  rateDate: '2025-01-31',
  source: 'ECB',
});

// Average rate for income statement
await trpc.consolidation.upsertExchangeRate.mutate({
  organizationId: 'your-org-id',
  fromCurrencyId: 'eur-uuid',
  toCurrencyId: 'usd-uuid',
  periodId: 'period-uuid',
  rateType: 'AVERAGE',
  rate: 1.0725,
  rateDate: '2025-01-31',
  source: 'ECB',
});
```

### CTA (Cumulative Translation Adjustment)

The CTA account captures the difference between:
- Translating assets/liabilities at period-end rate
- Translating equity at historical rates
- Translating income statement at average rate

This difference is posted to a separate equity account (CTA) in Other Comprehensive Income.

---

## Running Consolidations

### Step 1: Run a Preliminary Consolidation

```typescript
const result = await trpc.consolidation.runConsolidation.mutate({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  runType: 'PRELIMINARY',
  description: 'Q1 2025 preliminary consolidation',
});

console.log(`Run #${result.runNumber}: ${result.status}`);
console.log(`Subsidiaries processed: ${result.subsidiariesProcessed}`);
console.log(`Eliminations: ${result.eliminationsGenerated}`);
console.log(`FX adjustments: ${result.translationAdjustments}`);
```

### Step 2: Review Results

```typescript
// Get run details
const details = await trpc.consolidation.getConsolidationRunDetails.query({
  runId: result.runId,
});

// Review elimination summary
const eliminations = await trpc.consolidation.getEliminationSummary.query({
  runId: result.runId,
});

// Review translation summary
const translations = await trpc.consolidation.getTranslationSummary.query({
  runId: result.runId,
});
```

### Step 3: Run Final Consolidation

After verifying preliminary results:

```typescript
const finalResult = await trpc.consolidation.runConsolidation.mutate({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  runType: 'FINAL',
  description: 'Q1 2025 final consolidation',
});
```

### Reversing a Consolidation Run

If errors are found:

```typescript
const reversal = await trpc.consolidation.reverseConsolidationRun.mutate({
  runId: 'run-uuid',
});

console.log(`Reversal created: ${reversal.reversalRunId}`);
```

---

## Viewing Consolidated Reports

### Consolidated Balance Sheet

```typescript
const balanceSheet = await trpc.consolidation.getConsolidatedBalanceSheet.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  includeBreakdown: true, // Show subsidiary-level detail
});
```

### Consolidated Income Statement

```typescript
const incomeStatement = await trpc.consolidation.getConsolidatedIncomeStatement.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  includeBreakdown: true,
});
```

### Consolidated Trial Balance

```typescript
const trialBalance = await trpc.consolidation.getConsolidatedTrialBalance.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
});

// Verify it balances
console.log(`Balanced: ${trialBalance.totals.isBalanced}`);
```

### Filtering by Books/Entities

To view consolidated data for specific subsidiaries only:

```typescript
// Get available books
const books = await trpc.consolidation.getAvailableBooks.query({
  groupId: 'group-uuid',
});

// Filter to specific subsidiaries
const filteredReport = await trpc.consolidation.getConsolidatedBalanceSheet.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  bookFilter: ['subsidiary-1-uuid', 'subsidiary-2-uuid'],
});
```

### Exporting Data

```typescript
// Export as JSON
const jsonExport = await trpc.consolidation.exportConsolidationData.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  format: 'json',
});

// Export as CSV
const csvExport = await trpc.consolidation.exportConsolidationData.query({
  groupId: 'group-uuid',
  periodId: 'period-uuid',
  format: 'csv',
});
```

---

## Troubleshooting

### Common Issues

#### 1. Out-of-Balance Eliminations

**Symptom**: Consolidated trial balance doesn't balance

**Investigation**:
```typescript
const elimSummary = await trpc.consolidation.getEliminationSummary.query({
  runId: 'run-uuid',
});

// Check net impact - should sum to zero
const netImpact = elimSummary.reduce((sum, e) => sum + e.netImpact, 0);
if (Math.abs(netImpact) > 0.01) {
  console.log('Eliminations are out of balance!');
}
```

**Common Causes**:
- Intercompany balances don't match between subsidiaries
- Missing elimination rules for certain transaction types
- Timing differences in posting between subsidiaries

#### 2. Missing Exchange Rates

**Symptom**: Translation adjustments are zero or missing

**Investigation**:
```typescript
const rates = await trpc.consolidation.getExchangeRates.query({
  periodId: 'period-uuid',
});

// Check all needed currency pairs have rates
```

**Solution**: Add missing exchange rates before running consolidation

#### 3. Minority Interest Calculation Issues

**Symptom**: Minority interest amount seems incorrect

**Investigation**:
- Verify ownership percentages are correct in group members
- Check that minority interest account is configured
- Ensure consolidation method is set correctly (FULL vs PROPORTIONAL)

### Consolidation Checklist

```markdown
## Pre-Consolidation Checklist

### Data Preparation
- [ ] All subsidiaries have closed their period
- [ ] Intercompany balances have been reconciled
- [ ] Exchange rates are entered for all currency pairs
- [ ] Elimination rules are configured and active

### Consolidation Run
- [ ] Run preliminary consolidation
- [ ] Review elimination journal entries
- [ ] Review translation adjustments
- [ ] Verify trial balance is balanced
- [ ] Review minority interest calculations

### Post-Consolidation
- [ ] Run final consolidation
- [ ] Generate consolidated financial statements
- [ ] Review comparative periods
- [ ] Export for external reporting
- [ ] Archive consolidation workpapers
```

---

## Related Documentation

- [GL Posting Engine](/docs/services/gl-posting-engine.md)
- [Financial Statements Service](/docs/services/financial-statements-service.md)
- [Accounting Periods](/docs/services/accounting-period-service.md)
- [Close Management Guide](/docs/close-management/overview.md)

## Support

For questions about consolidation:
1. Review this guide and the troubleshooting section
2. Check consolidation run logs for errors
3. Contact the implementation team for complex scenarios
