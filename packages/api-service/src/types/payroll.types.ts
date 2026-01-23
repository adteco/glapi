/**
 * Payroll Integration Types
 *
 * Type definitions for payroll system integrations (Gusto, ADP, etc.)
 * Provides normalized types for employees, payroll runs, and tax filings.
 */

// ============================================================================
// Common Payroll Types
// ============================================================================

/**
 * Payroll provider types
 */
export type PayrollProvider = 'gusto' | 'adp' | 'paychex' | 'quickbooks_payroll';

/**
 * Employment status
 */
export type EmploymentStatus = 'active' | 'terminated' | 'on_leave' | 'pending';

/**
 * Employment type for payroll (distinct from entity EmploymentType)
 */
export type PayrollEmploymentType = 'full_time' | 'part_time' | 'contractor' | 'temporary';

/**
 * Pay frequency
 */
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/**
 * Pay type
 */
export type PayType = 'hourly' | 'salary' | 'commission';

/**
 * Filing status for tax purposes
 */
export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household';

// ============================================================================
// Normalized Employee Types
// ============================================================================

/**
 * Normalized employee information
 */
export interface PayrollEmployee {
  /** Internal ID */
  id: string;
  /** Provider-specific employee ID */
  providerEmployeeId: string;
  /** Payroll provider */
  provider: PayrollProvider;
  /** Organization ID */
  organizationId: string;
  /** First name */
  firstName: string;
  /** Middle name */
  middleName?: string;
  /** Last name */
  lastName: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Employment status */
  status: EmploymentStatus;
  /** Employment type */
  employmentType: PayrollEmploymentType;
  /** Department */
  department?: string;
  /** Job title */
  jobTitle?: string;
  /** Manager employee ID */
  managerId?: string;
  /** Work location */
  workLocation?: PayrollLocation;
  /** Home address */
  homeAddress?: PayrollAddress;
  /** Date of birth */
  dateOfBirth?: Date;
  /** Social Security Number (encrypted/masked) */
  ssnLast4?: string;
  /** Hire date */
  hireDate: Date;
  /** Start date (first day worked) */
  startDate?: Date;
  /** Termination date */
  terminationDate?: Date;
  /** Compensation info */
  compensation: EmployeeCompensation;
  /** Tax information */
  taxInfo?: EmployeeTaxInfo;
  /** Bank accounts for direct deposit */
  bankAccounts?: EmployeeBankAccount[];
  /** Benefits enrollment */
  benefits?: EmployeeBenefit[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Employee compensation details
 */
export interface EmployeeCompensation {
  /** Pay type */
  payType: PayType;
  /** Pay rate (annual for salary, hourly for hourly) */
  payRate: number;
  /** Pay frequency */
  payFrequency: PayFrequency;
  /** Currency code */
  currency: string;
  /** Effective date of current compensation */
  effectiveDate: Date;
  /** FLSA status (exempt/non-exempt) */
  flsaStatus?: 'exempt' | 'non_exempt';
  /** Previous compensation history */
  history?: CompensationHistory[];
}

/**
 * Compensation history entry
 */
export interface CompensationHistory {
  payType: PayType;
  payRate: number;
  effectiveDate: Date;
  endDate?: Date;
  reason?: string;
}

/**
 * Employee tax information
 */
export interface EmployeeTaxInfo {
  /** Federal filing status */
  federalFilingStatus: FilingStatus;
  /** Federal withholding allowances */
  federalAllowances: number;
  /** Additional federal withholding */
  additionalFederalWithholding?: number;
  /** State tax info */
  stateInfo?: StateTaxInfo[];
  /** W-4 on file */
  w4OnFile: boolean;
  /** W-4 date */
  w4Date?: Date;
}

/**
 * State tax information
 */
export interface StateTaxInfo {
  state: string;
  filingStatus?: string;
  allowances?: number;
  additionalWithholding?: number;
}

/**
 * Employee bank account for direct deposit
 */
export interface EmployeeBankAccount {
  id: string;
  bankName: string;
  accountType: 'checking' | 'savings';
  routingNumber: string;
  accountNumberLast4: string;
  /** Deposit type */
  depositType: 'full' | 'percentage' | 'fixed';
  /** Amount or percentage */
  depositAmount?: number;
  /** Priority order for split deposits */
  priority: number;
  isActive: boolean;
}

/**
 * Employee benefit enrollment
 */
export interface EmployeeBenefit {
  id: string;
  benefitType: BenefitType;
  planId: string;
  planName: string;
  coverageLevel: 'employee' | 'employee_spouse' | 'employee_children' | 'family';
  employeeContribution: number;
  employerContribution: number;
  contributionFrequency: PayFrequency;
  effectiveDate: Date;
  terminationDate?: Date;
}

/**
 * Benefit types
 */
export type BenefitType =
  | 'health_insurance'
  | 'dental_insurance'
  | 'vision_insurance'
  | 'life_insurance'
  | 'disability_insurance'
  | '401k'
  | 'hsa'
  | 'fsa'
  | 'commuter_benefits'
  | 'other';

/**
 * Address
 */
export interface PayrollAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Work location
 */
export interface PayrollLocation {
  id: string;
  name: string;
  address: PayrollAddress;
  isRemote: boolean;
}

// ============================================================================
// Payroll Run Types
// ============================================================================

/**
 * Payroll run status
 */
export type PayrollRunStatus = 'draft' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Payroll run type
 */
export type PayrollRunType = 'regular' | 'bonus' | 'correction' | 'off_cycle' | 'termination';

/**
 * Payroll run (pay period)
 */
export interface PayrollRun {
  /** Internal ID */
  id: string;
  /** Provider-specific payroll run ID */
  providerPayrollRunId: string;
  /** Payroll provider */
  provider: PayrollProvider;
  /** Organization ID */
  organizationId: string;
  /** Pay period start date */
  periodStart: Date;
  /** Pay period end date */
  periodEnd: Date;
  /** Check date (pay date) */
  checkDate: Date;
  /** Payroll run type */
  runType: PayrollRunType;
  /** Status */
  status: PayrollRunStatus;
  /** Pay frequency */
  payFrequency: PayFrequency;
  /** Employee paystubs */
  paystubs: Paystub[];
  /** Totals */
  totals: PayrollRunTotals;
  /** Company debit date */
  companyDebitDate?: Date;
  /** Processing date */
  processedAt?: Date;
  /** Submitted by */
  submittedBy?: string;
  /** Approved by */
  approvedBy?: string;
  /** Notes */
  notes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Payroll run totals
 */
export interface PayrollRunTotals {
  /** Total gross pay */
  grossPay: number;
  /** Total net pay */
  netPay: number;
  /** Total employer taxes */
  employerTaxes: number;
  /** Total employee taxes */
  employeeTaxes: number;
  /** Total employer contributions (benefits) */
  employerContributions: number;
  /** Total employee deductions */
  employeeDeductions: number;
  /** Total reimbursements */
  reimbursements: number;
  /** Total company cost */
  totalCompanyCost: number;
  /** Number of employees paid */
  employeeCount: number;
  /** Currency */
  currency: string;
}

/**
 * Individual paystub
 */
export interface Paystub {
  /** Internal ID */
  id: string;
  /** Provider-specific paystub ID */
  providerPaystubId: string;
  /** Employee ID */
  employeeId: string;
  /** Employee name */
  employeeName: string;
  /** Gross pay */
  grossPay: number;
  /** Net pay */
  netPay: number;
  /** Earnings breakdown */
  earnings: PaystubEarning[];
  /** Tax deductions */
  taxes: PaystubTax[];
  /** Benefit deductions */
  deductions: PaystubDeduction[];
  /** Employer contributions */
  employerContributions: PaystubContribution[];
  /** Reimbursements */
  reimbursements: PaystubReimbursement[];
  /** Hours worked (for hourly employees) */
  hoursWorked?: number;
  /** Regular hours */
  regularHours?: number;
  /** Overtime hours */
  overtimeHours?: number;
  /** PTO hours used */
  ptoHoursUsed?: number;
  /** Sick hours used */
  sickHoursUsed?: number;
  /** YTD totals */
  ytdTotals: YTDTotals;
  /** Check number */
  checkNumber?: string;
  /** Payment method */
  paymentMethod: 'direct_deposit' | 'check' | 'manual';
}

/**
 * Paystub earning line
 */
export interface PaystubEarning {
  earningType: EarningType;
  name: string;
  hours?: number;
  rate?: number;
  amount: number;
  ytdAmount: number;
}

/**
 * Earning types
 */
export type EarningType =
  | 'regular'
  | 'overtime'
  | 'double_overtime'
  | 'holiday'
  | 'pto'
  | 'sick'
  | 'bonus'
  | 'commission'
  | 'tips'
  | 'severance'
  | 'other';

/**
 * Paystub tax line
 */
export interface PaystubTax {
  taxType: TaxType;
  name: string;
  employeeAmount: number;
  employerAmount: number;
  ytdEmployeeAmount: number;
  ytdEmployerAmount: number;
}

/**
 * Tax types
 */
export type TaxType =
  | 'federal_income'
  | 'social_security'
  | 'medicare'
  | 'state_income'
  | 'local_income'
  | 'state_unemployment'
  | 'federal_unemployment'
  | 'state_disability'
  | 'other';

/**
 * Paystub deduction line
 */
export interface PaystubDeduction {
  deductionType: DeductionType;
  name: string;
  amount: number;
  ytdAmount: number;
  isPreTax: boolean;
}

/**
 * Deduction types
 */
export type DeductionType =
  | 'health_insurance'
  | 'dental_insurance'
  | 'vision_insurance'
  | 'life_insurance'
  | '401k'
  | 'roth_401k'
  | 'hsa'
  | 'fsa'
  | 'commuter'
  | 'garnishment'
  | 'child_support'
  | 'union_dues'
  | 'other';

/**
 * Employer contribution line
 */
export interface PaystubContribution {
  contributionType: string;
  name: string;
  amount: number;
  ytdAmount: number;
}

/**
 * Reimbursement line
 */
export interface PaystubReimbursement {
  category: string;
  description: string;
  amount: number;
  ytdAmount: number;
}

/**
 * Year-to-date totals
 */
export interface YTDTotals {
  grossPay: number;
  netPay: number;
  federalTax: number;
  stateTax: number;
  socialSecurity: number;
  medicare: number;
  totalTaxes: number;
  totalDeductions: number;
  totalReimbursements: number;
}

// ============================================================================
// Tax Filing Types
// ============================================================================

/**
 * Tax filing document type
 */
export type TaxDocumentType =
  | 'w2'
  | 'w3'
  | 'w4'
  | '1099_nec'
  | '1099_misc'
  | '941'
  | '940'
  | 'state_w2'
  | 'state_quarterly';

/**
 * Tax filing document
 */
export interface TaxDocument {
  id: string;
  providerDocumentId: string;
  provider: PayrollProvider;
  organizationId: string;
  documentType: TaxDocumentType;
  taxYear: number;
  employeeId?: string;
  filingStatus: 'draft' | 'pending' | 'filed' | 'accepted' | 'rejected';
  dueDate?: Date;
  filedDate?: Date;
  confirmationNumber?: string;
  documentUrl?: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// GL Posting Types
// ============================================================================

/**
 * Payroll GL posting configuration
 */
export interface PayrollGLConfig {
  organizationId: string;
  /** Default expense accounts by earning type */
  earningAccounts: Record<EarningType, string>;
  /** Default liability accounts by tax type */
  taxLiabilityAccounts: Record<TaxType, string>;
  /** Default expense accounts for employer taxes */
  employerTaxExpenseAccounts: Record<TaxType, string>;
  /** Default accounts for deductions */
  deductionAccounts: Record<DeductionType, string>;
  /** Wages payable account */
  wagesPayableAccount: string;
  /** Cash/bank account for payroll */
  payrollBankAccount: string;
  /** Employer benefits expense account */
  employerBenefitsExpenseAccount: string;
  /** Department-specific overrides */
  departmentOverrides?: Record<string, Partial<PayrollGLConfig>>;
}

/**
 * Payroll journal entry
 */
export interface PayrollJournalEntry {
  payrollRunId: string;
  periodStart: Date;
  periodEnd: Date;
  checkDate: Date;
  entries: PayrollJournalLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  memo: string;
}

/**
 * Payroll journal line
 */
export interface PayrollJournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  departmentId?: string;
  employeeId?: string;
  memo?: string;
  category: 'earnings' | 'employer_taxes' | 'employee_taxes' | 'deductions' | 'employer_contributions' | 'cash';
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Payroll sync options
 */
export interface PayrollSyncOptions {
  /** Sync employees */
  syncEmployees?: boolean;
  /** Sync payroll runs */
  syncPayrollRuns?: boolean;
  /** Sync tax documents */
  syncTaxDocuments?: boolean;
  /** Start date for payroll runs */
  startDate?: Date;
  /** End date for payroll runs */
  endDate?: Date;
  /** Include terminated employees */
  includeTerminated?: boolean;
  /** Force full refresh */
  forceFullRefresh?: boolean;
}

/**
 * Payroll sync result
 */
export interface PayrollSyncResult {
  provider: PayrollProvider;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  employeesSynced: number;
  payrollRunsSynced: number;
  taxDocumentsSynced: number;
  errors: PayrollSyncError[];
}

/**
 * Payroll sync error
 */
export interface PayrollSyncError {
  code: string;
  message: string;
  entityType?: 'employee' | 'payroll_run' | 'tax_document';
  entityId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Payroll webhook event types
 */
export type PayrollWebhookEvent =
  | 'employee.created'
  | 'employee.updated'
  | 'employee.terminated'
  | 'payroll.created'
  | 'payroll.processed'
  | 'payroll.cancelled'
  | 'tax_document.created'
  | 'tax_document.filed';

/**
 * Payroll webhook payload
 */
export interface PayrollWebhookPayload {
  provider: PayrollProvider;
  eventType: PayrollWebhookEvent;
  timestamp: Date;
  organizationId: string;
  data: {
    entityType: 'employee' | 'payroll_run' | 'tax_document';
    entityId: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
  };
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Payroll connection
 */
export interface PayrollConnection {
  id: string;
  organizationId: string;
  provider: PayrollProvider;
  /** Provider-specific company ID */
  providerCompanyId: string;
  companyName: string;
  status: 'active' | 'needs_attention' | 'error' | 'disconnected';
  error?: {
    code: string;
    message: string;
    requiresUserAction: boolean;
  };
  lastSuccessfulSync?: Date;
  lastSyncAttempt?: Date;
  /** Encrypted credentials reference */
  credentialsRef: string;
  /** Webhook URL */
  webhookUrl?: string;
  /** Configuration */
  config: {
    syncEmployees: boolean;
    syncPayrollRuns: boolean;
    syncTaxDocuments: boolean;
    autoPostToGL: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
