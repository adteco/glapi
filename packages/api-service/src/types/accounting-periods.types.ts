import { z } from 'zod';

/**
 * Period status values matching the database schema
 */
export const PeriodStatusEnum = z.enum(['OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED']);
export type PeriodStatus = z.infer<typeof PeriodStatusEnum>;

export const PeriodTypeEnum = z.enum(['MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT']);
export type PeriodType = z.infer<typeof PeriodTypeEnum>;

/**
 * Full accounting period schema
 */
export const accountingPeriodSchema = z.object({
  id: z.string().uuid(),
  subsidiaryId: z.string().uuid(),
  periodName: z.string().min(1),
  fiscalYear: z.string().min(1),
  periodNumber: z.number().int().positive(),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  periodType: PeriodTypeEnum,
  status: PeriodStatusEnum,
  isAdjustmentPeriod: z.boolean(),
  // Status tracking
  softClosedBy: z.string().uuid().nullable().optional(),
  softClosedDate: z.date().nullable().optional(),
  closedBy: z.string().uuid().nullable().optional(),
  closedDate: z.date().nullable().optional(),
  lockedBy: z.string().uuid().nullable().optional(),
  lockedDate: z.date().nullable().optional(),
  // Audit fields
  createdBy: z.string().uuid().nullable().optional(),
  createdDate: z.date(),
  modifiedBy: z.string().uuid().nullable().optional(),
  modifiedDate: z.date().nullable().optional(),
});

export type AccountingPeriod = z.infer<typeof accountingPeriodSchema>;

/**
 * Schema for creating a new accounting period
 */
export const createAccountingPeriodSchema = z.object({
  subsidiaryId: z.string().uuid(),
  periodName: z.string().min(1, 'Period name is required'),
  fiscalYear: z.string().min(1, 'Fiscal year is required'),
  periodNumber: z.number().int().positive('Period number must be positive'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD format'),
  periodType: PeriodTypeEnum,
  isAdjustmentPeriod: z.boolean().default(false),
});

export type CreateAccountingPeriodInput = z.infer<typeof createAccountingPeriodSchema>;

/**
 * Schema for updating period status
 */
export const updatePeriodStatusSchema = z.object({
  status: PeriodStatusEnum,
});

export type UpdatePeriodStatusInput = z.infer<typeof updatePeriodStatusSchema>;

/**
 * Valid status transitions
 * OPEN -> SOFT_CLOSED -> CLOSED -> LOCKED
 * Re-opening: SOFT_CLOSED -> OPEN, CLOSED -> SOFT_CLOSED (with permission)
 */
export const VALID_STATUS_TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  OPEN: ['SOFT_CLOSED'],
  SOFT_CLOSED: ['OPEN', 'CLOSED'],
  CLOSED: ['SOFT_CLOSED', 'LOCKED'],
  LOCKED: [], // No transitions from LOCKED
};

/**
 * Schema for period filters
 */
export const periodFiltersSchema = z.object({
  status: z.union([PeriodStatusEnum, z.array(PeriodStatusEnum)]).optional(),
  fiscalYear: z.string().optional(),
  periodType: PeriodTypeEnum.optional(),
  isAdjustmentPeriod: z.boolean().optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
});

export type PeriodFilters = z.infer<typeof periodFiltersSchema>;

/**
 * Schema for checking if posting is allowed
 */
export const checkPostingAllowedSchema = z.object({
  subsidiaryId: z.string().uuid(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Posting date must be YYYY-MM-DD format'),
  isAdjustment: z.boolean().default(false),
});

export type CheckPostingAllowedInput = z.infer<typeof checkPostingAllowedSchema>;

/**
 * Result of posting check
 */
export interface PostingCheckResult {
  canPost: boolean;
  period: AccountingPeriod | null;
  reason?: string;
}

/**
 * Schema for bulk period creation (fiscal year setup)
 */
export const createFiscalYearPeriodsSchema = z.object({
  subsidiaryId: z.string().uuid(),
  fiscalYear: z.string().min(1),
  startMonth: z.number().int().min(1).max(12).default(1),
  yearStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Year start date must be YYYY-MM-DD format'),
  includeAdjustmentPeriod: z.boolean().default(true),
});

export type CreateFiscalYearPeriodsInput = z.infer<typeof createFiscalYearPeriodsSchema>;
