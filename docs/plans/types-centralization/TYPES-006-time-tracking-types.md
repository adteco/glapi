# TYPES-006: Migrate Project and Time Tracking Types

## Task Overview

**Description**: Migrate project and time tracking types from `@glapi/api-service/src/types/` to `@glapi/types`. This includes project schemas, time entry schemas, labor cost rates, and employee project assignments. These are critical for the client-to-cash integration tests.

**Layer**: Domain Types

**Estimated Time**: 4 hours

**Dependencies**: TYPES-002 (common types)

**Blocks**: TYPES-010, TEST-001 to TEST-004

---

## Acceptance Criteria

### Project Types
- [ ] `projectStatusEnum` and `ProjectStatus` type exported
- [ ] `projectSchema` and `Project` type exported
- [ ] `createProjectSchema` and `CreateProjectInput` exported
- [ ] `updateProjectSchema` and `UpdateProjectInput` exported
- [ ] `projectFiltersSchema` and `ProjectFilters` exported
- [ ] Project participant schemas exported

### Time Entry Types
- [ ] `TimeEntryStatusEnum` and `TimeEntryStatus` type exported
- [ ] `TimeEntryTypeEnum` and `TimeEntryType` type exported
- [ ] `timeEntrySchema` and `TimeEntry` type exported
- [ ] `createTimeEntrySchema` and `CreateTimeEntryInput` exported
- [ ] `updateTimeEntrySchema` and `UpdateTimeEntryInput` exported
- [ ] `timeEntryFiltersSchema` and `TimeEntryFilters` exported
- [ ] Approval workflow schemas (submit, approve, reject) exported
- [ ] `VALID_TIME_ENTRY_STATUS_TRANSITIONS` constant exported

### Labor Cost Rate Types
- [ ] `laborCostRateSchema` and `LaborCostRate` type exported
- [ ] `createLaborCostRateSchema` and `CreateLaborCostRateInput` exported

### Employee Assignment Types
- [ ] `employeeProjectAssignmentSchema` exported
- [ ] `createEmployeeProjectAssignmentSchema` exported

### Summary Types
- [ ] `TimeEntrySummaryByEmployee` interface exported
- [ ] `TimeEntrySummaryByProject` interface exported
- [ ] `TimeEntryPostingResult` interface exported

---

## TDD Approach

### 1. Write Tests First

Create `packages/types/tests/time-tracking.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  // Enums
  TimeEntryStatusEnum,
  TimeEntryTypeEnum,
  ApprovalActionEnum,
  // Status transitions
  VALID_TIME_ENTRY_STATUS_TRANSITIONS,
  // Time Entry schemas
  timeEntrySchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  timeEntryFiltersSchema,
  // Workflow schemas
  submitTimeEntriesSchema,
  approveTimeEntriesSchema,
  rejectTimeEntriesSchema,
  // Labor rate schemas
  laborCostRateSchema,
  createLaborCostRateSchema,
  // Assignment schemas
  employeeProjectAssignmentSchema,
  createEmployeeProjectAssignmentSchema,
  // Types
  type TimeEntry,
  type TimeEntryStatus,
  type CreateTimeEntryInput,
  type TimeEntrySummaryByEmployee,
  type TimeEntrySummaryByProject,
  type TimeEntryPostingResult,
} from '../src/time-tracking';

describe('Time Tracking Types', () => {
  describe('TimeEntryStatusEnum', () => {
    it('should include all valid statuses', () => {
      const validStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'];
      validStatuses.forEach((status) => {
        expect(TimeEntryStatusEnum.safeParse(status).success).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(TimeEntryStatusEnum.safeParse('INVALID').success).toBe(false);
    });
  });

  describe('TimeEntryTypeEnum', () => {
    it('should include all valid entry types', () => {
      const validTypes = ['REGULAR', 'OVERTIME', 'DOUBLE_TIME', 'PTO', 'SICK', 'HOLIDAY', 'OTHER'];
      validTypes.forEach((type) => {
        expect(TimeEntryTypeEnum.safeParse(type).success).toBe(true);
      });
    });
  });

  describe('VALID_TIME_ENTRY_STATUS_TRANSITIONS', () => {
    it('should allow DRAFT to SUBMITTED', () => {
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.DRAFT).toContain('SUBMITTED');
    });

    it('should allow SUBMITTED to APPROVED', () => {
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.SUBMITTED).toContain('APPROVED');
    });

    it('should not allow POSTED to any status', () => {
      expect(VALID_TIME_ENTRY_STATUS_TRANSITIONS.POSTED).toHaveLength(0);
    });
  });

  describe('createTimeEntrySchema', () => {
    it('should validate a minimal time entry', () => {
      const entry = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      const result = createTimeEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should validate a full time entry', () => {
      const entry = {
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        costCodeId: '550e8400-e29b-41d4-a716-446655440002',
        entryDate: '2024-01-15',
        hours: '8.50',
        entryType: 'REGULAR',
        description: 'Working on feature',
        internalNotes: 'Internal note',
        isBillable: true,
        externalId: 'ext-123',
        externalSource: 'TimeTracker',
        metadata: { customField: 'value' },
      };

      const result = createTimeEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const entry = {
        entryDate: '01/15/2024', // Wrong format
        hours: '8.00',
      };

      const result = createTimeEntrySchema.safeParse(entry);
      expect(result.success).toBe(false);
    });

    it('should reject invalid hours format', () => {
      const entry = {
        entryDate: '2024-01-15',
        hours: 'eight', // Not a number
      };

      const result = createTimeEntrySchema.safeParse(entry);
      expect(result.success).toBe(false);
    });

    it('should default entryType to REGULAR', () => {
      const entry = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      const result = createTimeEntrySchema.parse(entry);
      expect(result.entryType).toBe('REGULAR');
    });

    it('should default isBillable to true', () => {
      const entry = {
        entryDate: '2024-01-15',
        hours: '8.00',
      };

      const result = createTimeEntrySchema.parse(entry);
      expect(result.isBillable).toBe(true);
    });
  });

  describe('timeEntryFiltersSchema', () => {
    it('should accept date range filters', () => {
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const result = timeEntryFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
    });

    it('should accept status as array', () => {
      const filters = {
        status: ['SUBMITTED', 'APPROVED'],
      };

      const result = timeEntryFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
    });

    it('should accept status as single value', () => {
      const filters = {
        status: 'SUBMITTED',
      };

      const result = timeEntryFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
    });
  });

  describe('submitTimeEntriesSchema', () => {
    it('should require at least one time entry ID', () => {
      const input = {
        timeEntryIds: [],
      };

      const result = submitTimeEntriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate with comments', () => {
      const input = {
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        comments: 'Submitting for approval',
      };

      const result = submitTimeEntriesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('rejectTimeEntriesSchema', () => {
    it('should require rejection reason', () => {
      const input = {
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        // Missing reason
      };

      const result = rejectTimeEntriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty reason', () => {
      const input = {
        timeEntryIds: ['550e8400-e29b-41d4-a716-446655440000'],
        reason: '',
      };

      const result = rejectTimeEntriesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createLaborCostRateSchema', () => {
    it('should validate minimal labor rate', () => {
      const rate = {
        laborRate: '50.00',
        effectiveFrom: '2024-01-01',
      };

      const result = createLaborCostRateSchema.safeParse(rate);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const rate = {
        laborRate: '50.00',
        effectiveFrom: '2024-01-01',
      };

      const result = createLaborCostRateSchema.parse(rate);
      expect(result.burdenRate).toBe('0');
      expect(result.overtimeMultiplier).toBe('1.5');
      expect(result.doubleTimeMultiplier).toBe('2.0');
      expect(result.priority).toBe(0);
    });
  });

  describe('createEmployeeProjectAssignmentSchema', () => {
    it('should require employeeId and projectId', () => {
      const assignment = {
        role: 'Developer',
      };

      const result = createEmployeeProjectAssignmentSchema.safeParse(assignment);
      expect(result.success).toBe(false);
    });

    it('should validate full assignment', () => {
      const assignment = {
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        role: 'Developer',
        defaultCostCodeId: '550e8400-e29b-41d4-a716-446655440002',
        budgetedHours: '160.00',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        canApproveTime: true,
      };

      const result = createEmployeeProjectAssignmentSchema.safeParse(assignment);
      expect(result.success).toBe(true);
    });
  });
});
```

Create `packages/types/tests/projects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  projectStatusEnum,
  createProjectSchema,
  updateProjectSchema,
  projectFiltersSchema,
  createParticipantSchema,
  type ProjectStatus,
  type CreateProjectInput,
} from '../src/projects';

describe('Project Types', () => {
  describe('projectStatusEnum', () => {
    it('should include all valid statuses', () => {
      const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'];
      validStatuses.forEach((status) => {
        expect(projectStatusEnum.safeParse(status).success).toBe(true);
      });
    });
  });

  describe('createProjectSchema', () => {
    it('should require projectCode and name', () => {
      const project = {};
      const result = createProjectSchema.safeParse(project);
      expect(result.success).toBe(false);
    });

    it('should validate minimal project', () => {
      const project = {
        projectCode: 'PRJ-001',
        name: 'Test Project',
      };

      const result = createProjectSchema.safeParse(project);
      expect(result.success).toBe(true);
    });

    it('should validate full project', () => {
      const project = {
        subsidiaryId: '550e8400-e29b-41d4-a716-446655440000',
        projectCode: 'PRJ-001',
        name: 'Test Project',
        status: 'planning',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        jobNumber: 'JOB-001',
        projectType: 'Fixed Price',
        retainagePercent: '10.00',
        currencyCode: 'USD',
        description: 'A test project',
      };

      const result = createProjectSchema.safeParse(project);
      expect(result.success).toBe(true);
    });
  });

  describe('projectFiltersSchema', () => {
    it('should accept status as array', () => {
      const filters = {
        status: ['active', 'planning'],
      };

      const result = projectFiltersSchema.safeParse(filters);
      expect(result.success).toBe(true);
    });
  });

  describe('createParticipantSchema', () => {
    it('should require participantRole', () => {
      const participant = {
        entityId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = createParticipantSchema.safeParse(participant);
      expect(result.success).toBe(false);
    });

    it('should validate participant', () => {
      const participant = {
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        participantRole: 'Project Manager',
        isPrimary: true,
      };

      const result = createParticipantSchema.safeParse(participant);
      expect(result.success).toBe(true);
    });
  });
});
```

---

## Implementation Details

### File: `packages/types/src/projects/index.ts`

```typescript
/**
 * Project types for construction and service projects
 * @module @glapi/types/projects
 */

export * from './project';
export * from './project-participant';
```

### File: `packages/types/src/projects/project.ts`

```typescript
import { z } from 'zod';

/**
 * Project status enum
 */
export const projectStatusEnum = z.enum([
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
  'archived',
]);

export type ProjectStatus = z.infer<typeof projectStatusEnum>;

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  projectCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  status: projectStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  jobNumber: z.string().max(50).optional(),
  projectType: z.string().max(50).optional(),
  retainagePercent: z.string().optional(),
  currencyCode: z.string().max(10).optional(),
  description: z.string().max(2000).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Schema for updating a project
 */
export const updateProjectSchema = z.object({
  subsidiaryId: z.string().uuid().optional(),
  projectCode: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  status: projectStatusEnum.optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  jobNumber: z.string().max(50).nullable().optional(),
  projectType: z.string().max(50).nullable().optional(),
  retainagePercent: z.string().optional(),
  currencyCode: z.string().max(10).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * Project filter schema for list operations
 */
export const projectFiltersSchema = z
  .object({
    subsidiaryId: z.string().uuid().optional(),
    status: z.union([projectStatusEnum, z.array(projectStatusEnum)]).optional(),
    projectType: z.string().optional(),
    search: z.string().optional(),
    startDateFrom: z.string().optional(),
    startDateTo: z.string().optional(),
  })
  .optional();

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

/**
 * Full project entity type
 */
export interface Project {
  id: string;
  organizationId: string;
  subsidiaryId: string | null;
  projectCode: string;
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  jobNumber: string | null;
  projectType: string | null;
  retainagePercent: string | null;
  currencyCode: string;
  description: string | null;
  externalSource: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### File: `packages/types/src/projects/project-participant.ts`

```typescript
import { z } from 'zod';

/**
 * Schema for creating a project participant
 */
export const createParticipantSchema = z.object({
  entityId: z.string().uuid().optional(),
  participantRole: z.string().min(1).max(50),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;

/**
 * Schema for updating a project participant
 */
export const updateParticipantSchema = z.object({
  entityId: z.string().uuid().optional(),
  participantRole: z.string().min(1).max(50).optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

/**
 * Project participant entity type
 */
export interface ProjectParticipant {
  id: string;
  projectId: string;
  entityId: string | null;
  participantRole: string;
  isPrimary: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### File: `packages/types/src/time-tracking/index.ts`

```typescript
/**
 * Time tracking types for employee time entry and labor costing
 * @module @glapi/types/time-tracking
 */

export * from './time-entry';
export * from './labor-cost-rate';
export * from './employee-assignment';
```

### File: `packages/types/src/time-tracking/time-entry.ts`

```typescript
import { z } from 'zod';

/**
 * Time entry status enum matching the database schema
 */
export const TimeEntryStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
]);
export type TimeEntryStatus = z.infer<typeof TimeEntryStatusEnum>;

/**
 * Time entry type enum
 */
export const TimeEntryTypeEnum = z.enum([
  'REGULAR',
  'OVERTIME',
  'DOUBLE_TIME',
  'PTO',
  'SICK',
  'HOLIDAY',
  'OTHER',
]);
export type TimeEntryType = z.infer<typeof TimeEntryTypeEnum>;

/**
 * Approval action enum
 */
export const ApprovalActionEnum = z.enum([
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
  'REOPENED',
]);
export type ApprovalAction = z.infer<typeof ApprovalActionEnum>;

/**
 * Valid time entry status transitions
 */
export const VALID_TIME_ENTRY_STATUS_TRANSITIONS: Record<TimeEntryStatus, TimeEntryStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['DRAFT', 'APPROVED', 'REJECTED'],
  APPROVED: ['POSTED', 'DRAFT'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  POSTED: [],
  CANCELLED: [],
};

/**
 * Full time entry schema - matches database schema
 */
export const timeEntrySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  subsidiaryId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  entryDate: z.string(),
  hours: z.string(),
  entryType: TimeEntryTypeEnum,
  isBillable: z.boolean(),
  billingRate: z.string().nullable().optional(),
  laborRate: z.string().nullable().optional(),
  laborCost: z.string().nullable().optional(),
  burdenRate: z.string().nullable().optional(),
  burdenCost: z.string().nullable().optional(),
  totalCost: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  status: TimeEntryStatusEnum,
  submittedAt: z.date().nullable().optional(),
  submittedBy: z.string().uuid().nullable().optional(),
  approvedAt: z.date().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  rejectedAt: z.date().nullable().optional(),
  rejectedBy: z.string().uuid().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  postedAt: z.date().nullable().optional(),
  glTransactionId: z.string().uuid().nullable().optional(),
  glPostingBatchId: z.string().uuid().nullable().optional(),
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TimeEntry = z.infer<typeof timeEntrySchema>;

/**
 * Time entry with relations - matches repository type
 */
export interface TimeEntryWithRelations extends TimeEntry {
  employee?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  project?: {
    id: string;
    name: string;
    projectCode: string;
  };
  approver?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

/**
 * Schema for creating a new time entry
 */
export const createTimeEntrySchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Entry date must be YYYY-MM-DD format'),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Hours must be a positive number'),
  entryType: TimeEntryTypeEnum.default('REGULAR'),
  description: z.string().max(500).optional(),
  internalNotes: z.string().max(2000).optional(),
  isBillable: z.boolean().default(true),
  externalId: z.string().max(100).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

/**
 * Schema for updating a time entry
 */
export const updateTimeEntrySchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  entryType: TimeEntryTypeEnum.optional(),
  description: z.string().max(500).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  isBillable: z.boolean().optional(),
  externalId: z.string().max(100).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;

/**
 * Schema for time entry filters
 */
export const timeEntryFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  status: z.union([TimeEntryStatusEnum, z.array(TimeEntryStatusEnum)]).optional(),
  entryType: z.union([TimeEntryTypeEnum, z.array(TimeEntryTypeEnum)]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isBillable: z.boolean().optional(),
  batchId: z.string().uuid().optional(),
});

export type TimeEntryFilters = z.infer<typeof timeEntryFiltersSchema>;

/**
 * Schema for submitting time entries
 */
export const submitTimeEntriesSchema = z.object({
  timeEntryIds: z.array(z.string().uuid()).min(1),
  comments: z.string().max(500).optional(),
});

export type SubmitTimeEntriesInput = z.infer<typeof submitTimeEntriesSchema>;

/**
 * Schema for approving time entries
 */
export const approveTimeEntriesSchema = z.object({
  timeEntryIds: z.array(z.string().uuid()).min(1),
  comments: z.string().max(500).optional(),
});

export type ApproveTimeEntriesInput = z.infer<typeof approveTimeEntriesSchema>;

/**
 * Schema for rejecting time entries
 */
export const rejectTimeEntriesSchema = z.object({
  timeEntryIds: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

export type RejectTimeEntriesInput = z.infer<typeof rejectTimeEntriesSchema>;

/**
 * Time entry summary by employee
 */
export interface TimeEntrySummaryByEmployee {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  totalHours: string;
  totalCost: string;
  regularHours: string;
  overtimeHours: string;
  billableHours: string;
  nonBillableHours: string;
  entryCount: number;
}

/**
 * Time entry summary by project
 */
export interface TimeEntrySummaryByProject {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalHours: string;
  totalCost: string;
  totalBillingAmount: string;
  billableHours: string;
  nonBillableHours: string;
  entryCount: number;
}

/**
 * Time entry posting result
 */
export interface TimeEntryPostingResult {
  success: boolean;
  postedCount: number;
  failedCount: number;
  glTransactionId?: string;
  errors: Array<{
    timeEntryId: string;
    error: string;
  }>;
}
```

### File: `packages/types/src/time-tracking/labor-cost-rate.ts`

```typescript
import { z } from 'zod';

/**
 * Labor cost rate schema - matches database schema
 */
export const laborCostRateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  subsidiaryId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  costCodeId: z.string().uuid().nullable().optional(),
  laborRole: z.string().nullable().optional(),
  laborRate: z.string(),
  burdenRate: z.string(),
  billingRate: z.string().nullable().optional(),
  overtimeMultiplier: z.string(),
  doubleTimeMultiplier: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable().optional(),
  priority: z.number(),
  isActive: z.boolean(),
  currencyCode: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LaborCostRate = z.infer<typeof laborCostRateSchema>;

/**
 * Schema for creating a labor cost rate
 */
export const createLaborCostRateSchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  laborRole: z.string().max(100).optional(),
  laborRate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Rate must be a positive number'),
  burdenRate: z.string().regex(/^\d+(\.\d{1,4})?$/).default('0'),
  billingRate: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  overtimeMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).default('1.5'),
  doubleTimeMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).default('2.0'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.number().int().min(0).max(100).default(0),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLaborCostRateInput = z.infer<typeof createLaborCostRateSchema>;
```

### File: `packages/types/src/time-tracking/employee-assignment.ts`

```typescript
import { z } from 'zod';

/**
 * Employee project assignment schema - matches database schema
 */
export const employeeProjectAssignmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid(),
  projectId: z.string().uuid(),
  role: z.string().nullable().optional(),
  defaultCostCodeId: z.string().uuid().nullable().optional(),
  budgetedHours: z.string().nullable().optional(),
  actualHours: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean(),
  canApproveTime: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EmployeeProjectAssignment = z.infer<typeof employeeProjectAssignmentSchema>;

/**
 * Schema for creating an employee project assignment
 */
export const createEmployeeProjectAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid(),
  role: z.string().max(100).optional(),
  defaultCostCodeId: z.string().uuid().optional(),
  budgetedHours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  canApproveTime: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateEmployeeProjectAssignmentInput = z.infer<typeof createEmployeeProjectAssignmentSchema>;
```

---

## Update Main Index

After implementing, update `packages/types/src/index.ts`:

```typescript
export { z } from 'zod';

export * from './common';
export * from './projects';
export * from './time-tracking';
// ... other exports
```

---

## Git Commit

```
feat(types): add project and time tracking types

- Add project status enum and project schemas
- Add time entry status/type enums with transition rules
- Add time entry CRUD schemas (create, update, filters)
- Add approval workflow schemas (submit, approve, reject)
- Add labor cost rate schemas
- Add employee project assignment schemas
- Add summary and posting result interfaces
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
