/**
 * Time entry types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports time tracking types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 *
 * Note: Project, cost code, and budget types are NOT re-exported here since they
 * have their own dedicated type files in this package with additional service-specific types.
 */

// Re-export time entry related types from centralized package
export {
  // Enums
  TimeEntryStatusEnum,
  type TimeEntryStatus,
  TimeEntryTypeEnum,
  type TimeEntryType,
  ApprovalActionEnum,
  type ApprovalAction,

  // Status transitions
  VALID_TIME_ENTRY_STATUS_TRANSITIONS,

  // Time entry schemas
  timeEntrySchema,
  type TimeEntry,
  type TimeEntryWithRelations,
  createTimeEntrySchema,
  type CreateTimeEntryInput,
  updateTimeEntrySchema,
  type UpdateTimeEntryInput,
  timeEntryFiltersSchema,
  type TimeEntryFilters,
  timeEntryListInputSchema,
  type TimeEntryListInput,

  // Approval workflow schemas
  submitTimeEntriesSchema,
  type SubmitTimeEntriesInput,
  approveTimeEntriesSchema,
  type ApproveTimeEntriesInput,
  rejectTimeEntriesSchema,
  type RejectTimeEntriesInput,

  // Summary types
  type TimeEntrySummaryByEmployee,
  type TimeEntrySummaryByProject,
  type TimeEntryPostingResult,

  // Labor cost rate schemas
  laborCostRateSchema,
  type LaborCostRate,
  createLaborCostRateSchema,
  type CreateLaborCostRateInput,
  laborRateFiltersSchema,
  type LaborRateFilters,

  // Employee project assignment schemas
  employeeProjectAssignmentSchema,
  type EmployeeProjectAssignment,
  createEmployeeAssignmentSchema,
  type CreateEmployeeAssignmentInput,
} from '@glapi/types';

// Legacy aliases for backward compatibility
// The centralized package uses slightly different naming
import { createEmployeeAssignmentSchema, type CreateEmployeeAssignmentInput } from '@glapi/types';

export const createEmployeeProjectAssignmentSchema = createEmployeeAssignmentSchema;
export type CreateEmployeeProjectAssignmentInput = CreateEmployeeAssignmentInput;
