import type {
  CustomerPaymentStatusValue,
  BankDepositStatusValue,
  ReconciliationStatusValue,
  ApplicationMethodValue,
} from '@glapi/database/schema';

// ============================================================================
// Re-export schema types
// ============================================================================

export type {
  CustomerPaymentStatusValue,
  BankDepositStatusValue,
  ReconciliationStatusValue,
  ApplicationMethodValue,
};

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for receiving a customer payment
 */
export interface ReceiveCustomerPaymentInput {
  subsidiaryId: string;
  entityId: string;
  paymentDate: string | Date;
  paymentMethod: 'CHECK' | 'ACH' | 'WIRE' | 'CREDIT_CARD' | 'CASH' | 'LOCKBOX' | 'ONLINE' | 'OTHER';
  paymentAmount: number | string;
  externalReference?: string;
  checkNumber?: string;
  bankRoutingNumber?: string;
  bankAccountLast4?: string;
  currencyCode?: string;
  exchangeRate?: number | string;
  cashAccountId?: string;
  arAccountId?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  // Auto-apply options
  autoApply?: boolean;
  applicationMethod?: ApplicationMethodValue;
  // Specific invoice applications (if not auto-applying)
  applications?: PaymentApplicationInput[];
}

/**
 * Input for applying a payment to an invoice
 */
export interface PaymentApplicationInput {
  invoiceId: string;
  appliedAmount: number | string;
  discountAmount?: number | string;
  writeOffAmount?: number | string;
  discountAccountId?: string;
  writeOffAccountId?: string;
  memo?: string;
}

/**
 * Input for creating a bank deposit
 */
export interface CreateBankDepositInput {
  subsidiaryId: string;
  depositDate: string | Date;
  bankAccountId: string;
  bankAccountName?: string;
  currencyCode?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  // Optional: add payments at creation
  paymentIds?: string[];
}

/**
 * Input for adding payments to a deposit
 */
export interface AddPaymentsToDepositInput {
  depositId: string;
  paymentIds: string[];
}

/**
 * Input for submitting a deposit
 */
export interface SubmitDepositInput {
  depositId: string;
  memo?: string;
}

/**
 * Input for reconciling a deposit
 */
export interface ReconcileDepositInput {
  depositId: string;
  bankStatementDate: string | Date;
  bankStatementRef?: string;
  bankStatementAmount?: number | string;
  notes?: string;
}

/**
 * Input for creating a reconciliation exception
 */
export interface CreateReconciliationExceptionInput {
  bankDepositId?: string;
  customerPaymentId?: string;
  exceptionType: string;
  exceptionDescription: string;
  bankStatementDate?: string | Date;
  bankStatementRef?: string;
  bankStatementAmount?: number | string;
  systemAmount?: number | string;
}

/**
 * Input for resolving a reconciliation exception
 */
export interface ResolveExceptionInput {
  exceptionId: string;
  resolutionNotes: string;
}

/**
 * Input for creating a credit memo from overpayment
 */
export interface CreateCreditMemoInput {
  subsidiaryId: string;
  entityId: string;
  creditDate: string | Date;
  sourceType: 'OVERPAYMENT' | 'RETURN' | 'ADJUSTMENT';
  sourcePaymentId?: string;
  sourceInvoiceId?: string;
  originalAmount: number | string;
  creditAccountId?: string;
  reason?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for applying a credit memo to an invoice
 */
export interface ApplyCreditMemoInput {
  creditMemoId: string;
  invoiceId: string;
  amount: number | string;
  memo?: string;
}

/**
 * Filter options for listing customer payments
 */
export interface CustomerPaymentFilters {
  status?: CustomerPaymentStatusValue | CustomerPaymentStatusValue[];
  entityId?: string;
  subsidiaryId?: string;
  paymentMethod?: string;
  paymentDateFrom?: string | Date;
  paymentDateTo?: string | Date;
  minAmount?: number | string;
  maxAmount?: number | string;
  hasUnappliedBalance?: boolean;
  bankDepositId?: string;
  search?: string;
}

/**
 * Filter options for listing bank deposits
 */
export interface BankDepositFilters {
  status?: BankDepositStatusValue | BankDepositStatusValue[];
  subsidiaryId?: string;
  bankAccountId?: string;
  depositDateFrom?: string | Date;
  depositDateTo?: string | Date;
  reconciliationStatus?: ReconciliationStatusValue;
  search?: string;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Customer payment with all details
 */
export interface CustomerPaymentWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  paymentNumber: string;
  externalReference?: string;
  entityId: string;
  entity?: {
    id: string;
    name: string;
    email?: string;
  };
  paymentDate: string;
  paymentMethod: string;
  checkNumber?: string;
  currencyCode: string;
  exchangeRate: string;
  paymentAmount: string;
  appliedAmount: string;
  unappliedAmount: string;
  status: CustomerPaymentStatusValue;
  cashAccountId?: string;
  arAccountId?: string;
  glTransactionId?: string;
  postedAt?: string;
  bankDepositId?: string;
  bankDeposit?: {
    id: string;
    depositNumber: string;
    status: BankDepositStatusValue;
  };
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  applications?: PaymentApplicationWithDetails[];
}

/**
 * Payment application with details
 */
export interface PaymentApplicationWithDetails {
  id: string;
  customerPaymentId: string;
  invoiceId: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    entityId: string;
  };
  applicationDate: string;
  appliedAmount: string;
  discountAmount: string;
  writeOffAmount: string;
  memo?: string;
  createdBy: string;
  createdAt: string;
  reversedAt?: string;
  reversedBy?: string;
}

/**
 * Bank deposit with details
 */
export interface BankDepositWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  depositNumber: string;
  depositDate: string;
  bankAccountId: string;
  bankAccountName?: string;
  currencyCode: string;
  totalAmount: string;
  paymentCount: number;
  status: BankDepositStatusValue;
  glTransactionId?: string;
  postedAt?: string;
  reconciliationStatus?: ReconciliationStatusValue;
  reconciledAt?: string;
  reconciledBy?: string;
  bankStatementDate?: string;
  bankStatementRef?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  submittedAt?: string;
  submittedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  payments?: CustomerPaymentWithDetails[];
}

/**
 * Reconciliation exception with details
 */
export interface ReconciliationExceptionWithDetails {
  id: string;
  organizationId: string;
  bankDepositId?: string;
  customerPaymentId?: string;
  exceptionType: string;
  exceptionDescription: string;
  bankStatementDate?: string;
  bankStatementRef?: string;
  bankStatementAmount?: string;
  systemAmount?: string;
  varianceAmount?: string;
  status: ReconciliationStatusValue;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * Credit memo with details
 */
export interface CreditMemoWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  creditMemoNumber: string;
  entityId: string;
  entity?: {
    id: string;
    name: string;
  };
  sourceType: string;
  sourcePaymentId?: string;
  sourceInvoiceId?: string;
  creditDate: string;
  currencyCode: string;
  originalAmount: string;
  appliedAmount: string;
  remainingAmount: string;
  isFullyApplied: boolean;
  creditAccountId?: string;
  glTransactionId?: string;
  reason?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
}

/**
 * Result of auto-applying a payment
 */
export interface AutoApplyResult {
  payment: CustomerPaymentWithDetails;
  applicationsCreated: number;
  totalApplied: string;
  remainingUnapplied: string;
  invoicesFullyPaid: string[];
  invoicesPartiallyPaid: string[];
}

/**
 * Customer account summary
 */
export interface CustomerAccountSummary {
  entityId: string;
  entityName: string;
  totalOutstanding: string;
  totalOverdue: string;
  totalUnappliedPayments: string;
  totalCredits: string;
  oldestInvoiceDate?: string;
  invoiceCount: number;
  overdueInvoiceCount: number;
}

/**
 * Cash receipts summary for a period
 */
export interface CashReceiptsSummary {
  periodStart: string;
  periodEnd: string;
  totalReceived: string;
  totalApplied: string;
  totalUnapplied: string;
  paymentCount: number;
  byMethod: {
    method: string;
    amount: string;
    count: number;
  }[];
  bySubsidiary: {
    subsidiaryId: string;
    subsidiaryName: string;
    amount: string;
    count: number;
  }[];
}

/**
 * Deposit batch summary
 */
export interface DepositBatchSummary {
  openDeposits: number;
  submittedDeposits: number;
  pendingReconciliation: number;
  totalOpenAmount: string;
  totalSubmittedAmount: string;
  totalPendingAmount: string;
}

// ============================================================================
// GL Posting Types
// ============================================================================

/**
 * GL posting result for cash receipt
 */
export interface CashReceiptPostingResult {
  paymentId: string;
  glTransactionId: string;
  journalEntries: {
    accountId: string;
    accountName: string;
    debit: string;
    credit: string;
  }[];
  postedAt: string;
}

/**
 * GL posting configuration for cash receipts
 */
export interface CashReceiptGLConfig {
  defaultCashAccountId: string;
  defaultARAccountId: string;
  defaultDiscountAccountId?: string;
  defaultWriteOffAccountId?: string;
  postOnReceive: boolean; // Post immediately on receive vs. on deposit
}
