/**
 * Schedule of Values (SOV) Service Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports SOV types from the centralized @glapi/types package.
 * Database-specific types are still imported from @glapi/database.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export database types for convenience
export type {
  ProjectScheduleOfValues,
  NewProjectScheduleOfValues,
  ScheduleOfValueLine,
  NewScheduleOfValueLine,
  SovChangeOrder,
  NewSovChangeOrder,
  SovChangeOrderLine,
  NewSovChangeOrderLine,
  SovStatus,
  SovLineType,
} from '@glapi/database';

export { SOV_STATUS, SOV_LINE_TYPE } from '@glapi/database';

// Re-export all SOV service types from centralized package
export {
  // SOV Input Types
  type CreateSovInput,
  type CreateSovLineInput,
  type UpdateSovInput,
  type UpdateSovLineInput,

  // Change Order Types
  type CreateChangeOrderInput,
  type CreateChangeOrderLineInput,
  type ApproveChangeOrderInput,
  type RejectChangeOrderInput,
  type ChangeOrderSummary,

  // SOV Output Types
  type SovLineWithProgress,
  type SovSummary,

  // G703 Types
  type G703ContinuationSheet,
  type G703Line,

  // Filter Types
  type ListSovFilter,
  type ListSovLinesFilter,

  // Validation Types
  type SovValidationResult,
  type SovValidationError,
  type SovValidationWarning,

  // Import/Export Types
  type SovImportInput,
  type SovImportResult,
  type SovImportError,
  type SovExportOptions,

  // Status Transitions
  VALID_SOV_STATUS_TRANSITIONS,
} from '@glapi/types';
