/**
 * Posting Rules DSL Types
 *
 * Defines the domain-specific language for configuring GL posting rules.
 * Rules determine how business transactions are converted to balanced
 * journal entries.
 */

import { AccountDimension } from '../chart-of-accounts/types';

// ============================================================================
// Transaction Types for Posting
// ============================================================================

/**
 * Business transaction types that generate GL entries
 */
export const TransactionType = {
  // Sales Cycle
  SALES_ORDER: 'SALES_ORDER',
  CUSTOMER_INVOICE: 'CUSTOMER_INVOICE',
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
  CREDIT_MEMO: 'CREDIT_MEMO',
  CUSTOMER_REFUND: 'CUSTOMER_REFUND',

  // Purchase Cycle
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  ITEM_RECEIPT: 'ITEM_RECEIPT',
  VENDOR_BILL: 'VENDOR_BILL',
  BILL_PAYMENT: 'BILL_PAYMENT',
  BILL_CREDIT: 'BILL_CREDIT',

  // Subscription/Revenue
  SUBSCRIPTION_INVOICE: 'SUBSCRIPTION_INVOICE',
  REVENUE_RECOGNITION: 'REVENUE_RECOGNITION',
  DEFERRED_REVENUE_ADJUSTMENT: 'DEFERRED_REVENUE_ADJUSTMENT',

  // Inventory
  INVENTORY_ADJUSTMENT: 'INVENTORY_ADJUSTMENT',
  INVENTORY_TRANSFER: 'INVENTORY_TRANSFER',

  // GL
  JOURNAL_ENTRY: 'JOURNAL_ENTRY',
  RECURRING_JOURNAL: 'RECURRING_JOURNAL',
  CLOSING_ENTRY: 'CLOSING_ENTRY',
} as const;

export type TransactionTypeValue = (typeof TransactionType)[keyof typeof TransactionType];

/**
 * Line types within a business transaction
 */
export const LineType = {
  ITEM: 'ITEM',
  SERVICE: 'SERVICE',
  DISCOUNT: 'DISCOUNT',
  TAX: 'TAX',
  SHIPPING: 'SHIPPING',
  ADJUSTMENT: 'ADJUSTMENT',
  TIME: 'TIME',
  EXPENSE: 'EXPENSE',
  ALL: 'ALL', // Matches all line types
} as const;

export type LineTypeValue = (typeof LineType)[keyof typeof LineType];

// ============================================================================
// Posting Rule Definition
// ============================================================================

/**
 * A posting rule defines how to generate GL entries from business transactions
 */
export interface PostingRule {
  /** Unique rule identifier */
  id: string;

  /** Rule name for display */
  name: string;

  /** Description of what this rule does */
  description?: string;

  /** Transaction type this rule applies to */
  transactionType: TransactionTypeValue;

  /** Optional subsidiary restriction */
  subsidiaryId?: string;

  /** Order of execution (lower = first) */
  sequenceNumber: number;

  /** Line type filter (null = applies to all) */
  lineType?: LineTypeValue;

  /** SQL-like condition for when rule applies */
  condition?: PostingCondition;

  /** Account to debit (null if rule only credits) */
  debitAccountId?: string;

  /** Account to credit (null if rule only debits) */
  creditAccountId?: string;

  /** Formula to calculate the amount */
  amountFormula: AmountFormula;

  /** Template for GL line description */
  descriptionTemplate?: string;

  /** Whether this rule is currently active */
  isActive: boolean;

  /** Rule effective date */
  effectiveDate: string;

  /** Rule expiration date (null = no expiration) */
  expirationDate?: string;

  /** Priority for conflict resolution (higher = wins) */
  priority: number;

  /** Dimension inheritance rules */
  dimensionRules?: DimensionInheritanceRule[];

  /** Tags for organization */
  tags?: string[];
}

// ============================================================================
// Condition DSL
// ============================================================================

/**
 * Condition for when a posting rule applies
 */
export type PostingCondition =
  | SimpleCondition
  | CompositeCondition;

/**
 * Simple comparison condition
 */
export interface SimpleCondition {
  type: 'simple';
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | number[];
}

/**
 * Composite condition combining multiple conditions
 */
export interface CompositeCondition {
  type: 'composite';
  operator: 'AND' | 'OR';
  conditions: PostingCondition[];
}

/**
 * Fields that can be used in conditions
 */
export const ConditionField = {
  // Line fields
  LINE_TYPE: 'line.lineType',
  LINE_AMOUNT: 'line.amount',
  LINE_QUANTITY: 'line.quantity',
  ITEM_ID: 'line.itemId',
  ITEM_TYPE: 'line.itemType',
  ITEM_CATEGORY: 'line.itemCategory',
  TAX_CODE: 'line.taxCode',
  IS_BILLABLE: 'line.isBillable',

  // Transaction fields
  TRANSACTION_TYPE: 'transaction.type',
  SUBSIDIARY_ID: 'transaction.subsidiaryId',
  CURRENCY_CODE: 'transaction.currencyCode',
  CUSTOMER_ID: 'transaction.customerId',
  VENDOR_ID: 'transaction.vendorId',
  PROJECT_ID: 'transaction.projectId',
  DEPARTMENT_ID: 'transaction.departmentId',
  LOCATION_ID: 'transaction.locationId',
  CLASS_ID: 'transaction.classId',

  // Derived fields
  IS_REVERSAL: 'transaction.isReversal',
  IS_INTERCOMPANY: 'transaction.isIntercompany',
  TOTAL_AMOUNT: 'transaction.totalAmount',
} as const;

export type ConditionField = (typeof ConditionField)[keyof typeof ConditionField];

/**
 * Comparison operators for conditions
 */
export const ConditionOperator = {
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  GREATER_THAN: 'gt',
  GREATER_OR_EQUAL: 'gte',
  LESS_THAN: 'lt',
  LESS_OR_EQUAL: 'lte',
  IN: 'in',
  NOT_IN: 'not_in',
  IS_NULL: 'is_null',
  IS_NOT_NULL: 'is_not_null',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
} as const;

export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator];

// ============================================================================
// Amount Formula DSL
// ============================================================================

/**
 * Formula for calculating posting amounts
 */
export type AmountFormula =
  | FieldFormula
  | ConstantFormula
  | ArithmeticFormula
  | ConditionalFormula;

/**
 * Simple field reference
 */
export interface FieldFormula {
  type: 'field';
  field: AmountField;
}

/**
 * Constant value
 */
export interface ConstantFormula {
  type: 'constant';
  value: number;
}

/**
 * Arithmetic operation
 */
export interface ArithmeticFormula {
  type: 'arithmetic';
  operator: '+' | '-' | '*' | '/';
  left: AmountFormula;
  right: AmountFormula;
}

/**
 * Conditional formula (if-then-else)
 */
export interface ConditionalFormula {
  type: 'conditional';
  condition: PostingCondition;
  ifTrue: AmountFormula;
  ifFalse: AmountFormula;
}

/**
 * Fields that can be used as amount sources
 */
export const AmountField = {
  LINE_AMOUNT: 'line.amount',
  LINE_TAX_AMOUNT: 'line.taxAmount',
  LINE_DISCOUNT_AMOUNT: 'line.discountAmount',
  LINE_COST_AMOUNT: 'line.costAmount',
  LINE_QUANTITY: 'line.quantity',
  LINE_UNIT_PRICE: 'line.unitPrice',
  TRANSACTION_TOTAL: 'transaction.totalAmount',
  TRANSACTION_TAX_TOTAL: 'transaction.taxTotal',
  TRANSACTION_DISCOUNT_TOTAL: 'transaction.discountTotal',
  TRANSACTION_SUBTOTAL: 'transaction.subtotal',
} as const;

export type AmountField = (typeof AmountField)[keyof typeof AmountField];

// ============================================================================
// Dimension Inheritance
// ============================================================================

/**
 * Rule for inheriting dimensions from business transaction to GL lines
 */
export interface DimensionInheritanceRule {
  /** Dimension to set on GL line */
  targetDimension: AccountDimension;

  /** Source to inherit from */
  source: DimensionSource;

  /** Whether this dimension is required */
  required: boolean;

  /** Default value if source is empty */
  defaultValue?: string;
}

/**
 * Source for dimension values
 */
export type DimensionSource =
  | { type: 'line'; field: string }
  | { type: 'transaction'; field: string }
  | { type: 'account'; field: string }
  | { type: 'constant'; value: string };

// ============================================================================
// Posting Rule Set
// ============================================================================

/**
 * A complete set of posting rules for an organization
 */
export interface PostingRuleSet {
  /** Rule set identifier */
  id: string;

  /** Organization this rule set belongs to */
  organizationId: string;

  /** Rule set name */
  name: string;

  /** Description */
  description?: string;

  /** Version number */
  version: string;

  /** All posting rules in this set */
  rules: PostingRule[];

  /** Default dimension inheritance rules */
  defaultDimensionRules: DimensionInheritanceRule[];

  /** Global validation settings */
  validationSettings: ValidationSettings;

  /** Whether this is the active rule set */
  isActive: boolean;

  /** When this rule set was created */
  createdAt: string;

  /** When this rule set was last updated */
  updatedAt: string;
}

/**
 * Validation settings for posting rules
 */
export interface ValidationSettings {
  /** Tolerance for balance checking (default: 0.01) */
  balanceTolerance: number;

  /** Whether to validate base currency amounts */
  validateBaseAmounts: boolean;

  /** Whether to require both debit and credit lines */
  requireBothSides: boolean;

  /** Whether to allow zero-amount lines */
  allowZeroAmountLines: boolean;

  /** Whether to validate FX rates */
  validateFxRates: boolean;

  /** Whether to check accounting period status */
  checkPeriodStatus: boolean;

  /** Maximum number of lines per transaction */
  maxLinesPerTransaction?: number;
}

// ============================================================================
// Posting Result Types
// ============================================================================

/**
 * Result of evaluating posting rules
 */
export interface PostingEvaluationResult {
  /** Generated GL lines */
  lines: GeneratedGlLine[];

  /** Rules that were applied */
  appliedRules: AppliedRuleInfo[];

  /** Validation result */
  validation: BalanceValidationResult;

  /** Any warnings generated */
  warnings: string[];
}

/**
 * A generated GL line from posting rules
 */
export interface GeneratedGlLine {
  /** Line number within the GL transaction */
  lineNumber: number;

  /** Account to post to */
  accountId: string;

  /** Debit amount (0 if credit) */
  debitAmount: number;

  /** Credit amount (0 if debit) */
  creditAmount: number;

  /** Transaction currency code */
  currencyCode: string;

  /** Exchange rate to base currency */
  exchangeRate: number;

  /** Base currency debit amount */
  baseDebitAmount: number;

  /** Base currency credit amount */
  baseCreditAmount: number;

  /** Line description */
  description: string;

  /** Subsidiary ID */
  subsidiaryId: string;

  /** Optional dimensions */
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  customerId?: string;
  vendorId?: string;
  itemId?: string;

  /** Reference to source business line */
  sourceLineId?: string;

  /** Rule that generated this line */
  sourceRuleId: string;
}

/**
 * Information about a rule that was applied
 */
export interface AppliedRuleInfo {
  /** Rule ID */
  ruleId: string;

  /** Rule name */
  ruleName: string;

  /** Number of lines generated */
  linesGenerated: number;

  /** Total amount processed */
  totalAmount: number;

  /** Whether any conditions were evaluated */
  conditionsEvaluated: boolean;
}

/**
 * Result of balance validation
 */
export interface BalanceValidationResult {
  /** Whether the transaction is balanced */
  isBalanced: boolean;

  /** Total debits in transaction currency */
  totalDebits: number;

  /** Total credits in transaction currency */
  totalCredits: number;

  /** Difference in transaction currency */
  difference: number;

  /** Total debits in base currency */
  baseTotalDebits: number;

  /** Total credits in base currency */
  baseTotalCredits: number;

  /** Difference in base currency */
  baseDifference: number;

  /** Validation errors */
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: ValidationErrorCode;

  /** Human-readable message */
  message: string;

  /** Affected line numbers */
  affectedLines?: number[];

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Validation error codes
 */
export const ValidationErrorCode = {
  UNBALANCED_TRANSACTION: 'UNBALANCED_TRANSACTION',
  UNBALANCED_BASE_AMOUNTS: 'UNBALANCED_BASE_AMOUNTS',
  MISSING_DEBIT_LINE: 'MISSING_DEBIT_LINE',
  MISSING_CREDIT_LINE: 'MISSING_CREDIT_LINE',
  INSUFFICIENT_LINES: 'INSUFFICIENT_LINES',
  NEGATIVE_AMOUNT: 'NEGATIVE_AMOUNT',
  ZERO_AMOUNT_LINE: 'ZERO_AMOUNT_LINE',
  LINE_NOT_BALANCED: 'LINE_NOT_BALANCED',
  INVALID_EXCHANGE_RATE: 'INVALID_EXCHANGE_RATE',
  FX_RATE_MISMATCH: 'FX_RATE_MISMATCH',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  PERIOD_LOCKED: 'PERIOD_LOCKED',
  INVALID_ACCOUNT: 'INVALID_ACCOUNT',
  MISSING_REQUIRED_DIMENSION: 'MISSING_REQUIRED_DIMENSION',
  TOO_MANY_LINES: 'TOO_MANY_LINES',
} as const;

export type ValidationErrorCode = (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode];
