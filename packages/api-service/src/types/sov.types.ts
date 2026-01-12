/**
 * Schedule of Values (SOV) Service Types
 *
 * These types define the service layer interfaces for Schedule of Values
 * operations, including creation, updates, and billing progress tracking.
 */

// Re-export database types for convenience
export type {
  ProjectScheduleOfValues,
  NewProjectScheduleOfValues,
  ScheduleOfValueLine,
  NewScheduleOfValueLine,
  SovChangeOrder,
  NewSovChangeOrder,
  SovChangeOrderLine,
  NewSovChangeOrderLine,
  SovStatus,
  SovLineType,
} from '@glapi/database';

export { SOV_STATUS, SOV_LINE_TYPE } from '@glapi/database';

/**
 * Input for creating a new Schedule of Values
 */
export interface CreateSovInput {
  organizationId: string;
  projectId: string;
  description?: string;
  originalContractAmount: number;
  defaultRetainagePercent?: number;
  retainageCapAmount?: number;
  retainageCapPercent?: number;
  effectiveDate?: string;
  currencyCode?: string;
  lines?: CreateSovLineInput[];
}

/**
 * Input for creating an SOV line
 */
export interface CreateSovLineInput {
  projectCostCodeId?: string;
  lineNumber: number;
  itemNumber?: string;
  lineType?: string;
  description: string;
  originalScheduledValue: number;
  retainagePercent?: number;
  revenueAccountId?: string;
  contractAssetAccountId?: string;
  retainageAccountId?: string;
  sortOrder?: number;
  parentLineId?: string;
  isSubtotal?: boolean;
  notes?: string;
}

/**
 * Input for updating an SOV
 */
export interface UpdateSovInput {
  description?: string;
  defaultRetainagePercent?: number;
  retainageCapAmount?: number;
  retainageCapPercent?: number;
  effectiveDate?: string;
  expirationDate?: string;
}

/**
 * Input for updating an SOV line
 */
export interface UpdateSovLineInput {
  lineType?: string;
  description?: string;
  originalScheduledValue?: number;
  retainagePercent?: number;
  revenueAccountId?: string;
  contractAssetAccountId?: string;
  retainageAccountId?: string;
  sortOrder?: number;
  isActive?: boolean;
  notes?: string;
}

/**
 * Input for creating a change order
 */
export interface CreateChangeOrderInput {
  scheduleOfValuesId: string;
  changeOrderNumber: string;
  description: string;
  amount: number;
  effectiveDate?: string;
  externalReference?: string;
  documentUrl?: string;
  notes?: string;
  lines: CreateChangeOrderLineInput[];
}

/**
 * Input for a change order line
 */
export interface CreateChangeOrderLineInput {
  sovLineId: string;
  lineNumber: number;
  description?: string;
  amount: number;
}

/**
 * Input for approving a change order
 */
export interface ApproveChangeOrderInput {
  changeOrderId: string;
  approvedBy: string;
  notes?: string;
}

/**
 * Input for rejecting a change order
 */
export interface RejectChangeOrderInput {
  changeOrderId: string;
  rejectedBy: string;
  reason: string;
}

/**
 * SOV line with calculated fields for display
 */
export interface SovLineWithProgress {
  id: string;
  lineNumber: number;
  itemNumber?: string;
  lineType: string;
  description: string;

  // Contract amounts
  originalScheduledValue: number;
  changeOrderAmount: number;
  revisedScheduledValue: number;

  // Billing progress
  previousWorkCompleted: number;
  previousMaterialsStored: number;
  currentWorkCompleted: number;
  currentMaterialsStored: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;

  // Retainage
  retainagePercent: number;
  retainageHeld: number;
  retainageReleased: number;
  netRetainage: number;

  // Associated cost code
  costCodeId?: string;
  costCodeName?: string;
}

/**
 * SOV summary for project dashboard
 */
export interface SovSummary {
  id: string;
  sovNumber: string;
  projectId: string;
  projectName: string;
  status: string;

  // Contract totals
  originalContractAmount: number;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContractAmount: number;

  // Billing totals
  totalScheduledValue: number;
  totalPreviouslyBilled: number;
  totalCurrentBilling: number;
  totalBilledToDate: number;
  totalRetainageHeld: number;
  totalRetainageReleased: number;
  balanceToFinish: number;
  percentComplete: number;

  // Line counts
  lineCount: number;
  activeLineCount: number;

  // Change order counts
  approvedChangeOrderCount: number;
  pendingChangeOrderCount: number;
}

/**
 * AIA G703 continuation sheet format
 */
export interface G703ContinuationSheet {
  projectName: string;
  applicationNumber: number;
  periodTo: string;
  architectsProjectNumber?: string;

  lines: G703Line[];

  grandTotals: {
    scheduledValue: number;
    previousWorkCompleted: number;
    previousMaterialsStored: number;
    thisWorkCompleted: number;
    thisMaterialsStored: number;
    totalCompletedAndStored: number;
    percentComplete: number;
    balanceToFinish: number;
    retainage: number;
  };
}

/**
 * Individual line on G703
 */
export interface G703Line {
  itemNumber: string;
  descriptionOfWork: string;
  scheduledValue: number;
  workCompletedFromPrevious: number;
  workCompletedThisPeriod: number;
  materialsStoredFromPrevious: number;
  materialsStoredThisPeriod: number;
  totalCompletedAndStored: number;
  percentComplete: number;
  balanceToFinish: number;
  retainage: number;
}

/**
 * Filter options for listing SOVs
 */
export interface ListSovFilter {
  organizationId: string;
  projectId?: string;
  status?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Filter options for listing SOV lines
 */
export interface ListSovLinesFilter {
  scheduleOfValuesId: string;
  lineType?: string[];
  isActive?: boolean;
  costCodeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Result of SOV validation
 */
export interface SovValidationResult {
  valid: boolean;
  errors: SovValidationError[];
  warnings: SovValidationWarning[];
}

export interface SovValidationError {
  code: string;
  message: string;
  lineId?: string;
  field?: string;
}

export interface SovValidationWarning {
  code: string;
  message: string;
  lineId?: string;
  field?: string;
}

/**
 * SOV import from CSV
 */
export interface SovImportInput {
  organizationId: string;
  projectId: string;
  csvData: string;
  hasHeaders?: boolean;
  columnMapping?: Record<string, string>;
}

export interface SovImportResult {
  success: boolean;
  scheduleOfValuesId?: string;
  linesImported: number;
  linesSkipped: number;
  errors: SovImportError[];
  warnings: string[];
}

export interface SovImportError {
  row: number;
  column?: string;
  message: string;
}

/**
 * SOV export options
 */
export interface SovExportOptions {
  format: 'csv' | 'xlsx' | 'g703';
  includeChangeOrders?: boolean;
  includeProgress?: boolean;
}

/**
 * Change order summary
 */
export interface ChangeOrderSummary {
  id: string;
  changeOrderNumber: string;
  description: string;
  amount: number;
  status: string;
  effectiveDate?: string;
  approvedDate?: string;
  lineCount: number;
}

/**
 * Valid SOV status transitions
 */
export const VALID_SOV_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'VOIDED'],
  ACTIVE: ['REVISED', 'CLOSED'],
  REVISED: ['ACTIVE', 'CLOSED'],
  CLOSED: ['ACTIVE'],
  VOIDED: [],
};
