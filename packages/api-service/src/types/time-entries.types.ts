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
  projectTaskId: z.string().uuid().nullable().optional(),
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
  projectTask?: {
    id: string;
    name: string;
    taskCode: string;
    status: string;
  };
  approver?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  attachments?: TimeEntryAttachment[];
}

/**
 * Schema for creating a new time entry
 */
export const createTimeEntrySchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  costCodeId: z.string().uuid().optional(),
  projectTaskId: z.string().uuid().optional(),
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
  projectTaskId: z.string().uuid().nullable().optional(),
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
  projectTaskId: z.string().uuid().optional(),
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

export const timeEntryAttachmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  timeEntryId: z.string().uuid(),
  fileName: z.string(),
  fileUrl: z.string(),
  contentType: z.string().nullable().optional(),
  fileSize: z.number().nullable().optional(),
  uploadedBy: z.string().uuid().nullable().optional(),
  uploadedAt: z.date(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type TimeEntryAttachment = z.infer<typeof timeEntryAttachmentSchema>;

export const createTimeEntryAttachmentSchema = z.object({
  timeEntryId: z.string().uuid(),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  contentType: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTimeEntryAttachmentInput = z.infer<typeof createTimeEntryAttachmentSchema>;

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
  batchId?: string;
  batchNumber?: string;
  glTransactionId?: string;
  glTransactionIds?: string[];
  errors: Array<{
    timeEntryId: string;
    error: string;
  }>;
}
