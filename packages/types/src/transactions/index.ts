/**
 * Transaction types
 *
 * This module contains type definitions for GL transactions, business transactions,
 * sales orders, posting rules, FX handling, and other financial transaction types.
 */

import { z } from 'zod';

// ============================================================================
// Transaction Type Schema
// ============================================================================

/**
 * Transaction type category enum
 */
export const TransactionTypeCategoryEnum = z.enum([
  'SALES',
  'PURCHASE',
  'INVENTORY',
  'GL',
  'PROJECT',
]);

export type TransactionTypeCategory = z.infer<typeof TransactionTypeCategoryEnum>;

/**
 * Transaction type schema for defining different transaction types
 */
export const transactionTypeSchema = z.object({
  id: z.string().uuid().optional(),
  typeCode: z.string().min(1).max(10),
  typeName: z.string().min(1).max(100),
  typeCategory: TransactionTypeCategoryEnum.optional(),
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
  updatedAt: true,
});

export const updateTransactionTypeSchema = transactionTypeSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type CreateTransactionTypeInput = z.infer<typeof createTransactionTypeSchema>;
export type UpdateTransactionTypeInput = z.infer<typeof updateTransactionTypeSchema>;

// ============================================================================
// Business Transaction Status
// ============================================================================

/**
 * Business transaction status enum
 */
export const BusinessTransactionStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'POSTED',
  'PAID',
  'CLOSED',
  'CANCELLED',
]);

export type BusinessTransactionStatus = z.infer<typeof BusinessTransactionStatusEnum>;

/**
 * Entity type enum for business transactions
 */
export const TransactionEntityTypeEnum = z.enum(['CUSTOMER', 'VENDOR', 'EMPLOYEE']);

export type TransactionEntityType = z.infer<typeof TransactionEntityTypeEnum>;

/**
 * Sales stage enum for opportunity/estimate tracking
 */
export const SalesStageEnum = z.enum([
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
]);

export type SalesStage = z.infer<typeof SalesStageEnum>;

// ============================================================================
// Business Transaction Schema
// ============================================================================

/**
 * Business transaction schema for sales, purchases, etc.
 */
export const businessTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  transactionNumber: z.string(),
  transactionTypeId: z.string().uuid(),
  subsidiaryId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  entityType: TransactionEntityTypeEnum.optional(),
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
  status: BusinessTransactionStatusEnum,
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
  salesStage: SalesStageEnum.optional(),
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

// ============================================================================
// Business Transaction Line Schema
// ============================================================================

/**
 * Business transaction line type enum
 */
export const TransactionLineTypeEnum = z.enum(['ITEM', 'SERVICE', 'DISCOUNT', 'TAX', 'SHIPPING']);

export type TransactionLineType = z.infer<typeof TransactionLineTypeEnum>;

/**
 * Business transaction line schema
 */
export const businessTransactionLineSchema = z.object({
  id: z.string().uuid().optional(),
  businessTransactionId: z.string().uuid(),
  lineNumber: z.number().int(),
  lineType: TransactionLineTypeEnum,
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
  updatedAt: true,
});

export const updateBusinessTransactionLineSchema = businessTransactionLineSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BusinessTransactionLine = z.infer<typeof businessTransactionLineSchema>;
export type CreateBusinessTransactionLineInput = z.infer<
  typeof createBusinessTransactionLineSchema
>;
export type UpdateBusinessTransactionLineInput = z.infer<
  typeof updateBusinessTransactionLineSchema
>;

// ============================================================================
// GL Transaction Schema
// ============================================================================

/**
 * GL transaction type enum
 */
export const GlTransactionTypeEnum = z.enum(['JOURNAL', 'POSTING', 'REVERSAL', 'CLOSING']);

export type GlTransactionType = z.infer<typeof GlTransactionTypeEnum>;

/**
 * GL source system enum
 */
export const GlSourceSystemEnum = z.enum(['MANUAL', 'AUTO', 'IMPORT']);

export type GlSourceSystem = z.infer<typeof GlSourceSystemEnum>;

/**
 * GL transaction status enum
 */
export const GlTransactionStatusEnum = z.enum(['DRAFT', 'PENDING', 'POSTED', 'REVERSED']);

export type GlTransactionStatus = z.infer<typeof GlTransactionStatusEnum>;

/**
 * GL transaction schema
 */
export const glTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  transactionNumber: z.string(),
  subsidiaryId: z.string().uuid(),
  transactionDate: z.string().or(z.date()),
  postingDate: z.string().or(z.date()),
  periodId: z.string().uuid(),
  transactionType: GlTransactionTypeEnum,
  sourceSystem: GlSourceSystemEnum.optional(),
  sourceTransactionId: z.string().uuid().optional(),
  sourceTransactionType: z.string().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  baseCurrencyCode: z.string().min(3).max(3),
  totalDebitAmount: z.string().or(z.number()),
  totalCreditAmount: z.string().or(z.number()),
  status: GlTransactionStatusEnum,
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

// ============================================================================
// GL Transaction Line Schema
// ============================================================================

/**
 * GL transaction line schema
 */
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
  createdDate: true,
});

export const updateGlTransactionLineSchema = glTransactionLineSchema.partial().omit({
  id: true,
  createdDate: true,
});

export type GlTransactionLine = z.infer<typeof glTransactionLineSchema>;
export type CreateGlTransactionLineInput = z.infer<typeof createGlTransactionLineSchema>;
export type UpdateGlTransactionLineInput = z.infer<typeof updateGlTransactionLineSchema>;

// ============================================================================
// GL Posting Rule Schema
// ============================================================================

/**
 * GL posting rule schema for automated posting
 */
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
  modifiedDate: true,
});

export const updateGlPostingRuleSchema = glPostingRuleSchema.partial().omit({
  id: true,
  createdDate: true,
  modifiedDate: true,
});

export type GlPostingRule = z.infer<typeof glPostingRuleSchema>;
export type CreateGlPostingRuleInput = z.infer<typeof createGlPostingRuleSchema>;
export type UpdateGlPostingRuleInput = z.infer<typeof updateGlPostingRuleSchema>;

// ============================================================================
// Transaction Actions
// ============================================================================

/**
 * Request to post a transaction
 */
export interface PostTransactionRequest {
  transactionId: string;
  postingDate?: string | Date;
  overrideChecks?: boolean;
}

/**
 * Request to reverse a transaction
 */
export interface ReverseTransactionRequest {
  transactionId: string;
  reversalDate?: string | Date;
  reversalReason: string;
}

/**
 * Request to approve a transaction
 */
export interface ApproveTransactionRequest {
  transactionId: string;
  approvalComment?: string;
}

// ============================================================================
// Transaction with Lines (composite types)
// ============================================================================

/**
 * Business transaction with its lines
 */
export interface BusinessTransactionWithLines {
  transaction: CreateBusinessTransactionInput | UpdateBusinessTransactionInput;
  lines: (CreateBusinessTransactionLineInput | UpdateBusinessTransactionLineInput)[];
}

/**
 * GL transaction with its lines
 */
export interface GlTransactionWithLines {
  transaction: CreateGlTransactionInput | UpdateGlTransactionInput;
  lines: (CreateGlTransactionLineInput | UpdateGlTransactionLineInput)[];
}

// ============================================================================
// FX Rate Handling
// ============================================================================

/**
 * FX rate source - where the exchange rate came from
 */
export const FxRateSourceEnum = z.enum(['MANUAL', 'MARKET', 'CENTRAL_BANK', 'SYSTEM_DEFAULT']);
export type FxRateSource = z.infer<typeof FxRateSourceEnum>;

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
  rateSource: FxRateSourceEnum,
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

// ============================================================================
// Double-Entry Validation
// ============================================================================

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

// ============================================================================
// Posting Results and Audit
// ============================================================================

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

// ============================================================================
// Sales Order Types
// ============================================================================

/**
 * Input for creating a new sales order
 */
export interface CreateSalesOrderInput {
  subsidiaryId: string;
  entityId: string;
  orderDate: string | Date;
  externalReference?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  expirationDate?: string | Date;
  currencyCode?: string;
  exchangeRate?: number | string;
  discountAmount?: number | string;
  discountPercent?: number | string;
  shippingAmount?: number | string;
  paymentTerms?: string;
  shippingMethod?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  requiresApproval?: boolean;
  approvalThreshold?: number | string;
  lines: CreateSalesOrderLineInput[];
}

/**
 * Input for creating a sales order line
 */
export interface CreateSalesOrderLineInput {
  itemId?: string;
  description: string;
  sku?: string;
  quantity: number | string;
  unitOfMeasure?: string;
  unitPrice: number | string;
  discountAmount?: number | string;
  discountPercent?: number | string;
  taxAmount?: number | string;
  taxCode?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
  revenueBehavior?: 'point_in_time' | 'over_time';
  sspAmount?: number | string;
  listPrice?: number | string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating a sales order (draft only)
 */
export interface UpdateSalesOrderInput {
  entityId?: string;
  orderDate?: string | Date;
  externalReference?: string;
  billingAddressId?: string;
  shippingAddressId?: string;
  requestedDeliveryDate?: string | Date;
  promisedDeliveryDate?: string | Date;
  expirationDate?: string | Date;
  currencyCode?: string;
  exchangeRate?: number | string;
  discountAmount?: number | string;
  discountPercent?: number | string;
  shippingAmount?: number | string;
  paymentTerms?: string;
  shippingMethod?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  requiresApproval?: boolean;
  approvalThreshold?: number | string;
  lines?: UpdateSalesOrderLineInput[];
}

/**
 * Input for updating a sales order line
 */
export interface UpdateSalesOrderLineInput extends Partial<CreateSalesOrderLineInput> {
  id?: string; // If provided, updates existing line; otherwise creates new
  _delete?: boolean; // If true, deletes the line
}

/**
 * Input for approval actions
 */
export interface ApprovalActionInput {
  action: string;
  comments?: string;
  reason?: string;
  delegateTo?: string; // For DELEGATE action
}

/**
 * Input for creating invoice from sales order
 */
export interface CreateInvoiceFromOrderInput {
  salesOrderId: string;
  lineIds?: string[]; // Specific lines to invoice; if empty, invoice all remaining
  quantities?: Record<string, number | string>; // Override quantities per line ID
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  memo?: string;
}

/**
 * Filter options for listing sales orders
 */
export interface SalesOrderFilters {
  status?: string | string[];
  entityId?: string;
  subsidiaryId?: string;
  orderDateFrom?: string | Date;
  orderDateTo?: string | Date;
  minAmount?: number | string;
  maxAmount?: number | string;
  search?: string; // Search in order number, external reference, memo
  requiresApproval?: boolean;
  pendingApproval?: boolean;
}

/**
 * Sales order with all details
 */
export interface SalesOrderWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  orderNumber: string;
  externalReference?: string;
  entityId: string;
  entity?: {
    id: string;
    name: string;
    email?: string;
  };
  billingAddressId?: string;
  shippingAddressId?: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  expirationDate?: string;
  status: string;
  previousStatus?: string;
  currencyCode: string;
  exchangeRate: string;
  subtotal: string;
  discountAmount: string;
  discountPercent: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  fulfilledAmount: string;
  invoicedAmount: string;
  remainingAmount: string;
  paymentTerms?: string;
  shippingMethod?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  requiresApproval: boolean;
  approvalThreshold?: string;
  currentApproverId?: string;
  approvalLevel: number;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  closedAt?: string;
  closedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  lines: SalesOrderLineWithDetails[];
  approvalHistory?: ApprovalHistoryEntry[];
  invoiceLinks?: SalesOrderInvoiceLinkDetails[];
}

/**
 * Sales order line with details
 */
export interface SalesOrderLineWithDetails {
  id: string;
  salesOrderId: string;
  lineNumber: number;
  itemId?: string;
  item?: {
    id: string;
    name: string;
    sku?: string;
  };
  description: string;
  sku?: string;
  quantity: string;
  unitOfMeasure?: string;
  fulfilledQuantity: string;
  invoicedQuantity: string;
  cancelledQuantity: string;
  remainingQuantity: string;
  unitPrice: string;
  discountAmount: string;
  discountPercent: string;
  taxAmount: string;
  taxCode?: string;
  lineTotal: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  revenueAccountId?: string;
  deferredRevenueAccountId?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Approval history entry
 */
export interface ApprovalHistoryEntry {
  id: string;
  salesOrderId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  actorName?: string;
  delegatedFrom?: string;
  approvalLevel: number;
  comments?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Sales order invoice link details
 */
export interface SalesOrderInvoiceLinkDetails {
  id: string;
  salesOrderId: string;
  invoiceId: string;
  invoiceNumber?: string;
  invoicedAmount: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Result of status transition validation
 */
export interface StatusTransitionResult {
  valid: boolean;
  currentStatus: string;
  targetStatus: string;
  allowedTransitions: string[];
  reason?: string;
}

/**
 * Result of creating invoice from order
 */
export interface CreateInvoiceFromOrderResult {
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    status: string;
    invoicedAmount: string;
    remainingAmount: string;
  };
  linesInvoiced: number;
}

// ============================================================================
// Sales Order State Machine
// ============================================================================

/**
 * State machine event types
 */
export type SalesOrderEvent =
  | { type: 'SUBMIT' }
  | { type: 'APPROVE'; approverId: string }
  | { type: 'REJECT'; reason: string }
  | { type: 'FULFILL'; amount: number }
  | { type: 'INVOICE'; amount: number }
  | { type: 'CLOSE' }
  | { type: 'CANCEL'; reason: string }
  | { type: 'HOLD' }
  | { type: 'RELEASE' }
  | { type: 'REVISE' };

/**
 * State machine context
 */
export interface SalesOrderStateMachineContext {
  orderId: string;
  currentStatus: string;
  totalAmount: number;
  fulfilledAmount: number;
  invoicedAmount: number;
  requiresApproval: boolean;
  approvalThreshold?: number;
}
