# Approval Workflow & Segregation of Duties

This document describes the configurable approval workflow system and Segregation of Duties (SoD) enforcement in GLAPI.

## Overview

The approval workflow system provides:
- **Configurable approval chains** - Multi-step approval workflows per document type
- **Condition-based routing** - Apply different policies based on amount thresholds, departments, etc.
- **Segregation of Duties** - Enforce financial controls preventing conflicts of interest
- **Event-driven notifications** - Automatic notifications to approvers
- **Audit trail** - Complete history of approvals and SoD violations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Transaction Submission                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ApprovalWorkflowService                         │
│  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │ Policy Matching    │  │ SoD Enforcement                │ │
│  │ - Document type    │  │ - Same user checks             │ │
│  │ - Amount threshold │  │ - Role pair conflicts          │ │
│  │ - Department       │  │ - Subsidiary separation        │ │
│  └────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Approval Instance                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Step 1  │→│  Step 2  │→│  Step 3  │→│ Approved │       │
│  │ Manager  │ │ Director │ │   CFO    │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Event Notifications                       │
│  - ApprovalSubmitted    - ApprovalRejected                  │
│  - ApprovalStepCompleted - ApprovalEscalated                │
│  - ApprovalCompleted    - ApprovalRecalled                  │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Approval Policies

```sql
approval_policies
├── id (text, PK)
├── organization_id (text, FK)
├── policy_code (text, unique per org)
├── policy_name (text)
├── document_type (enum: journal_entry, purchase_order, vendor_bill, etc.)
├── is_default (boolean)
├── priority (integer) -- lower = higher priority
├── condition_rules (jsonb) -- amount thresholds, department filters
└── is_active (boolean)
```

### Approval Steps

```sql
approval_steps
├── id (text, PK)
├── policy_id (text, FK)
├── step_number (integer)
├── step_name (text)
├── approval_level (enum: same_level, next_level, skip_level, final)
├── required_role_ids (jsonb array)
├── required_approvals (integer) -- for parallel approvals
├── escalation_hours (integer)
├── escalation_notify_role_ids (jsonb array)
└── allow_self_approval (boolean)
```

### Approval Instances

```sql
approval_instances
├── id (text, PK)
├── organization_id (text, FK)
├── document_type (enum)
├── document_id (text)
├── policy_id (text, FK)
├── policy_snapshot (jsonb) -- frozen policy at submission time
├── status (enum: pending, in_progress, approved, rejected, recalled, escalated)
├── current_step_number (integer)
├── submitted_by (text)
├── submitted_at (timestamp)
└── completed_at (timestamp)
```

### SoD Rules

```sql
sod_rules
├── id (text, PK)
├── policy_id (text, FK)
├── rule_code (text)
├── conflict_type (enum: same_user, same_role, role_pair, subsidiary_based)
├── document_type (enum)
├── action1 (text) -- e.g., 'create'
├── action2 (text) -- e.g., 'approve'
├── conflicting_role_ids (jsonb array)
├── exempt_user_ids (jsonb array)
├── exempt_role_ids (jsonb array)
├── severity (enum: critical, high, medium, low)
└── is_active (boolean)
```

## Service Layer

### ApprovalWorkflowService

Main service for managing approval workflows:

```typescript
import { ApprovalWorkflowService } from '@glapi/api-service';

const service = new ApprovalWorkflowService({
  organizationId: 'org-123',
  userId: 'user-123',
});

// Submit a document for approval
const result = await service.submitForApproval({
  documentType: 'journal_entry',
  documentId: 'je-001',
  documentNumber: 'JE-2024-001',
  documentAmount: 15000,
  subsidiaryId: 'sub-001',
});

// Process an approval action
const status = await service.processApproval({
  instanceId: result.instance.id,
  action: 'approve',
  comments: 'Looks good, approved.',
});

// Check if document is approved before posting
await service.requireApproval('journal_entry', 'je-001');
```

### SegregationOfDutiesService

Service for enforcing SoD rules:

```typescript
import { SegregationOfDutiesService } from '@glapi/api-service';

const sodService = new SegregationOfDutiesService({
  organizationId: 'org-123',
  userId: 'user-123',
});

// Check if an action would violate SoD rules
const result = await sodService.checkAction({
  documentType: 'journal_entry',
  documentId: 'je-001',
  action: 'approve',
  userId: 'user-123',
  userRoleIds: ['role-accountant'],
  priorActions: [
    {
      action: 'create',
      userId: 'user-123', // Same user - will trigger violation
      userRoleIds: ['role-accountant'],
      performedAt: new Date(),
    },
  ],
});

if (!result.allowed) {
  console.log('SoD violations:', result.violations);
}

// Enforce SoD - throws if blocked
await sodService.enforceAction(context);
```

## Approval Workflow States

```
         ┌──────────────────────────────────────────────────────┐
         │                                                      │
         ▼                                                      │
    ┌─────────┐   approve   ┌─────────────┐   approve   ┌──────────┐
    │ PENDING │──────────▶ │ IN_PROGRESS │──────────▶ │ APPROVED │
    └─────────┘             └─────────────┘             └──────────┘
         │                        │
         │ reject                 │ reject
         ▼                        ▼
    ┌──────────┐           ┌──────────┐
    │ REJECTED │           │ REJECTED │
    └──────────┘           └──────────┘
         │
         │ recall (by submitter)
         ▼
    ┌──────────┐
    │ RECALLED │
    └──────────┘
```

## SoD Conflict Types

### 1. Same User (same_user)
Prevents the same user from performing both conflicting actions:
- Creator cannot approve their own transactions
- Submitter cannot be the final approver

### 2. Same Role (same_role)
Prevents users with overlapping roles from performing both actions:
- Two accountants cannot collectively bypass controls

### 3. Role Pair (role_pair)
Prevents specific role combinations from acting on the same document:
- AP Clerk and AP Manager separation for vendor bills

### 4. Subsidiary Based (subsidiary_based)
Requires actions to be performed by users from different subsidiaries:
- Inter-company transactions require cross-subsidiary review

## Policy Condition Rules

Policies can include condition rules for routing:

```typescript
{
  conditionRules: [
    { field: 'documentAmount', operator: 'gte', value: 10000 },
    { field: 'departmentId', operator: 'eq', value: 'dept-finance' },
  ]
}
```

Supported operators:
- `eq` - Equal
- `ne` - Not equal
- `gt`, `gte` - Greater than (or equal)
- `lt`, `lte` - Less than (or equal)
- `in`, `not_in` - In/not in array

## Seeding Default Policies

Use the seed script to create default approval policies:

```bash
# Set organization ID
export ORGANIZATION_ID=org-123

# Run seed script
pnpm --filter database seed:approval-policies
```

This creates:
- Journal Entry policies (standard and high-value)
- Purchase Order policies (standard and high-value)
- Vendor Bill policy with 3-way match
- Bank Deposit policy
- Standard SoD rules for financial controls

## Integration with Transaction Services

### Posting Engine Integration

```typescript
// In your transaction service (e.g., JournalEntryService)
async postJournalEntry(id: string): Promise<void> {
  // Require approval before posting
  await this.approvalWorkflowService.requireApproval('journal_entry', id);

  // Proceed with posting
  await this.glPostingEngine.postTransaction(transaction);
}
```

### Automatic Escalation

Configure a cron job to check for overdue approvals:

```typescript
// Run every hour
const escalatedCount = await approvalWorkflowService.checkAndEscalateOverdue();
console.log(`Escalated ${escalatedCount} overdue approvals`);
```

## Events Emitted

The approval workflow emits events for notifications:

| Event Type | Description |
|------------|-------------|
| `ApprovalSubmitted` | Document submitted for approval |
| `ApprovalStepCompleted` | Step approved, moving to next |
| `ApprovalCompleted` | Final approval granted |
| `ApprovalRejected` | Approval rejected |
| `ApprovalDelegated` | Approval delegated to another user |
| `ApprovalEscalated` | Approval escalated due to timeout or manually |
| `ApprovalRecalled` | Submitter recalled the request |
| `ApprovalAutoEscalated` | System auto-escalated overdue approval |

## API Reference

### Submit for Approval

```typescript
interface SubmitForApprovalInput {
  documentType: ApprovalDocumentType;
  documentId: string;
  documentNumber?: string;
  documentAmount?: number;
  subsidiaryId?: string;
  departmentId?: string;
  metadata?: Record<string, unknown>;
  requiredByDate?: Date;
}

interface SubmitApprovalResult {
  instance: ApprovalInstance;
  policyUsed: ApprovalPolicy;
  totalSteps: number;
  firstApprovers: ApproverInfo[];
}
```

### Process Approval

```typescript
interface ProcessApprovalInput {
  instanceId: string;
  action: 'approve' | 'reject' | 'delegate' | 'escalate' | 'recall' | 'request_info';
  comments?: string;
  conditions?: Record<string, unknown>;
  delegateTo?: string;
}

interface ApprovalWorkflowStatus {
  instance: ApprovalInstance;
  policy: ApprovalPolicy | null;
  currentStep: ApprovalStep | null;
  completedSteps: number;
  totalSteps: number;
  actions: WorkflowApprovalAction[];
  pendingApprovers: ApproverInfo[];
  canUserApprove: boolean;
  isComplete: boolean;
  isFinalApproved: boolean;
  isRejected: boolean;
}
```

### SoD Check

```typescript
interface SodCheckContext {
  documentType: ApprovalDocumentType;
  documentId: string;
  action: string;
  userId: string;
  userRoleIds: string[];
  subsidiaryId?: string;
  departmentId?: string;
  priorActions?: DocumentAction[];
}

interface SodCheckResult {
  allowed: boolean;
  violations: SodViolationDetail[];
  enforcementMode: 'block' | 'warn' | 'log_only';
}
```

## Best Practices

1. **Start with standard policies** - Use the seed templates as a starting point
2. **Configure exemptions carefully** - Document why users/roles are exempt
3. **Monitor violations** - Review SoD violations regularly
4. **Set appropriate escalation times** - Balance urgency with realism
5. **Use amount thresholds** - Reduce approval burden for low-risk transactions
6. **Test policies** - Verify workflow behavior before production use

## Troubleshooting

### "No approval policy found"
- Ensure a default policy exists for the document type
- Check that the organization ID is correct
- Verify condition rules match the document context

### "SoD violation blocked"
- User cannot perform both conflicting actions
- Check if user should be exempt
- Consider if the workflow needs restructuring

### "Already submitted"
- Document is already in an approval workflow
- Check the existing instance status
- Recall or complete existing workflow first
