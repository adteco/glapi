/**
 * Import Types
 *
 * Types for data import/migration operations.
 * Defines validation rules, mappers, and import configurations.
 */

// ============================================================================
// Import Configuration Types
// ============================================================================

/**
 * Import batch status
 */
export type ImportBatchStatus =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

/**
 * Import record status
 */
export type ImportRecordStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'imported'
  | 'skipped'
  | 'failed';

/**
 * Import data type
 */
export type ImportDataType =
  // Master data
  | 'account'
  | 'customer'
  | 'vendor'
  | 'employee'
  | 'item'
  | 'department'
  | 'class'
  | 'location'
  | 'project'
  | 'cost_code'
  | 'subsidiary'
  // Transactional data
  | 'journal_entry'
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'bill_payment'
  | 'opening_balance'
  | 'budget'
  | 'time_entry'
  | 'expense_entry';

/**
 * Import source system
 */
export type ImportSourceSystem =
  | 'quickbooks_online'
  | 'quickbooks_desktop'
  | 'xero'
  | 'sage'
  | 'netsuite'
  | 'dynamics'
  | 'freshbooks'
  | 'wave'
  | 'csv'
  | 'excel'
  | 'json'
  | 'other';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation rule type
 */
export type ValidationRuleType =
  | 'required'
  | 'format'
  | 'range'
  | 'lookup'
  | 'unique'
  | 'custom'
  | 'dependency'
  | 'crossfield';

/**
 * Validation severity
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Validation rule definition
 */
export interface ValidationRule {
  /** Field to validate */
  field: string;
  /** Rule type */
  type: ValidationRuleType;
  /** Rule parameters */
  params?: Record<string, unknown>;
  /** Error message template */
  message?: string;
  /** Severity */
  severity?: ValidationSeverity;
  /** Condition for applying the rule */
  condition?: ValidationCondition;
}

/**
 * Validation condition
 */
export interface ValidationCondition {
  /** Field to check */
  field: string;
  /** Operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'exists' | 'notExists';
  /** Value to compare */
  value?: unknown;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field with error */
  field: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Expected value/format */
  expected?: string;
  /** Actual value */
  actual?: unknown;
  /** Row number if applicable */
  rowNumber?: number;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Field with warning */
  field: string;
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Suggestion */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  isValid: boolean;
  /** Errors */
  errors: ValidationError[];
  /** Warnings */
  warnings: ValidationWarning[];
  /** Mapped/transformed data */
  mappedData?: Record<string, unknown>;
}

// ============================================================================
// Field Mapping Types
// ============================================================================

/**
 * Import field mapping definition
 */
export interface ImportFieldMapping {
  /** Source field name */
  sourceField: string;
  /** Target field name */
  targetField: string;
  /** Is this mapping required */
  required?: boolean;
  /** Default value if source is empty */
  defaultValue?: unknown;
  /** Transformation to apply */
  transformation?: string;
}

/**
 * Field transformation type
 */
export type TransformationType =
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'date'
  | 'number'
  | 'boolean'
  | 'lookup'
  | 'custom'
  | 'split'
  | 'join'
  | 'replace'
  | 'truncate';

/**
 * Field transformation
 */
export interface FieldTransformation {
  /** Field to transform */
  field: string;
  /** Transformation type */
  type: TransformationType;
  /** Transformation parameters */
  params?: Record<string, unknown>;
}

// ============================================================================
// Import Options
// ============================================================================

/**
 * Import batch options
 */
export interface ImportBatchOptions {
  /** Skip duplicate records instead of failing */
  skipDuplicates?: boolean;
  /** Update existing records instead of skipping */
  updateExisting?: boolean;
  /** Continue on validation errors */
  continueOnErrors?: boolean;
  /** Maximum number of errors before stopping */
  maxErrors?: number;
  /** Dry run mode (validate only) */
  dryRun?: boolean;
  /** Enable rollback tracking */
  enableRollback?: boolean;
  /** Field mapping ID to use */
  fieldMappingId?: string;
  /** Custom validation rules */
  validationRules?: ValidationRule[];
  /** Date format for parsing */
  dateFormat?: string;
  /** Decimal separator */
  decimalSeparator?: string;
  /** Thousands separator */
  thousandsSeparator?: string;
}

/**
 * CSV import options
 */
export interface CsvImportOptions extends ImportBatchOptions {
  /** Header row number (1-based) */
  headerRow?: number;
  /** Data start row (1-based) */
  dataStartRow?: number;
  /** Column delimiter */
  delimiter?: string;
  /** Quote character */
  quoteChar?: string;
  /** Escape character */
  escapeChar?: string;
  /** Encoding */
  encoding?: BufferEncoding;
  /** Trim values */
  trimValues?: boolean;
  /** Skip empty rows */
  skipEmptyRows?: boolean;
}

/**
 * Excel import options
 */
export interface ExcelImportOptions extends ImportBatchOptions {
  /** Sheet name or index (0-based) */
  sheet?: string | number;
  /** Header row number (1-based) */
  headerRow?: number;
  /** Data start row (1-based) */
  dataStartRow?: number;
  /** Column range (e.g., "A:Z") */
  columnRange?: string;
}

// ============================================================================
// Import Results
// ============================================================================

/**
 * Import error summary
 */
export interface ImportErrorSummary {
  /** Total errors */
  totalErrors: number;
  /** Errors by code */
  errorsByCode: Record<string, number>;
  /** Errors by field */
  errorsByField: Record<string, number>;
  /** Sample errors */
  sampleErrors: ValidationError[];
}

/**
 * Import batch result
 */
export interface ImportBatchResult {
  /** Batch ID */
  batchId: string;
  /** Batch number */
  batchNumber: string;
  /** Status */
  status: ImportBatchStatus;
  /** Total records */
  totalRecords: number;
  /** Valid records */
  validRecords: number;
  /** Invalid records */
  invalidRecords: number;
  /** Imported records */
  importedRecords: number;
  /** Skipped records */
  skippedRecords: number;
  /** Failed records */
  failedRecords: number;
  /** Error summary */
  errorSummary?: ImportErrorSummary;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
}

// ============================================================================
// Data Type Schemas (Expected Fields)
// ============================================================================

/**
 * Account import schema
 */
export interface AccountImportSchema {
  accountNumber: string;
  name: string;
  accountType: string;
  normalBalance?: 'debit' | 'credit';
  parentAccountNumber?: string;
  description?: string;
  isActive?: boolean;
  subsidiaryId?: string;
}

/**
 * Customer import schema
 */
export interface CustomerImportSchema {
  customerNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  creditLimit?: number;
  taxExempt?: boolean;
  taxId?: string;
  isActive?: boolean;
}

/**
 * Vendor import schema
 */
export interface VendorImportSchema {
  vendorNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  defaultExpenseAccount?: string;
  taxId?: string;
  is1099?: boolean;
  isActive?: boolean;
}

/**
 * Item import schema
 */
export interface ItemImportSchema {
  itemNumber: string;
  name: string;
  description?: string;
  itemType: 'inventory' | 'non_inventory' | 'service' | 'other';
  unitPrice?: number;
  cost?: number;
  incomeAccount?: string;
  expenseAccount?: string;
  assetAccount?: string;
  categoryId?: string;
  unitOfMeasure?: string;
  taxable?: boolean;
  isActive?: boolean;
}

/**
 * Journal entry import schema
 */
export interface JournalEntryImportSchema {
  entryNumber?: string;
  date: string;
  memo?: string;
  reference?: string;
  lines: JournalEntryLineImportSchema[];
}

/**
 * Journal entry line import schema
 */
export interface JournalEntryLineImportSchema {
  accountNumber: string;
  debit?: number;
  credit?: number;
  memo?: string;
  departmentId?: string;
  classId?: string;
  locationId?: string;
  projectId?: string;
  entityId?: string;
}

/**
 * Opening balance import schema
 */
export interface OpeningBalanceImportSchema {
  accountNumber: string;
  date: string;
  amount: number;
  subsidiaryId?: string;
  departmentId?: string;
  classId?: string;
  locationId?: string;
}

// ============================================================================
// Predefined Validation Rules by Data Type
// ============================================================================

/**
 * Get validation rules for a data type
 */
export function getValidationRulesForDataType(dataType: ImportDataType): ValidationRule[] {
  switch (dataType) {
    case 'account':
      return ACCOUNT_VALIDATION_RULES;
    case 'customer':
      return CUSTOMER_VALIDATION_RULES;
    case 'vendor':
      return VENDOR_VALIDATION_RULES;
    case 'item':
      return ITEM_VALIDATION_RULES;
    case 'journal_entry':
      return JOURNAL_ENTRY_VALIDATION_RULES;
    case 'opening_balance':
      return OPENING_BALANCE_VALIDATION_RULES;
    default:
      return [];
  }
}

/**
 * Account validation rules
 */
export const ACCOUNT_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'accountNumber',
    type: 'required',
    message: 'Account number is required',
  },
  {
    field: 'accountNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Account number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'accountNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Account number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Account name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Account name must not exceed 255 characters',
  },
  {
    field: 'accountType',
    type: 'required',
    message: 'Account type is required',
  },
  {
    field: 'accountType',
    type: 'lookup',
    params: {
      values: [
        'asset', 'liability', 'equity', 'revenue', 'expense',
        'bank', 'accounts_receivable', 'accounts_payable',
        'fixed_asset', 'other_asset', 'other_liability',
        'cost_of_goods_sold', 'other_income', 'other_expense',
      ],
    },
    message: 'Invalid account type',
  },
  {
    field: 'normalBalance',
    type: 'lookup',
    params: { values: ['debit', 'credit'] },
    severity: 'warning',
    message: 'Normal balance should be debit or credit',
  },
  {
    field: 'parentAccountNumber',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    severity: 'warning',
    message: 'Parent account not found',
    condition: { field: 'parentAccountNumber', operator: 'exists' },
  },
];

/**
 * Customer validation rules
 */
export const CUSTOMER_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'customerNumber',
    type: 'required',
    message: 'Customer number is required',
  },
  {
    field: 'customerNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Customer number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'customerNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Customer number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Customer name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Customer name must not exceed 255 characters',
  },
  {
    field: 'email',
    type: 'format',
    params: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    severity: 'warning',
    message: 'Invalid email format',
    condition: { field: 'email', operator: 'exists' },
  },
  {
    field: 'creditLimit',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Credit limit must be non-negative',
    condition: { field: 'creditLimit', operator: 'exists' },
  },
];

/**
 * Vendor validation rules
 */
export const VENDOR_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'vendorNumber',
    type: 'required',
    message: 'Vendor number is required',
  },
  {
    field: 'vendorNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Vendor number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'vendorNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Vendor number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Vendor name is required',
  },
  {
    field: 'name',
    type: 'format',
    params: { maxLength: 255 },
    message: 'Vendor name must not exceed 255 characters',
  },
  {
    field: 'email',
    type: 'format',
    params: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    severity: 'warning',
    message: 'Invalid email format',
    condition: { field: 'email', operator: 'exists' },
  },
  {
    field: 'defaultExpenseAccount',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    severity: 'warning',
    message: 'Default expense account not found',
    condition: { field: 'defaultExpenseAccount', operator: 'exists' },
  },
];

/**
 * Item validation rules
 */
export const ITEM_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'itemNumber',
    type: 'required',
    message: 'Item number is required',
  },
  {
    field: 'itemNumber',
    type: 'format',
    params: { pattern: '^[A-Za-z0-9-_.]+$', maxLength: 50 },
    message: 'Item number must be alphanumeric (max 50 chars)',
  },
  {
    field: 'itemNumber',
    type: 'unique',
    params: { scope: 'organization' },
    message: 'Item number must be unique within organization',
  },
  {
    field: 'name',
    type: 'required',
    message: 'Item name is required',
  },
  {
    field: 'itemType',
    type: 'required',
    message: 'Item type is required',
  },
  {
    field: 'itemType',
    type: 'lookup',
    params: { values: ['inventory', 'non_inventory', 'service', 'other'] },
    message: 'Invalid item type',
  },
  {
    field: 'unitPrice',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Unit price must be non-negative',
    condition: { field: 'unitPrice', operator: 'exists' },
  },
  {
    field: 'cost',
    type: 'range',
    params: { min: 0 },
    severity: 'warning',
    message: 'Cost must be non-negative',
    condition: { field: 'cost', operator: 'exists' },
  },
];

/**
 * Journal entry validation rules
 */
export const JOURNAL_ENTRY_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'date',
    type: 'required',
    message: 'Entry date is required',
  },
  {
    field: 'date',
    type: 'format',
    params: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    message: 'Date must be in YYYY-MM-DD format',
  },
  {
    field: 'lines',
    type: 'required',
    message: 'Journal entry must have at least one line',
  },
  {
    field: 'lines',
    type: 'custom',
    params: { validator: 'balancedEntry' },
    message: 'Journal entry debits and credits must balance',
  },
];

/**
 * Opening balance validation rules
 */
export const OPENING_BALANCE_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'accountNumber',
    type: 'required',
    message: 'Account number is required',
  },
  {
    field: 'accountNumber',
    type: 'lookup',
    params: { table: 'accounts', field: 'accountNumber' },
    message: 'Account not found',
  },
  {
    field: 'date',
    type: 'required',
    message: 'Date is required',
  },
  {
    field: 'date',
    type: 'format',
    params: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    message: 'Date must be in YYYY-MM-DD format',
  },
  {
    field: 'amount',
    type: 'required',
    message: 'Amount is required',
  },
  {
    field: 'amount',
    type: 'format',
    params: { type: 'number' },
    message: 'Amount must be a valid number',
  },
];

// ============================================================================
// Source System Field Mappings
// ============================================================================

/**
 * QuickBooks Online to GLAPI account mapping
 */
export const QBO_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Id', targetField: 'externalId' },
  { sourceField: 'AcctNum', targetField: 'accountNumber' },
  { sourceField: 'Name', targetField: 'name' },
  { sourceField: 'AccountType', targetField: 'accountType', transformation: 'qboAccountType' },
  { sourceField: 'AccountSubType', targetField: 'accountSubType' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Active', targetField: 'isActive' },
  { sourceField: 'CurrentBalance', targetField: 'balance' },
];

/**
 * QuickBooks Online to GLAPI customer mapping
 */
export const QBO_CUSTOMER_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Id', targetField: 'externalId' },
  { sourceField: 'DisplayName', targetField: 'name' },
  { sourceField: 'PrimaryEmailAddr.Address', targetField: 'email' },
  { sourceField: 'PrimaryPhone.FreeFormNumber', targetField: 'phone' },
  { sourceField: 'BillAddr.Line1', targetField: 'address1' },
  { sourceField: 'BillAddr.Line2', targetField: 'address2' },
  { sourceField: 'BillAddr.City', targetField: 'city' },
  { sourceField: 'BillAddr.CountrySubDivisionCode', targetField: 'state' },
  { sourceField: 'BillAddr.PostalCode', targetField: 'postalCode' },
  { sourceField: 'BillAddr.Country', targetField: 'country' },
  { sourceField: 'Balance', targetField: 'balance' },
  { sourceField: 'Active', targetField: 'isActive' },
];

/**
 * Xero to GLAPI account mapping
 */
export const XERO_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'AccountID', targetField: 'externalId' },
  { sourceField: 'Code', targetField: 'accountNumber' },
  { sourceField: 'Name', targetField: 'name' },
  { sourceField: 'Type', targetField: 'accountType', transformation: 'xeroAccountType' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Status', targetField: 'isActive', transformation: 'xeroStatus' },
  { sourceField: 'BankAccountNumber', targetField: 'bankAccountNumber' },
];

/**
 * CSV account mapping (generic)
 */
export const CSV_ACCOUNT_MAPPING: ImportFieldMapping[] = [
  { sourceField: 'Account Number', targetField: 'accountNumber' },
  { sourceField: 'Account Name', targetField: 'name' },
  { sourceField: 'Account Type', targetField: 'accountType' },
  { sourceField: 'Normal Balance', targetField: 'normalBalance' },
  { sourceField: 'Description', targetField: 'description' },
  { sourceField: 'Parent Account', targetField: 'parentAccountNumber' },
  { sourceField: 'Active', targetField: 'isActive', transformation: 'boolean' },
];

// ============================================================================
// Import Event Types
// ============================================================================

/**
 * Import event type
 */
export type ImportEventType =
  | 'BATCH_CREATED'
  | 'BATCH_VALIDATION_STARTED'
  | 'BATCH_VALIDATION_COMPLETED'
  | 'BATCH_IMPORT_STARTED'
  | 'BATCH_IMPORT_COMPLETED'
  | 'BATCH_FAILED'
  | 'BATCH_CANCELLED'
  | 'BATCH_ROLLED_BACK'
  | 'RECORD_VALIDATED'
  | 'RECORD_IMPORTED'
  | 'RECORD_SKIPPED'
  | 'RECORD_FAILED';

/**
 * Import event
 */
export interface ImportEvent {
  type: ImportEventType;
  batchId: string;
  recordId?: string;
  timestamp: Date;
  userId: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Import Progress
// ============================================================================

/**
 * Import progress
 */
export interface ImportProgress {
  batchId: string;
  status: ImportBatchStatus;
  phase: 'validation' | 'import' | 'complete';
  totalRecords: number;
  processedRecords: number;
  percentComplete: number;
  currentRecord?: number;
  estimatedTimeRemaining?: number;
  errors: number;
  warnings: number;
}

// ============================================================================
// Import Request/Response Types
// ============================================================================

/**
 * Create import batch request
 */
export interface CreateImportBatchRequest {
  organizationId: string;
  name: string;
  description?: string;
  sourceSystem: ImportSourceSystem;
  dataTypes: ImportDataType[];
  sourceFile?: string;
  options?: ImportBatchOptions;
  userId: string;
}

/**
 * Add records to batch request
 */
export interface AddRecordsToBatchRequest {
  batchId: string;
  records: Array<{
    rowNumber: number;
    externalId?: string;
    dataType: ImportDataType;
    rawData: Record<string, unknown>;
  }>;
}

/**
 * Validate batch request
 */
export interface ValidateBatchRequest {
  batchId: string;
  fieldMappingId?: string;
  options?: ImportBatchOptions;
}

/**
 * Execute import request
 */
export interface ExecuteImportRequest {
  batchId: string;
  options?: ImportBatchOptions;
}

/**
 * Rollback import request
 */
export interface RollbackImportRequest {
  batchId: string;
  userId: string;
  reason?: string;
}
