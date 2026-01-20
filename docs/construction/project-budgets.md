# Project Budgets - Construction Accounting

This document describes the project budget management system, including budget versioning, inline editing, variance tracking, and workflow states.

## Overview

Project budgets in GLAPI support version-controlled cost tracking with:
- Multiple budget versions per project
- Status-based workflow (Draft → Submitted → Approved → Locked)
- Inline editing for draft versions
- Real-time variance tracking (Budget vs Actual)
- Cost code integration

## Budget Version Lifecycle

### Status Flow

```
DRAFT → SUBMITTED → APPROVED → LOCKED
                          ↓
                    SUPERSEDED (when new version becomes current)
```

| Status | Description | Editing Allowed |
|--------|-------------|-----------------|
| DRAFT | Initial state, work in progress | Yes |
| SUBMITTED | Pending approval | No |
| APPROVED | Approved for use | No |
| LOCKED | Permanently frozen | No |
| SUPERSEDED | Replaced by newer version | No |

### Key Rules

1. **Only DRAFT versions can be edited** - This ensures data integrity for approved budgets
2. **Locked versions are permanent** - Once locked, a version cannot be modified
3. **Copying creates a new DRAFT** - Use copy to create revisions from any version

## User Interface

### Budget List Page

Location: `/construction/budgets`

Features:
- List all budget versions with pagination
- Filter by status
- Create new budget version
- Copy existing version
- Delete draft versions
- Quick access to version details

### Budget Detail Page

Location: `/construction/budgets/[id]`

Features:
- Summary cards showing budget totals
- **Inline editing** for draft versions (click on amount cells)
- Budget lines table with variance tracking
- Variance analysis tab
- Version details tab
- Status workflow actions

### Inline Editing

When a budget is in DRAFT status:
1. Click on any editable cell (Original Budget, Revised Budget amounts)
2. Enter the new value
3. Press **Enter** to save or **Escape** to cancel
4. Changes are saved immediately

When editing is disabled (non-DRAFT):
- A warning banner is displayed
- Cells are not clickable
- User is advised to copy the version to make changes

## API Reference

### TRPC Routes

All routes are under `trpc.projectBudgets.*`

#### Version Management

| Route | Method | Description |
|-------|--------|-------------|
| `listVersions` | Query | List budget versions with filters |
| `getVersion` | Query | Get single version by ID |
| `getCurrentVersion` | Query | Get current version for a project |
| `createVersion` | Mutation | Create new budget version |
| `updateVersion` | Mutation | Update version metadata (DRAFT only) |
| `updateVersionStatus` | Mutation | Change version status |
| `copyVersion` | Mutation | Copy version to new DRAFT |
| `deleteVersion` | Mutation | Delete version (DRAFT only) |

#### Budget Lines

| Route | Method | Description |
|-------|--------|-------------|
| `getVersionLines` | Query | Get budget lines for a version |
| `getVersionLinesWithCostCodes` | Query | Get lines with cost code details |
| `createLine` | Mutation | Add new budget line |
| `updateLine` | Mutation | Update budget line (DRAFT only) |
| `deleteLine` | Mutation | Delete budget line (DRAFT only) |

#### Reporting

| Route | Method | Description |
|-------|--------|-------------|
| `getVarianceSummary` | Query | Get variance summary for version |
| `import` | Mutation | Import budget from CSV (admin) |

## Data Model

### Budget Version

```typescript
interface BudgetVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  versionName: string;
  description?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'SUPERSEDED';
  isCurrent: boolean;
  effectiveDate?: string;
  expirationDate?: string;
  totalOriginalBudget?: string;
  totalRevisedBudget?: string;
  totalApprovedChanges?: string;
  totalActualCost?: string;
  totalCommittedCost?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
}
```

### Budget Line

```typescript
interface BudgetLine {
  id: string;
  budgetVersionId: string;
  projectCostCodeId: string;
  lineNumber: number;
  description?: string;
  originalBudgetAmount: string;
  revisedBudgetAmount: string;
  approvedChanges: string;
  pendingChanges: string;
  actualCost: string;
  committedCost: string;
  forecastAmount: string;
  estimateToComplete: string;
  varianceAmount: string;
  variancePercent: string;
  budgetUnits?: string;
  actualUnits?: string;
  unitOfMeasure?: string;
  unitRate?: string;
  notes?: string;
}
```

## Variance Tracking

### Automatic Calculations

The system automatically calculates:
- **Variance Amount**: `Revised Budget - Actual Cost`
- **Variance Percent**: `(Variance / Revised Budget) * 100`
- **Totals**: Sum of all lines for each column

### Variance Summary

Available through `getVarianceSummary`:
- Total original/revised budget
- Total actual/committed cost
- Overall variance amount and percentage
- Count of over/under budget lines

### Visual Indicators

- **Green**: Positive variance (under budget)
- **Red**: Negative variance (over budget)
- **Alert Banner**: Shown when any lines are over budget

## CSV Import

Budget data can be imported via CSV with the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| costCode | Yes | Cost code identifier |
| description | No | Line description |
| budgetAmount | Yes | Budget amount |
| budgetUnits | No | Number of units |
| unitOfMeasure | No | Unit type (Hours, SF, etc.) |
| unitRate | No | Rate per unit |
| notes | No | Additional notes |

### Import Options

```typescript
{
  projectId: string;           // Project to import into
  versionName: string;         // Name for new version
  effectiveDate?: string;      // Optional effective date
  description?: string;        // Version description
  skipInvalidRows: boolean;    // Continue on errors
  createMissingCostCodes: boolean; // Auto-create cost codes
}
```

## Testing

### Playwright Tests

Tests are located in `tests/construction/project-budgets.spec.ts`

Run tests:
```bash
pnpm playwright test project-budgets
```

Test coverage includes:
- Page loading and navigation
- Form validation
- Inline editing behavior
- Version status workflow
- Variance display
- Responsive design

## Best Practices

### Budget Creation

1. Create a new budget version at project start
2. Link all lines to cost codes for proper tracking
3. Set realistic budget amounts based on estimates
4. Add notes to document assumptions

### Budget Updates

1. Always create a new version for significant changes
2. Use the copy feature to preserve history
3. Document changes in version notes
4. Submit for approval before project milestones

### Variance Monitoring

1. Review variance analysis regularly
2. Investigate lines showing >10% negative variance
3. Update forecasts when trends change
4. Document reasons for significant variances

## Related Documentation

- [Project Cost Codes](./project-cost-codes.md)
- [Construction Accounting Overview](../construction-gap-analysis.md)
- [Implementation Plan](../tasks/construction-accounting/IMPLEMENTATION_PLAN.md)
