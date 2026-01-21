# WIP Reconciliation Guide

This guide provides step-by-step procedures for reconciling Work-in-Progress (WIP) reports to the General Ledger and troubleshooting percent-complete variances in construction accounting.

## Table of Contents

1. [Overview](#overview)
2. [WIP Calculation Methodology](#wip-calculation-methodology)
3. [Reconciliation Process](#reconciliation-process)
4. [Troubleshooting Variances](#troubleshooting-variances)
5. [Close Checklist Integration](#close-checklist-integration)
6. [Sample Reconciliation](#sample-reconciliation)

---

## Overview

### What is WIP Reconciliation?

WIP (Work-in-Progress) reconciliation ensures that the amounts reported in your construction project reports tie back to the General Ledger. This process verifies:

- **Underbillings** (costs incurred > billings) are accurately reflected as assets
- **Overbillings** (billings > costs incurred) are accurately reflected as liabilities
- **Retainage** balances match receivable/payable ledger accounts
- **Percent complete** calculations align with recognized revenue

### Key Accounts to Reconcile

| Account Type | Description | GL Account Category |
|-------------|-------------|---------------------|
| Costs in Excess of Billings (CEB) | Underbillings asset | Current Assets |
| Billings in Excess of Costs (BEC) | Overbillings liability | Current Liabilities |
| Retainage Receivable | Amounts held by owner | Current Assets |
| Retainage Payable | Amounts held from subcontractors | Current Liabilities |
| Contract Receivables | Billed amounts not yet collected | Accounts Receivable |
| WIP Inventory | Accumulated project costs | Inventory/WIP |

---

## WIP Calculation Methodology

### Underbillings / Overbillings Calculation

```
WIP Balance = Total Actual Costs - Total Billings Issued

If WIP Balance > 0:
  → Underbilling (Asset): Costs exceed billings
  → Shows as "Costs in Excess of Billings" on Balance Sheet

If WIP Balance < 0:
  → Overbilling (Liability): Billings exceed costs
  → Shows as "Billings in Excess of Costs" on Balance Sheet
```

### Percent Complete Calculation (Cost-to-Cost Method)

```
Percent Complete = (Actual Cost to Date / Total Estimated Cost at Completion) × 100

Where:
  - Actual Cost to Date = Sum of all posted costs (Labor + Material + Equipment + Subcontract + Other)
  - Total Estimated Cost at Completion = Original Budget + Approved Changes + Estimated Cost to Complete
```

### Earned Value Calculation

```
Earned Value = Contract Value × Percent Complete

Revenue to Recognize = Earned Value - Previously Recognized Revenue
```

### Cost Performance Index (CPI)

```
CPI = Earned Value / Actual Cost

CPI > 1.0 → Under budget (favorable)
CPI < 1.0 → Over budget (unfavorable)
CPI = 1.0 → On budget
```

---

## Reconciliation Process

### Step 1: Refresh Materialized Views

Before beginning reconciliation, ensure the WIP materialized views are current:

```sql
-- Refresh all WIP views with logging
SELECT * FROM refresh_wip_views_with_logging('month-end-close');

-- Verify last refresh time
SELECT view_name, MAX(completed_at) as last_refresh
FROM materialized_view_refresh_log
WHERE completed_at IS NOT NULL
GROUP BY view_name;
```

Or via the UI:
1. Navigate to Reports → Construction → WIP Analysis
2. Click the refresh icon in the header
3. Verify the "Last refreshed" timestamp

### Step 2: Export WIP Summary

1. Go to Reports → Construction → WIP Analysis
2. Select the appropriate subsidiary filter if needed
3. Click "Export CSV" on the WIP Analysis tab
4. Save the file for reconciliation workpaper

### Step 3: Pull GL Trial Balance

Export the trial balance for WIP-related accounts:

```sql
-- Get GL balances for WIP accounts
SELECT
  a.account_number,
  a.account_name,
  SUM(CASE WHEN gl.debit > 0 THEN gl.debit ELSE 0 END) as total_debits,
  SUM(CASE WHEN gl.credit > 0 THEN gl.credit ELSE 0 END) as total_credits,
  SUM(COALESCE(gl.debit, 0) - COALESCE(gl.credit, 0)) as balance
FROM gl_transactions gl
JOIN accounts a ON a.id = gl.account_id
WHERE a.account_type IN ('ASSET', 'LIABILITY')
  AND (a.account_name ILIKE '%WIP%'
       OR a.account_name ILIKE '%billings%excess%'
       OR a.account_name ILIKE '%costs%excess%'
       OR a.account_name ILIKE '%retainage%')
  AND gl.posting_date <= '2026-01-31' -- Period end date
GROUP BY a.account_number, a.account_name
ORDER BY a.account_number;
```

### Step 4: Create Reconciliation Worksheet

| Description | WIP Report | GL Balance | Variance | Notes |
|-------------|------------|------------|----------|-------|
| Total Underbillings | $XXX,XXX | $XXX,XXX | $X,XXX | |
| Total Overbillings | $XXX,XXX | $XXX,XXX | $X,XXX | |
| Retainage Receivable | $XXX,XXX | $XXX,XXX | $X,XXX | |
| Retainage Payable | $XXX,XXX | $XXX,XXX | $X,XXX | |

### Step 5: Investigate Variances

For each variance identified:

1. **Timing Differences**: Check for transactions posted after the report refresh
2. **Classification Errors**: Verify account assignments on transactions
3. **Missing Postings**: Look for unposted journal entries
4. **Calculation Differences**: Confirm methodology matches between systems

---

## Troubleshooting Variances

### Common Variance Causes

#### 1. Underbillings Don't Match GL

**Symptoms**: WIP report underbillings total differs from "Costs in Excess of Billings" GL balance

**Investigation Steps**:
```sql
-- Find projects with underbillings
SELECT
  p.project_code,
  p.name,
  ws.underbillings as wip_underbillings
FROM project_wip_summary ws
JOIN projects p ON p.id = ws.project_id
WHERE ws.underbillings > 0
ORDER BY ws.underbillings DESC;

-- Compare to GL postings by project
SELECT
  p.project_code,
  SUM(CASE WHEN a.account_name ILIKE '%costs%excess%' THEN gl.amount ELSE 0 END) as gl_ceb
FROM gl_transactions gl
JOIN projects p ON p.id = gl.project_id
JOIN accounts a ON a.id = gl.account_id
GROUP BY p.project_code;
```

**Common Causes**:
- Costs posted without corresponding WIP clearing entry
- Billing adjustments not reflected in WIP
- Intercompany transactions not eliminated

#### 2. Percent Complete Variance

**Symptoms**: Percent complete on WIP report differs from revenue recognition schedule

**Investigation Steps**:
```sql
-- Compare percent complete methods
SELECT
  pc.project_code,
  pc.cost_percent_complete as cost_method_pct,
  CASE
    WHEN bv.total_budget_amount > 0
    THEN (pc.actual_cost / bv.total_budget_amount) * 100
    ELSE 0
  END as calculated_pct,
  pc.last_snapshot_date,
  pc.snapshot_percent_complete as manual_override_pct
FROM project_percent_complete pc
JOIN project_budget_versions bv ON bv.project_id = pc.project_id AND bv.is_current = true;
```

**Common Causes**:
- Budget changes not approved/applied
- Manual percent complete override not updated
- Cost reclassifications between periods

#### 3. Retainage Aging Mismatch

**Symptoms**: Retainage aging buckets don't match AR aging report

**Investigation Steps**:
```sql
-- Verify retainage calculation
SELECT
  ra.project_code,
  ra.total_retainage_held,
  ra.retainage_current + ra.retainage_30_days + ra.retainage_60_days +
    ra.retainage_90_days + ra.retainage_over_90 as aging_total,
  ra.retainage_outstanding
FROM project_retainage_aging ra
WHERE ra.total_retainage_held != (
  ra.retainage_current + ra.retainage_30_days + ra.retainage_60_days +
  ra.retainage_90_days + ra.retainage_over_90
);
```

**Common Causes**:
- Released retainage not recorded
- Retainage percentage changes mid-project
- Aging bucket calculation date misalignment

### Variance Resolution Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Variance Identified                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Is variance due to timing (post-refresh transactions)?        │
│  → Refresh views and re-check                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    No variance remains?
                    │                   │
                   Yes                  No
                    │                   │
                    ▼                   ▼
            ┌───────────┐    ┌─────────────────────────────────┐
            │   Done    │    │ Is variance due to missing      │
            └───────────┘    │ journal entries?                │
                             │ → Post adjusting entries        │
                             └─────────────────────────────────┘
                                            │
                                   No variance remains?
                                   │                   │
                                  Yes                  No
                                   │                   │
                                   ▼                   ▼
                           ┌───────────┐   ┌──────────────────────┐
                           │   Done    │   │ Escalate to          │
                           └───────────┘   │ Controller/Manager   │
                                           └──────────────────────┘
```

---

## Close Checklist Integration

### Month-End Close WIP Checklist

Add these items to your month-end close checklist:

```markdown
## WIP Reconciliation Tasks

### Pre-Close (Day -2)
- [ ] Review open pay applications for period cutoff
- [ ] Verify all cost postings are complete
- [ ] Review pending budget change orders

### Close (Day 0)
- [ ] Refresh WIP materialized views
- [ ] Export WIP summary report
- [ ] Export retainage aging report
- [ ] Pull GL trial balance for WIP accounts

### Reconciliation (Day +1)
- [ ] Complete WIP reconciliation worksheet
- [ ] Document and investigate variances > $X,XXX
- [ ] Post adjusting entries if needed
- [ ] Re-refresh views after adjustments
- [ ] Final tie-out verification

### Sign-off (Day +2)
- [ ] Controller review and approval
- [ ] Archive reconciliation workpapers
- [ ] Update close management tracker
```

### Automated Close Tasks

The close management system can trigger WIP reconciliation tasks:

```typescript
// Example: Auto-create WIP reconciliation task on period close
const closeTask = await closeManagementService.createTask({
  periodId: currentPeriod.id,
  taskType: 'WIP_RECONCILIATION',
  title: 'WIP Report to GL Reconciliation',
  assignedTo: controllerId,
  dueDate: addDays(periodEndDate, 2),
  dependencies: ['COST_POSTING_COMPLETE', 'BILLING_CUTOFF_COMPLETE'],
  checklist: [
    'Refresh materialized views',
    'Export WIP summary CSV',
    'Complete reconciliation worksheet',
    'Document variances',
    'Post adjusting entries',
    'Final verification'
  ]
});
```

---

## Sample Reconciliation

### Example Project: Office Tower Construction

**Project Details:**
- Contract Value: $5,000,000
- Original Budget: $4,200,000
- Approved Changes: $150,000
- Current Budget: $4,350,000

**As of January 31, 2026:**

| Metric | Amount |
|--------|--------|
| Actual Costs to Date | $1,740,000 |
| Billings to Date | $1,600,000 |
| Retainage Held (10%) | $160,000 |
| Collections to Date | $1,300,000 |

**Calculations:**

```
Percent Complete = $1,740,000 / $4,350,000 = 40%

Earned Value = $5,000,000 × 40% = $2,000,000

WIP Balance = $1,740,000 - $1,600,000 = $140,000 (Underbilling)

CPI = $2,000,000 / $1,740,000 = 1.15 (Under budget)
```

**Reconciliation Worksheet:**

| Account | WIP Report | GL Balance | Variance | Status |
|---------|------------|------------|----------|--------|
| Costs in Excess of Billings | $140,000 | $140,000 | $0 | ✓ Tied |
| Contract Receivables | $300,000 | $300,000 | $0 | ✓ Tied |
| Retainage Receivable | $160,000 | $160,000 | $0 | ✓ Tied |
| WIP Inventory | $1,740,000 | $1,740,000 | $0 | ✓ Tied |

**Reconciliation Notes:**
- All accounts tied without variance
- Retainage calculation verified: $1,600,000 × 10% = $160,000
- Receivables verified: $1,600,000 - $160,000 - $1,140,000 collected = $300,000
- CPI of 1.15 indicates project tracking under budget

---

## Related Documentation

- [Billing Schedule Service](/docs/services/billing-schedule-service.md)
- [Project Reporting Service](/docs/services/project-reporting-service.md)
- [Close Management Guide](/docs/close-management/overview.md)
- [GL Posting Engine](/docs/services/gl-posting-engine.md)

## Support

For questions about WIP reconciliation:
1. Check the troubleshooting section above
2. Review the close management runbook
3. Contact the implementation team for complex issues
