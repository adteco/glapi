# Time Tracking & Labor Costing Module

## Overview

The Time Tracking module provides comprehensive time entry management with approval workflows and labor cost calculations for construction accounting. It supports:

- Employee time entry with project/cost code allocation
- Multi-level approval workflow
- Automatic labor cost calculation with configurable rates
- GL posting integration
- Reporting by employee and project

## Database Schema

### Tables

1. **time_entries** - Main time entry records
   - Employee, project, cost code associations
   - Entry date, hours, entry type
   - Labor costs (labor rate, burden rate, billing rate)
   - Status workflow (DRAFT -> SUBMITTED -> APPROVED -> POSTED)
   - Audit trail fields

2. **labor_cost_rates** - Labor rate configuration
   - Hierarchical rate lookup (employee -> project -> cost code -> org)
   - Effective date ranges
   - Regular, overtime, double-time multipliers
   - Priority-based selection

3. **employee_project_assignments** - Employee-project relationships
   - Project access control
   - Approval permissions
   - Budgeted vs actual hours tracking

## Status Workflow

```
DRAFT -> SUBMITTED -> APPROVED -> POSTED
           |            |
           v            v
        REJECTED    (return to)
           |         DRAFT
           v
        DRAFT or CANCELLED
```

### Valid Transitions
- **DRAFT**: Can be submitted or cancelled
- **SUBMITTED**: Can be returned to draft, approved, or rejected
- **APPROVED**: Can be posted or returned to draft (before posting)
- **REJECTED**: Can be returned to draft or cancelled
- **POSTED**: Terminal state
- **CANCELLED**: Terminal state

## Labor Cost Calculation

Labor costs are calculated automatically based on:

1. **Rate Lookup**: Find applicable rate by priority:
   - Employee + Project + Cost Code (highest priority)
   - Employee + Project
   - Project + Cost Code
   - Employee only
   - Organization default

2. **Cost Formula**:
   ```
   laborCost = hours * laborRate * typeMultiplier
   burdenCost = hours * burdenRate * typeMultiplier
   totalCost = laborCost + burdenCost

   typeMultiplier:
   - REGULAR: 1.0
   - OVERTIME: overtimeMultiplier (default 1.5)
   - DOUBLE_TIME: doubleTimeMultiplier (default 2.0)
   - PTO/SICK/HOLIDAY/OTHER: 1.0
   ```

## API Endpoints (tRPC)

### Time Entry CRUD
- `timeEntries.list` - List with filters and pagination
- `timeEntries.getById` - Get single entry
- `timeEntries.getByIdWithRelations` - Get with employee/project details
- `timeEntries.create` - Create new entry (DRAFT status)
- `timeEntries.update` - Update draft entry
- `timeEntries.delete` - Delete draft entry

### Approval Workflow
- `timeEntries.submit` - Submit entries for approval
- `timeEntries.approve` - Approve submitted entries
- `timeEntries.reject` - Reject with reason
- `timeEntries.returnToDraft` - Return to draft status
- `timeEntries.postToGL` - Post approved entries to GL

### Pending Approvals
- `timeEntries.getPendingApprovals` - Get entries user can approve

### Labor Rates
- `timeEntries.listLaborRates` - List configured rates
- `timeEntries.createLaborRate` - Create new rate (admin)

### Employee Assignments
- `timeEntries.createAssignment` - Assign employee to project
- `timeEntries.getMyAssignments` - Get current user's assignments

### Reporting
- `timeEntries.getSummaryByEmployee` - Hours/cost by employee
- `timeEntries.getSummaryByProject` - Hours/cost by project
- `timeEntries.getEmployeeTotalHours` - Total hours for employee
- `timeEntries.getProjectTotalCost` - Total cost for project

## UI Components

### Time Entry Page (`/transactions/management/time-entries`)

Two main views:

1. **My Time Tab**
   - Weekly calendar view
   - Daily hours summary
   - Create/edit/delete draft entries
   - Submit selected entries for approval
   - Filter by status

2. **Approvals Tab**
   - List of pending approvals
   - Approve/reject with comments
   - View employee and project details

## Security

- All tables use Row-Level Security (RLS)
- Organization-scoped queries
- User context for employee ID
- Approval permissions via `canApproveTime` on assignments

## Usage Examples

### Create Time Entry
```typescript
const entry = await trpc.timeEntries.create.mutate({
  entryDate: '2024-01-15',
  hours: '8.00',
  entryType: 'REGULAR',
  projectId: 'project-uuid',
  description: 'Development work',
  isBillable: true,
});
```

### Submit for Approval
```typescript
const submitted = await trpc.timeEntries.submit.mutate({
  timeEntryIds: ['entry-1', 'entry-2'],
  comments: 'Week 3 time entries',
});
```

### Approve Entries
```typescript
const approved = await trpc.timeEntries.approve.mutate({
  timeEntryIds: ['entry-1', 'entry-2'],
});
```

### Get Employee Summary
```typescript
const summary = await trpc.timeEntries.getSummaryByEmployee.query({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  status: 'APPROVED',
});
```

## Future Enhancements

1. **GL Posting Integration** - Full integration with GL posting engine
2. **Bulk Import** - CSV/Excel import for time entries
3. **Mobile App** - Native time entry experience
4. **Timesheet Templates** - Pre-filled weekly templates
5. **Overtime Rules** - Automatic overtime classification
6. **Delegation** - Approval delegation for managers
