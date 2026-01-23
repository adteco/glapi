/**
 * Pay Application Service Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports Pay Application types from the centralized @glapi/types package.
 * Database-specific types are still imported from @glapi/database.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export database types for convenience
export type {
  PayApplication,
  NewPayApplication,
  PayApplicationLine,
  NewPayApplicationLine,
  RetainageRelease,
  NewRetainageRelease,
  RetainageReleaseLine,
  NewRetainageReleaseLine,
  PayAppApprovalHistory,
  NewPayAppApprovalHistory,
  PayAppStatus,
  PayAppType,
} from '@glapi/database';

export { PAY_APP_STATUS, PAY_APP_TYPE } from '@glapi/database';

// Re-export all Pay Application service types from centralized package
export {
  // Action Types
  PAY_APP_ACTION,
  type PayAppAction,

  // Input Types
  type CreatePayApplicationInput,
  type CreatePayAppLineInput,
  type UpdatePayAppLinesInput,
  type UpdatePayAppLineInput,
  type SubmitPayAppInput,
  type ApprovePayAppInput,
  type RejectPayAppInput,
  type CertifyPayAppInput,
  type BillPayAppInput,
  type RecordPaymentInput,
  type VoidPayAppInput,

  // Output Types
  type PayAppLineWithProgress,
  type PayAppSummary,

  // G702 Types
  type G702Application,

  // Filter Types
  type ListPayAppFilter,

  // Retainage Types
  type CreateRetainageReleaseInput,
  type CreateRetainageReleaseLineInput,
  type ApproveRetainageReleaseInput,
  type RetainageReleaseSummary,

  // Validation Types
  type PayAppValidationResult,
  type PayAppValidationError,
  type PayAppValidationWarning,
  type PayAppMathValidation,

  // Export Types
  type PayAppExportOptions,

  // Billing Progress Types
  type BillingProgressUpdate,
  type ApplyPayAppToSovResult,
} from '@glapi/types';
