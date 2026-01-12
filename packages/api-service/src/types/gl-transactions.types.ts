import { z } from 'zod';

// Business Transaction Types
export const transactionTypeSchema = z.object({
  id: z.string().uuid().optional(),
  typeCode: z.string().min(1).max(10),
  typeName: z.string().min(1).max(100),
  typeCategory: z.enum(['SALES', 'PURCHASE', 'INVENTORY', 'GL', 'PROJECT']).optional(),
  generatesGl: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  canBeReversed: z.boolean().default(true),
  numberingSequence: z.string().optional(),
  defaultGlAccountId: z.string().uuid().optional(),
  workflowTemplate: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const createTransactionTypeSchema = transactionTypeSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateTransactionTypeSchema = transactionTypeSchema.partial().omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CreateTransactionTypeInput = z.infer<typeof createTransactionTypeSchema>;
export type UpdateTransactionTypeInput = z.infer<typeof updateTransactionTypeSchema>;

// Business Transaction Schema
export const businessTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  transactionNumber: z.string(),
  transactionTypeId: z.string().uuid(),
  subsidiaryId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  entityType: z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE']).optional(),
  transactionDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional(),
  termsId: z.string().uuid().optional(),
  currencyCode: z.string().min(3).max(3),
  exchangeRate: z.string().or(z.number()).default('1'),
  subtotalAmount: z.string().or(z.number()).default('0'),
  taxAmount: z.string().or(z.number()).default('0'),
  discountAmount: z.string().or(z.number()).default('0'),
  totalAmount: z.string().or(z.number()),
  baseTotalAmount: z.string().or(z.number()),
  memo: z.string().optional(),
  externalReference: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED', 'CANCELLED']),
  workflowStatus: z.string().optional(),
  shipDate: z.string().or(z.date()).optional(),
  shippedVia: z.string().optional(),
  trackingNumber: z.string().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddressId: z.string().uuid().optional(),
  salesRepId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  
  // Opportunity/Estimate fields
  salesStage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
  probability: z.string().or(z.number()).optional(),
  expectedCloseDate: z.string().or(z.date()).optional(),
  leadSource: z.string().optional(),
  competitor: z.string().optional(),
  estimateValidUntil: z.string().or(z.date()).optional(),
  
  // Project tracking
  estimatedHours: z.string().or(z.number()).optional(),
  markupPercent: z.string().or(z.number()).optional(),
  marginPercent: z.string().or(z.number()).optional(),
  
  // Relationships
  parentTransactionId: z.string().uuid().optional(),
  rootTransactionId: z.string().uuid().optional(),
  glTransactionId: z.string().uuid().optional(),
  
  // Audit fields
  createdBy: z.string().uuid().optional(),
  createdDate: z.date().optional(),
  modifiedBy: z.string().uuid().optional(),
  modifiedDate: z.date().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedDate: z.date().optional(),
  postedDate: z.date().optional(),
  versionNumber: z.number().int().default(1),
});

export const createBusinessTransactionSchema = businessTransactionSchema.omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true,
  versionNumber: true,
  transactionNumber: true, // Auto-generated
});

export const updateBusinessTransactionSchema = businessTransactionSchema.partial().omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true,
  transactionNumber: true,
});

export type BusinessTransaction = z.infer<typeof businessTransactionSchema>;
export type CreateBusinessTransactionInput = z.infer<typeof createBusinessTransactionSchema>;
export type UpdateBusinessTransactionInput = z.infer<typeof updateBusinessTransactionSchema>;

// Business Transaction Line Schema
export const businessTransactionLineSchema = z.object({
  id: z.string().uuid().optional(),
  businessTransactionId: z.string().uuid(),
  lineNumber: z.number().int(),
  lineType: z.enum(['ITEM', 'SERVICE', 'DISCOUNT', 'TAX', 'SHIPPING']),
  itemId: z.string().uuid().optional(),
  description: z.string(),
  quantity: z.string().or(z.number()).default('0'),
  unitOfMeasure: z.string().optional(),
  unitPrice: z.string().or(z.number()).default('0'),
  discountPercent: z.string().or(z.number()).default('0'),
  discountAmount: z.string().or(z.number()).default('0'),
  lineAmount: z.string().or(z.number()),
  taxCodeId: z.string().uuid().optional(),
  taxAmount: z.string().or(z.number()).default('0'),
  totalLineAmount: z.string().or(z.number()),
  accountId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  activityCodeId: z.string().uuid().optional(),
  
  // Service/Time tracking
  billableFlag: z.boolean().default(true),
  billingRate: z.string().or(z.number()).optional(),
  hoursWorked: z.string().or(z.number()).optional(),
  employeeId: z.string().uuid().optional(),
  workDate: z.string().or(z.date()).optional(),
  
  // Fulfillment tracking
  parentLineId: z.string().uuid().optional(),
  quantityReceived: z.string().or(z.number()).default('0'),
  quantityBilled: z.string().or(z.number()).default('0'),
  quantityShipped: z.string().or(z.number()).default('0'),
  
  // Costing
  costAmount: z.string().or(z.number()).default('0'),
  marginAmount: z.string().or(z.number()).optional(),
  
  // Inventory tracking
  serialNumbers: z.array(z.string()).optional(),
  lotNumbers: z.array(z.string()).optional(),
  
  // Estimates
  estimatedHours: z.string().or(z.number()).optional(),
  hourlyRate: z.string().or(z.number()).optional(),
  costEstimate: z.string().or(z.number()).optional(),
  
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const createBusinessTransactionLineSchema = businessTransactionLineSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateBusinessTransactionLineSchema = businessTransactionLineSchema.partial().omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type BusinessTransactionLine = z.infer<typeof businessTransactionLineSchema>;
export type CreateBusinessTransactionLineInput = z.infer<typeof createBusinessTransactionLineSchema>;
export type UpdateBusinessTransactionLineInput = z.infer<typeof updateBusinessTransactionLineSchema>;

// GL Transaction Schema
export const glTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  transactionNumber: z.string(),
  subsidiaryId: z.string().uuid(),
  transactionDate: z.string().or(z.date()),
  postingDate: z.string().or(z.date()),
  periodId: z.string().uuid(),
  transactionType: z.enum(['JOURNAL', 'POSTING', 'REVERSAL', 'CLOSING']),
  sourceSystem: z.enum(['MANUAL', 'AUTO', 'IMPORT']).optional(),
  sourceTransactionId: z.string().uuid().optional(),
  sourceTransactionType: z.string().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  baseCurrencyCode: z.string().min(3).max(3),
  totalDebitAmount: z.string().or(z.number()),
  totalCreditAmount: z.string().or(z.number()),
  status: z.enum(['DRAFT', 'PENDING', 'POSTED', 'REVERSED']),
  recurringTemplateId: z.string().uuid().optional(),
  reversedByTransactionId: z.string().uuid().optional(),
  reversalReason: z.string().optional(),
  autoGenerated: z.boolean().default(false),
  
  // Audit fields
  createdBy: z.string().uuid().optional(),
  createdDate: z.date().optional(),
  modifiedBy: z.string().uuid().optional(),
  modifiedDate: z.date().optional(),
  postedBy: z.string().uuid().optional(),
  postedDate: z.date().optional(),
  versionNumber: z.number().int().default(1),
});

export const createGlTransactionSchema = glTransactionSchema.omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true,
  versionNumber: true,
  transactionNumber: true, // Auto-generated
});

export const updateGlTransactionSchema = glTransactionSchema.partial().omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true,
  transactionNumber: true,
});

export type GlTransaction = z.infer<typeof glTransactionSchema>;
export type CreateGlTransactionInput = z.infer<typeof createGlTransactionSchema>;
export type UpdateGlTransactionInput = z.infer<typeof updateGlTransactionSchema>;

// GL Transaction Line Schema
export const glTransactionLineSchema = z.object({
  id: z.string().uuid().optional(),
  transactionId: z.string().uuid(),
  lineNumber: z.number().int(),
  accountId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  subsidiaryId: z.string().uuid(),
  debitAmount: z.string().or(z.number()).default('0'),
  creditAmount: z.string().or(z.number()).default('0'),
  currencyCode: z.string().min(3).max(3),
  exchangeRate: z.string().or(z.number()).default('1'),
  baseDebitAmount: z.string().or(z.number()).default('0'),
  baseCreditAmount: z.string().or(z.number()).default('0'),
  description: z.string().optional(),
  reference1: z.string().optional(),
  reference2: z.string().optional(),
  projectId: z.string().uuid().optional(),
  createdDate: z.date().optional(),
});

export const createGlTransactionLineSchema = glTransactionLineSchema.omit({ 
  id: true, 
  createdDate: true 
});

export const updateGlTransactionLineSchema = glTransactionLineSchema.partial().omit({ 
  id: true, 
  createdDate: true 
});

export type GlTransactionLine = z.infer<typeof glTransactionLineSchema>;
export type CreateGlTransactionLineInput = z.infer<typeof createGlTransactionLineSchema>;
export type UpdateGlTransactionLineInput = z.infer<typeof updateGlTransactionLineSchema>;

// Posting Rule Schema
export const glPostingRuleSchema = z.object({
  id: z.string().uuid().optional(),
  transactionTypeId: z.string().uuid(),
  subsidiaryId: z.string().uuid().optional(),
  ruleName: z.string(),
  sequenceNumber: z.number().int().default(10),
  lineType: z.string().optional(),
  conditionSql: z.string().optional(),
  debitAccountId: z.string().uuid().optional(),
  creditAccountId: z.string().uuid().optional(),
  amountFormula: z.string().optional(),
  descriptionTemplate: z.string().optional(),
  isActive: z.boolean().default(true),
  effectiveDate: z.string().or(z.date()),
  expirationDate: z.string().or(z.date()).optional(),
  createdBy: z.string().uuid().optional(),
  createdDate: z.date().optional(),
  modifiedDate: z.date().optional(),
});

export const createGlPostingRuleSchema = glPostingRuleSchema.omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true 
});

export const updateGlPostingRuleSchema = glPostingRuleSchema.partial().omit({ 
  id: true, 
  createdDate: true, 
  modifiedDate: true 
});

export type GlPostingRule = z.infer<typeof glPostingRuleSchema>;
export type CreateGlPostingRuleInput = z.infer<typeof createGlPostingRuleSchema>;
export type UpdateGlPostingRuleInput = z.infer<typeof updateGlPostingRuleSchema>;

// Transaction Actions
export interface PostTransactionRequest {
  transactionId: string;
  postingDate?: string | Date;
  overrideChecks?: boolean;
}

export interface ReverseTransactionRequest {
  transactionId: string;
  reversalDate?: string | Date;
  reversalReason: string;
}

export interface ApproveTransactionRequest {
  transactionId: string;
  approvalComment?: string;
}

// Transaction with Lines (for creation/updates)
export interface BusinessTransactionWithLines {
  transaction: CreateBusinessTransactionInput | UpdateBusinessTransactionInput;
  lines: (CreateBusinessTransactionLineInput | UpdateBusinessTransactionLineInput)[];
}

export interface GlTransactionWithLines {
  transaction: CreateGlTransactionInput | UpdateGlTransactionInput;
  lines: (CreateGlTransactionLineInput | UpdateGlTransactionLineInput)[];
}

// =============================================================================
// Double-Entry and FX Handling Types (glapi-czl)
// =============================================================================

/**
 * FX Rate Source - where the exchange rate came from
 */
export type FxRateSource = 'MANUAL' | 'MARKET' | 'CENTRAL_BANK' | 'SYSTEM_DEFAULT';

/**
 * FX rate metadata captured with each posting
 */
export const fxRateMetadataSchema = z.object({
  /** Source currency code (ISO 4217) */
  sourceCurrency: z.string().length(3),
  /** Target/base currency code (ISO 4217) */
  targetCurrency: z.string().length(3),
  /** Exchange rate used for conversion */
  exchangeRate: z.string().or(z.number()),
  /** Inverse rate (1 / exchangeRate) for reverse conversion */
  inverseRate: z.string().or(z.number()).optional(),
  /** Where the rate came from */
  rateSource: z.enum(['MANUAL', 'MARKET', 'CENTRAL_BANK', 'SYSTEM_DEFAULT']),
  /** Date when the rate was fetched/determined */
  rateDate: z.string().or(z.date()),
  /** Provider or source system for market rates */
  rateProvider: z.string().optional(),
  /** Whether this rate was locked at transaction creation */
  isLockedRate: z.boolean().default(false),
  /** Original rate before any adjustments */
  originalRate: z.string().or(z.number()).optional(),
  /** Variance from market rate (for audit) */
  marketVariance: z.string().or(z.number()).optional(),
});

export type FxRateMetadata = z.infer<typeof fxRateMetadataSchema>;

/**
 * Remeasurement metadata for FX gain/loss tracking
 */
export const fxRemeasurementMetadataSchema = z.object({
  /** Original transaction exchange rate */
  originalRate: z.string().or(z.number()),
  /** Current remeasurement rate */
  remeasurementRate: z.string().or(z.number()),
  /** Date of remeasurement */
  remeasurementDate: z.string().or(z.date()),
  /** Unrealized gain/loss amount in base currency */
  unrealizedGainLoss: z.string().or(z.number()),
  /** Whether this has been realized through settlement */
  isRealized: z.boolean().default(false),
  /** Date when gain/loss was realized */
  realizedDate: z.string().or(z.date()).optional(),
  /** Realized gain/loss amount */
  realizedGainLoss: z.string().or(z.number()).optional(),
  /** Account ID for FX gain/loss posting */
  fxGainLossAccountId: z.string().uuid().optional(),
});

export type FxRemeasurementMetadata = z.infer<typeof fxRemeasurementMetadataSchema>;

/**
 * Double-entry validation result
 */
export interface DoubleEntryValidationResult {
  /** Whether the transaction is balanced */
  isBalanced: boolean;
  /** Total debit amount in transaction currency */
  totalDebits: number;
  /** Total credit amount in transaction currency */
  totalCredits: number;
  /** Difference (should be 0 for balanced transaction) */
  difference: number;
  /** Total debit amount in base currency */
  baseTotalDebits: number;
  /** Total credit amount in base currency */
  baseTotalCredits: number;
  /** Base currency difference */
  baseDifference: number;
  /** Validation errors if any */
  errors: DoubleEntryError[];
  /** Warnings (non-blocking issues) */
  warnings: string[];
}

/**
 * Double-entry validation error
 */
export interface DoubleEntryError {
  /** Error code for programmatic handling */
  code: DoubleEntryErrorCode;
  /** Human-readable error message */
  message: string;
  /** Affected line numbers if applicable */
  affectedLines?: number[];
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Error codes for double-entry validation failures
 */
export type DoubleEntryErrorCode =
  | 'UNBALANCED_TRANSACTION'
  | 'UNBALANCED_BASE_AMOUNTS'
  | 'MISSING_DEBIT_LINE'
  | 'MISSING_CREDIT_LINE'
  | 'INVALID_AMOUNT'
  | 'NEGATIVE_AMOUNT'
  | 'LINE_NOT_BALANCED'
  | 'FX_RATE_MISMATCH'
  | 'INVALID_EXCHANGE_RATE'
  | 'PERIOD_CLOSED'
  | 'PERIOD_LOCKED'
  | 'INSUFFICIENT_LINES';

/**
 * Audit entry for posting attempts (successful or failed)
 */
export interface PostingAuditEntry {
  /** Unique audit entry ID */
  id: string;
  /** Timestamp of the posting attempt */
  timestamp: Date;
  /** User who attempted the posting */
  userId: string;
  /** Organization context */
  organizationId: string;
  /** Subsidiary being posted to */
  subsidiaryId: string;
  /** GL transaction ID if successfully created */
  glTransactionId?: string;
  /** Source transaction ID if posting from business transaction */
  sourceTransactionId?: string;
  /** Whether posting was successful */
  success: boolean;
  /** Action type */
  action: 'POST' | 'REVERSE' | 'DRAFT' | 'VALIDATE';
  /** Validation result */
  validationResult: DoubleEntryValidationResult;
  /** FX metadata if multi-currency */
  fxMetadata?: FxRateMetadata;
  /** Error details if failed */
  errorDetails?: {
    code: string;
    message: string;
    stack?: string;
  };
  /** Request metadata for traceability */
  requestMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
  };
}

/**
 * Options for double-entry validation
 */
export interface DoubleEntryValidationOptions {
  /** Tolerance for rounding differences (default: 0.01) */
  tolerance?: number;
  /** Whether to validate base currency amounts separately */
  validateBaseAmounts?: boolean;
  /** Whether to require at least one debit and one credit line */
  requireBothSides?: boolean;
  /** Whether to allow zero-amount lines */
  allowZeroAmountLines?: boolean;
  /** Whether to validate FX rates */
  validateFxRates?: boolean;
  /** Whether to check accounting period status */
  checkPeriodStatus?: boolean;
}

/**
 * Result of posting a GL transaction
 */
export interface GlPostingResult {
  /** The created GL transaction */
  glTransaction: GlTransaction;
  /** The GL transaction lines */
  glLines: GlTransactionLine[];
  /** Account balance updates to apply */
  balanceUpdates: AccountBalanceUpdate[];
  /** Validation result */
  validationResult: DoubleEntryValidationResult;
  /** FX metadata if multi-currency */
  fxMetadata?: FxRateMetadata;
  /** Audit entry ID */
  auditEntryId: string;
}

/**
 * Account balance update from GL posting
 */
export interface AccountBalanceUpdate {
  accountId: string;
  subsidiaryId: string;
  periodId: string;
  classId?: string;
  departmentId?: string;
  locationId?: string;
  currencyCode: string;
  debitAmount: number;
  creditAmount: number;
  baseDebitAmount: number;
  baseCreditAmount: number;
}