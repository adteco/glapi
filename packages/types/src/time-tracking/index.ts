/**
 * Time tracking and project types
 *
 * This module contains type definitions for time entries,
 * projects, labor cost rates, employee assignments, cost codes, and budgets.
 */

import { z } from 'zod';
import {
  dateStringSchema,
  decimalStringSchema,
  rateStringSchema,
  metadataSchema,
  uuidSchema,
  uuidArraySchema,
  optionalPaginationInputSchema,
  sortDirectionSchema,
  emptyStringToUndefined,
  emptyStringToNull,
} from '../common';

// ============================================================================
// Time Entry Enums
// ============================================================================

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

// ============================================================================
// Time Entry Schemas
// ============================================================================

/**
 * Optional UUID that handles empty strings from forms
 */
const optionalUuid = emptyStringToUndefined(z.string().uuid().optional());

/**
 * Nullable optional UUID that handles empty strings from forms
 */
const nullableOptionalUuid = emptyStringToNull(z.string().uuid().nullable().optional());

/**
 * Schema for creating a new time entry
 */
export const createTimeEntrySchema = z.object({
  employeeId: optionalUuid,
  projectId: optionalUuid,
  costCodeId: optionalUuid,
  entryDate: dateStringSchema.describe('Entry date in YYYY-MM-DD format'),
  hours: decimalStringSchema.describe('Hours worked (up to 2 decimal places)'),
  entryType: TimeEntryTypeEnum.default('REGULAR'),
  description: z.string().max(500).optional(),
  internalNotes: z.string().max(2000).optional(),
  isBillable: z.boolean().default(true),
  externalId: z.string().max(100).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: metadataSchema,
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

/**
 * Schema for updating a time entry
 */
export const updateTimeEntrySchema = z.object({
  projectId: nullableOptionalUuid,
  costCodeId: nullableOptionalUuid,
  entryDate: dateStringSchema.optional(),
  hours: decimalStringSchema.optional(),
  entryType: TimeEntryTypeEnum.optional(),
  description: z.string().max(500).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  isBillable: z.boolean().optional(),
  externalId: z.string().max(100).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: metadataSchema,
});

export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;

/**
 * Schema for time entry filters
 */
export const timeEntryFiltersSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    costCodeId: z.string().uuid().optional(),
    status: z.union([TimeEntryStatusEnum, z.array(TimeEntryStatusEnum)]).optional(),
    entryType: z.union([TimeEntryTypeEnum, z.array(TimeEntryTypeEnum)]).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    isBillable: z.boolean().optional(),
    batchId: z.string().uuid().optional(),
  })
  .optional();

export type TimeEntryFilters = z.infer<typeof timeEntryFiltersSchema>;

/**
 * Time entry list input schema (pagination + filters + sorting)
 */
export const timeEntryListInputSchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).optional(),
    orderBy: z.enum(['entryDate', 'createdAt', 'status', 'hours']).optional(),
    orderDirection: sortDirectionSchema.optional(),
    filters: timeEntryFiltersSchema,
  })
  .optional();

export type TimeEntryListInput = z.infer<typeof timeEntryListInputSchema>;

/**
 * Full time entry schema - matches database schema
 */
export const timeEntrySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  subsidiaryId: z.string().uuid().nullable().optional(),
  employeeId: uuidSchema,
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
  metadata: metadataSchema,
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

// ============================================================================
// Time Entry Approval Workflow Schemas
// ============================================================================

/**
 * Schema for submitting time entries
 */
export const submitTimeEntriesSchema = z.object({
  timeEntryIds: uuidArraySchema,
  comments: z.string().max(500).optional(),
});

export type SubmitTimeEntriesInput = z.infer<typeof submitTimeEntriesSchema>;

/**
 * Schema for approving time entries
 */
export const approveTimeEntriesSchema = z.object({
  timeEntryIds: uuidArraySchema,
  comments: z.string().max(500).optional(),
});

export type ApproveTimeEntriesInput = z.infer<typeof approveTimeEntriesSchema>;

/**
 * Schema for rejecting time entries
 */
export const rejectTimeEntriesSchema = z.object({
  timeEntryIds: uuidArraySchema,
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

export type RejectTimeEntriesInput = z.infer<typeof rejectTimeEntriesSchema>;

// ============================================================================
// Time Entry Summary Types
// ============================================================================

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

// ============================================================================
// Labor Cost Rate Schemas
// ============================================================================

/**
 * Labor cost rate schema - matches database schema
 */
export const laborCostRateSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
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
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LaborCostRate = z.infer<typeof laborCostRateSchema>;

/**
 * Schema for creating a labor cost rate
 */
export const createLaborCostRateSchema = z.object({
  employeeId: optionalUuid,
  projectId: optionalUuid,
  costCodeId: optionalUuid,
  laborRole: z.string().max(100).optional(),
  laborRate: rateStringSchema,
  burdenRate: rateStringSchema.default('0'),
  billingRate: rateStringSchema.optional(),
  overtimeMultiplier: decimalStringSchema.default('1.5'),
  doubleTimeMultiplier: decimalStringSchema.default('2.0'),
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional(),
  priority: z.number().int().min(0).max(100).default(0),
  description: z.string().max(500).optional(),
  metadata: metadataSchema,
});

export type CreateLaborCostRateInput = z.infer<typeof createLaborCostRateSchema>;

/**
 * Labor rate filter schema
 */
export const laborRateFiltersSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    costCodeId: z.string().uuid().optional(),
    laborRole: z.string().optional(),
    effectiveDate: dateStringSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .optional();

export type LaborRateFilters = z.infer<typeof laborRateFiltersSchema>;

// ============================================================================
// Employee Project Assignment Schemas
// ============================================================================

/**
 * Employee project assignment schema - matches database schema
 */
export const employeeProjectAssignmentSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  employeeId: uuidSchema,
  projectId: uuidSchema,
  role: z.string().nullable().optional(),
  defaultCostCodeId: z.string().uuid().nullable().optional(),
  budgetedHours: z.string().nullable().optional(),
  actualHours: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean(),
  canApproveTime: z.boolean(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EmployeeProjectAssignment = z.infer<typeof employeeProjectAssignmentSchema>;

/**
 * Schema for creating an employee project assignment
 */
export const createEmployeeAssignmentSchema = z.object({
  employeeId: uuidSchema,
  projectId: uuidSchema,
  role: z.string().max(100).optional(),
  defaultCostCodeId: optionalUuid,
  budgetedHours: decimalStringSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  canApproveTime: z.boolean().default(false),
  metadata: metadataSchema,
});

export type CreateEmployeeAssignmentInput = z.infer<typeof createEmployeeAssignmentSchema>;

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project status enum
 */
export const ProjectStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

/**
 * Project schema
 */
export const projectSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  subsidiaryId: z.string().uuid().nullable().optional(),
  projectCode: z.string(),
  name: z.string(),
  status: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  jobNumber: z.string().nullable().optional(),
  projectType: z.string().nullable().optional(),
  retainagePercent: z.string(),
  currencyCode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  metadata: metadataSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

/**
 * Schema for creating a project
 */
export const createProjectSchema = z.object({
  subsidiaryId: optionalUuid,
  projectCode: z.string().min(1, 'Project code is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  status: ProjectStatusEnum.default('DRAFT'),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  jobNumber: z.string().max(50).optional(),
  projectType: z.string().max(50).optional(),
  retainagePercent: decimalStringSchema.default('0'),
  currencyCode: z.string().max(3).optional(),
  description: z.string().max(2000).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: metadataSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Schema for updating a project
 */
export const updateProjectSchema = z.object({
  subsidiaryId: nullableOptionalUuid,
  projectCode: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  status: ProjectStatusEnum.optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  jobNumber: z.string().max(50).nullable().optional(),
  projectType: z.string().max(50).nullable().optional(),
  retainagePercent: decimalStringSchema.optional(),
  currencyCode: z.string().max(3).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  externalSource: z.string().max(100).nullable().optional(),
  metadata: metadataSchema,
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * Project filters schema
 */
export const projectFiltersSchema = z
  .object({
    subsidiaryId: z.string().uuid().optional(),
    status: z.union([ProjectStatusEnum, z.array(ProjectStatusEnum)]).optional(),
    projectType: z.string().optional(),
    search: z.string().optional(),
    startDateFrom: dateStringSchema.optional(),
    startDateTo: dateStringSchema.optional(),
  })
  .optional();

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

// ============================================================================
// Project Cost Code Types
// ============================================================================

/**
 * Cost code type enum
 */
export const CostCodeTypeEnum = z.enum(['LABOR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER']);
export type CostCodeType = z.infer<typeof CostCodeTypeEnum>;

/**
 * Project cost code schema
 */
export const projectCostCodeSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  parentCostCodeId: z.string().uuid().nullable().optional(),
  activityCodeId: z.string().uuid().nullable().optional(),
  costCode: z.string(),
  costType: CostCodeTypeEnum,
  name: z.string(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  isBillable: z.boolean(),
  budgetAmount: z.string(),
  committedAmount: z.string(),
  actualAmount: z.string(),
  revenueAccountId: z.string().uuid().nullable().optional(),
  costAccountId: z.string().uuid().nullable().optional(),
  wipAccountId: z.string().uuid().nullable().optional(),
  metadata: metadataSchema,
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectCostCode = z.infer<typeof projectCostCodeSchema>;

/**
 * Schema for creating a cost code
 */
export const createCostCodeSchema = z.object({
  projectId: uuidSchema,
  parentCostCodeId: optionalUuid,
  activityCodeId: optionalUuid,
  costCode: z.string().min(1, 'Cost code is required').max(50),
  costType: CostCodeTypeEnum,
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isBillable: z.boolean().default(true),
  revenueAccountId: optionalUuid,
  costAccountId: optionalUuid,
  wipAccountId: optionalUuid,
  metadata: metadataSchema,
});

export type CreateCostCodeInput = z.infer<typeof createCostCodeSchema>;

/**
 * Schema for updating a cost code
 */
export const updateCostCodeSchema = z.object({
  costCode: z.string().min(1).max(50).optional(),
  costType: CostCodeTypeEnum.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isBillable: z.boolean().optional(),
  parentCostCodeId: nullableOptionalUuid,
  activityCodeId: nullableOptionalUuid,
  revenueAccountId: nullableOptionalUuid,
  costAccountId: nullableOptionalUuid,
  wipAccountId: nullableOptionalUuid,
  metadata: metadataSchema,
});

export type UpdateCostCodeInput = z.infer<typeof updateCostCodeSchema>;

/**
 * Cost code filters schema
 */
export const costCodeFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    costType: z.union([CostCodeTypeEnum, z.array(CostCodeTypeEnum)]).optional(),
    isActive: z.boolean().optional(),
    isBillable: z.boolean().optional(),
    parentCostCodeId: z.string().uuid().nullable().optional(),
    search: z.string().optional(),
  })
  .optional();

export type CostCodeFilters = z.infer<typeof costCodeFiltersSchema>;

/**
 * Cost code tree node (with children)
 */
export interface CostCodeTreeNode extends ProjectCostCode {
  children: CostCodeTreeNode[];
}

// ============================================================================
// Project Budget Types
// ============================================================================

/**
 * Budget version status enum
 */
export const BudgetVersionStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'LOCKED',
  'SUPERSEDED',
]);
export type BudgetVersionStatus = z.infer<typeof BudgetVersionStatusEnum>;

/**
 * Valid budget version status transitions
 */
export const VALID_BUDGET_STATUS_TRANSITIONS: Record<BudgetVersionStatus, BudgetVersionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['DRAFT', 'APPROVED'],
  APPROVED: ['LOCKED', 'SUPERSEDED'],
  LOCKED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

/**
 * Budget import source enum
 */
export const ImportSourceEnum = z.enum(['CSV', 'API', 'MANUAL']);
export type ImportSource = z.infer<typeof ImportSourceEnum>;

/**
 * Schema for creating a budget version
 */
export const createBudgetVersionSchema = z.object({
  projectId: uuidSchema,
  versionName: z.string().min(1, 'Version name is required').max(100),
  description: z.string().max(500).optional(),
  effectiveDate: dateStringSchema.optional(),
  notes: z.string().max(2000).optional(),
  metadata: metadataSchema,
});

export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>;

/**
 * Schema for updating a budget version
 */
export const updateBudgetVersionSchema = z.object({
  versionName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  metadata: metadataSchema,
});

export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>;

/**
 * Budget version filters schema
 */
export const budgetVersionFiltersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.union([BudgetVersionStatusEnum, z.array(BudgetVersionStatusEnum)]).optional(),
    isCurrent: z.boolean().optional(),
  })
  .optional();

export type BudgetVersionFilters = z.infer<typeof budgetVersionFiltersSchema>;
