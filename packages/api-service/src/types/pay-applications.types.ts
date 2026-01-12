/**
 * Pay Application Service Types
 *
 * These types define the service layer interfaces for Pay Application
 * operations, including creation, workflow, and approval tracking.
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

/**
 * Pay Application workflow actions
 */
export const PAY_APP_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CERTIFY: 'CERTIFY',
  BILL: 'BILL',
  RECORD_PAYMENT: 'RECORD_PAYMENT',
  VOID: 'VOID',
} as const;

export type PayAppAction = (typeof PAY_APP_ACTION)[keyof typeof PAY_APP_ACTION];

/**
 * Input for creating a new pay application
 */
export interface CreatePayApplicationInput {
  organizationId: string;
  projectId: string;
  scheduleOfValuesId: string;
  applicationDate: string;
  periodFrom: string;
  periodTo: string;
  payAppType?: string;
  contractorId?: string;
  ownerId?: string;
  architectId?: string;
  retainagePercent?: number;
  retainageReleaseAmount?: number;
  retainageReleasePercent?: number;
  externalReference?: string;
  notes?: string;
}

/**
 * Input for a pay application line
 */
export interface CreatePayAppLineInput {
  sovLineId: string;
  lineNumber: number;
  thisWorkCompleted: number;
  thisMaterialsStored: number;
  retainagePercent?: number;
  notes?: string;
}

/**
 * Input for updating pay application lines
 */
export interface UpdatePayAppLinesInput {
  payApplicationId: string;
  lines: UpdatePayAppLineInput[];
}

export interface UpdatePayAppLineInput {
  id: string;
  thisWorkCompleted?: number;
  thisMaterialsStored?: number;
  retainagePercent?: number;
  notes?: string;
}

/**
 * Input for submitting a pay application for review
 */
export interface SubmitPayAppInput {
  payApplicationId: string;
  submittedBy: string;
  notes?: string;
}

/**
 * Input for approving a pay application
 */
export interface ApprovePayAppInput {
  payApplicationId: string;
  approvedBy: string;
  approvedAmount?: number; // If different from requested
  notes?: string;
}

/**
 * Input for rejecting a pay application
 */
export interface RejectPayAppInput {
  payApplicationId: string;
  rejectedBy: string;
  reason: string;
}

/**
 * Input for architect certification
 */
export interface CertifyPayAppInput {
  payApplicationId: string;
  certifiedBy: string;
  certificationNumber?: string;
  notes?: string;
}

/**
 * Input for marking pay application as billed
 */
export interface BillPayAppInput {
  payApplicationId: string;
  invoiceNumber: string;
  invoiceDate: string;
  billedBy: string;
}

/**
 * Input for recording payment received
 */
export interface RecordPaymentInput {
  payApplicationId: string;
  paidAmount: number;
  paidDate: string;
  checkNumber?: string;
  paymentReference?: string;
  notes?: string;
}

/**
 * Input for voiding a pay application
 */
export interface VoidPayAppInput {
  payApplicationId: string;
  voidedBy: string;
  reason: string;
}

/**
 * Pay application line with calculated fields
 */
export interface PayAppLineWithProgress {
  id: string;
  lineNumber: number;
  itemNumber?: string;
  description: string;

  // SOV values
  scheduledValue: number;

  // Previous billing
  previousWorkCompleted: number;
  previousMaterialsStored: number;

  // This period billing
  thisWorkCompleted: number;
  thisMaterialsStored: number;

  // Totals
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;

  // Retainage
  retainagePercent: number;
  retainageAmount: number;

  // Adjustments (if approved differs from requested)
  adjustedThisWorkCompleted?: number;
  adjustedThisMaterialsStored?: number;
  adjustmentReason?: string;

  // Reference
  sovLineId: string;
}

/**
 * Pay application summary for list view
 */
export interface PayAppSummary {
  id: string;
  applicationNumber: number;
  applicationDate: string;
  periodFrom: string;
  periodTo: string;
  payAppType: string;
  status: string;

  // Project info
  projectId: string;
  projectName: string;
  projectCode: string;

  // Amounts
  contractSumToDate: number;
  totalCompletedAndStoredToDate: number;
  totalRetainage: number;
  totalEarnedLessRetainage: number;
  lessPreviousCertificates: number;
  currentPaymentDue: number;
  balanceToFinish: number;

  // Workflow dates
  submittedDate?: string;
  approvedDate?: string;
  certifiedDate?: string;
  billedDate?: string;
  paidDate?: string;

  // Invoice
  invoiceNumber?: string;
}

/**
 * AIA G702 Application and Certificate for Payment format
 */
export interface G702Application {
  // Header
  projectName: string;
  projectNumber: string;
  contractDate: string;
  applicationNumber: number;
  periodTo: string;
  distributionTo: string[];

  // Contractor info
  contractor: {
    name: string;
    address: string;
  };

  // Owner info
  owner: {
    name: string;
    address: string;
  };

  // Architect info
  architect: {
    name: string;
    address: string;
    projectNumber?: string;
  };

  // Contract summary
  contractSummary: {
    originalContractSum: number; // Line 1
    netChangeByChangeOrders: number; // Line 2
    contractSumToDate: number; // Line 3
    totalCompletedAndStoredToDate: number; // Line 4
    retainage: {
      fromCompletedWork: number; // Line 5a
      fromStoredMaterial: number; // Line 5b
      total: number; // Line 5c
    };
    totalEarnedLessRetainage: number; // Line 6
    lessPreviousCertificates: number; // Line 7
    currentPaymentDue: number; // Line 8
    balanceToFinish: number; // Line 9
  };

  // Change order summary
  changeOrderSummary: {
    additions: number;
    deductions: number;
    netChanges: number;
  };

  // Certification
  certification?: {
    certifiedBy: string;
    certifiedDate: string;
    certificationNumber?: string;
  };
}

/**
 * Filter options for listing pay applications
 */
export interface ListPayAppFilter {
  organizationId: string;
  projectId?: string;
  scheduleOfValuesId?: string;
  status?: string[];
  payAppType?: string[];
  periodFrom?: string;
  periodTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Input for creating a retainage release
 */
export interface CreateRetainageReleaseInput {
  organizationId: string;
  projectId: string;
  payApplicationId?: string;
  releaseDate: string;
  releaseType?: string;
  releaseAmount: number;
  releasePercent?: number;
  requiresPunchlistComplete?: boolean;
  requiresLienWaivers?: boolean;
  requiresWarrantyDocuments?: boolean;
  externalReference?: string;
  notes?: string;
  lines?: CreateRetainageReleaseLineInput[];
}

export interface CreateRetainageReleaseLineInput {
  sovLineId: string;
  lineNumber: number;
  releaseAmount: number;
  notes?: string;
}

/**
 * Input for approving a retainage release
 */
export interface ApproveRetainageReleaseInput {
  retainageReleaseId: string;
  approvedBy: string;
  approvedAmount?: number;
  notes?: string;
}

/**
 * Retainage release summary
 */
export interface RetainageReleaseSummary {
  id: string;
  releaseNumber: number;
  releaseDate: string;
  releaseType: string;
  status: string;

  projectId: string;
  projectName: string;
  payApplicationId?: string;
  applicationNumber?: number;

  totalRetainageHeld: number;
  releaseAmount: number;
  retainageRemaining: number;
  releasePercent?: number;

  // Conditions
  requiresPunchlistComplete: boolean;
  punchlistCompleteDate?: string;
  requiresLienWaivers: boolean;
  lienWaiversReceivedDate?: string;
  requiresWarrantyDocuments: boolean;
  warrantyDocumentsReceivedDate?: string;

  // Workflow
  requestedDate?: string;
  approvedDate?: string;
  paidDate?: string;
}

/**
 * Pay application validation result
 */
export interface PayAppValidationResult {
  valid: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canCertify: boolean;
  canBill: boolean;
  errors: PayAppValidationError[];
  warnings: PayAppValidationWarning[];
}

export interface PayAppValidationError {
  code: string;
  message: string;
  lineId?: string;
  field?: string;
}

export interface PayAppValidationWarning {
  code: string;
  message: string;
  lineId?: string;
  field?: string;
}

/**
 * Pay application math validation
 */
export interface PayAppMathValidation {
  isBalanced: boolean;
  totalScheduledValue: number;
  totalPreviousBilling: number;
  totalCurrentBilling: number;
  totalBilledToDate: number;
  calculatedRetainage: number;
  reportedRetainage: number;
  retainageDifference: number;
  calculatedCurrentDue: number;
  reportedCurrentDue: number;
  currentDueDifference: number;
  errors: string[];
}

/**
 * Export options for pay applications
 */
export interface PayAppExportOptions {
  format: 'pdf' | 'csv' | 'xlsx' | 'g702' | 'g703';
  includeLines?: boolean;
  includeCertification?: boolean;
  includeNotarization?: boolean;
}

/**
 * Billing progress update input
 * Used for bulk updates to SOV billing progress from pay app
 */
export interface BillingProgressUpdate {
  sovLineId: string;
  workCompleted: number;
  materialsStored: number;
  retainagePercent?: number;
}

/**
 * Result of applying a pay application to SOV
 */
export interface ApplyPayAppToSovResult {
  success: boolean;
  linesUpdated: number;
  totalWorkCompleted: number;
  totalMaterialsStored: number;
  totalRetainage: number;
  errors: string[];
}
