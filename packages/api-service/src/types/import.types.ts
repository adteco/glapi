/**
 * Import Types - re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports data import/migration types from the centralized @glapi/types package.
 * New code should import directly from '@glapi/types' when possible.
 */

export {
  // Configuration Types
  type ImportBatchStatus,
  type ImportRecordStatus,
  type ImportDataType,
  type ImportSourceSystem,

  // Validation Types
  type ImportValidationRuleType,
  type ImportValidationSeverity,
  type ImportValidationRule,
  type ImportValidationCondition,
  type ImportValidationError,
  type ImportValidationWarning,
  type ImportValidationResult,

  // Field Mapping Types
  type ImportFieldMapping,
  type ImportTransformationType,
  type ImportFieldTransformation,

  // Options Types
  type ImportBatchOptions,
  type CsvImportOptions,
  type ExcelImportOptions,

  // Result Types
  type ImportErrorSummary,
  type ImportBatchResult,

  // Schema Types
  type AccountImportSchema,
  type CustomerImportSchema,
  type VendorImportSchema,
  type ItemImportSchema,
  type JournalEntryImportSchema,
  type JournalEntryLineImportSchema,
  type OpeningBalanceImportSchema,

  // Predefined Validation Rules
  ACCOUNT_VALIDATION_RULES,
  CUSTOMER_VALIDATION_RULES,
  VENDOR_VALIDATION_RULES,
  ITEM_VALIDATION_RULES,
  JOURNAL_ENTRY_VALIDATION_RULES,
  OPENING_BALANCE_VALIDATION_RULES,
  getValidationRulesForDataType,

  // Source System Mappings
  QBO_ACCOUNT_MAPPING,
  QBO_CUSTOMER_MAPPING,
  XERO_ACCOUNT_MAPPING,
  CSV_ACCOUNT_MAPPING,

  // Event Types
  type ImportEventType,
  type ImportEvent,

  // Progress Types
  type ImportProgress,

  // Request/Response Types
  type CreateImportBatchRequest,
  type AddRecordsToBatchRequest,
  type ValidateBatchRequest,
  type ExecuteImportRequest,
  type RollbackImportRequest,
} from '@glapi/types';

// Re-export with original names for backward compatibility
// (Some consumers may use the non-prefixed names)
export type {
  ImportValidationRuleType as ValidationRuleType,
  ImportValidationSeverity as ValidationSeverity,
  ImportValidationRule as ValidationRule,
  ImportValidationCondition as ValidationCondition,
  ImportValidationError as ValidationError,
  ImportValidationWarning as ValidationWarning,
  ImportValidationResult as ValidationResult,
  ImportTransformationType as TransformationType,
  ImportFieldTransformation as FieldTransformation,
} from '@glapi/types';
