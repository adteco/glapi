/**
 * GL Transaction types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports GL transaction types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

// Re-export all GL transaction types from centralized package
export {
  // Transaction Type
  TransactionTypeCategoryEnum,
  type TransactionTypeCategory,
  transactionTypeSchema,
  createTransactionTypeSchema,
  updateTransactionTypeSchema,
  type TransactionType,
  type CreateTransactionTypeInput,
  type UpdateTransactionTypeInput,

  // Business Transaction Status & Enums
  BusinessTransactionStatusEnum,
  type BusinessTransactionStatus,
  TransactionEntityTypeEnum,
  type TransactionEntityType,
  SalesStageEnum,
  type SalesStage,

  // Business Transaction
  businessTransactionSchema,
  createBusinessTransactionSchema,
  updateBusinessTransactionSchema,
  type BusinessTransaction,
  type CreateBusinessTransactionInput,
  type UpdateBusinessTransactionInput,

  // Business Transaction Line
  TransactionLineTypeEnum,
  type TransactionLineType,
  businessTransactionLineSchema,
  createBusinessTransactionLineSchema,
  updateBusinessTransactionLineSchema,
  type BusinessTransactionLine,
  type CreateBusinessTransactionLineInput,
  type UpdateBusinessTransactionLineInput,

  // GL Transaction Enums
  GlTransactionTypeEnum,
  type GlTransactionType,
  GlSourceSystemEnum,
  type GlSourceSystem,
  GlTransactionStatusEnum,
  type GlTransactionStatus,

  // GL Transaction
  glTransactionSchema,
  createGlTransactionSchema,
  updateGlTransactionSchema,
  type GlTransaction,
  type CreateGlTransactionInput,
  type UpdateGlTransactionInput,

  // GL Transaction Line
  glTransactionLineSchema,
  createGlTransactionLineSchema,
  updateGlTransactionLineSchema,
  type GlTransactionLine,
  type CreateGlTransactionLineInput,
  type UpdateGlTransactionLineInput,

  // GL Posting Rule
  glPostingRuleSchema,
  createGlPostingRuleSchema,
  updateGlPostingRuleSchema,
  type GlPostingRule,
  type CreateGlPostingRuleInput,
  type UpdateGlPostingRuleInput,

  // Transaction Actions
  type PostTransactionRequest,
  type ReverseTransactionRequest,
  type ApproveTransactionRequest,

  // Composite Types
  type BusinessTransactionWithLines,
  type GlTransactionWithLines,

  // FX Rate Handling
  FxRateSourceEnum,
  type FxRateSource,
  fxRateMetadataSchema,
  type FxRateMetadata,
  fxRemeasurementMetadataSchema,
  type FxRemeasurementMetadata,

  // Double-Entry Validation
  type DoubleEntryErrorCode,
  type DoubleEntryError,
  type DoubleEntryValidationResult,
  type DoubleEntryValidationOptions,

  // Posting Results and Audit
  type AccountBalanceUpdate,
  type GlPostingResult,
  type PostingAuditEntry,
} from '@glapi/types';
