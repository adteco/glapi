/**
 * Shared Transaction Types for Hybrid Transaction Model
 *
 * Types for the unified transaction_headers and transaction_lines tables
 * with type-specific extension support.
 */

import { z } from 'zod';

// ============================================================================
// TRANSACTION TYPE CODES
// ============================================================================

export const TransactionTypeCode = {
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PO_RECEIPT: 'PO_RECEIPT',
  VENDOR_BILL: 'VENDOR_BILL',
  BILL_PAYMENT: 'BILL_PAYMENT',
  SALES_ORDER: 'SALES_ORDER',
  INVOICE: 'INVOICE',
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
} as const;

export type TransactionTypeCodeValue = typeof TransactionTypeCode[keyof typeof TransactionTypeCode];

// ============================================================================
// TRANSACTION CATEGORY
// ============================================================================

export const TransactionCategory = {
  P2P: 'P2P',
  O2C: 'O2C',
  GL: 'GL',
} as const;

export type TransactionCategoryValue = typeof TransactionCategory[keyof typeof TransactionCategory];

// ============================================================================
// ENTITY ROLE
// ============================================================================

export const EntityRole = {
  VENDOR: 'VENDOR',
  CUSTOMER: 'CUSTOMER',
  INTERNAL: 'INTERNAL',
} as const;

export type EntityRoleValue = typeof EntityRole[keyof typeof EntityRole];

// ============================================================================
// BASE TRANSACTION HEADER
// ============================================================================

export interface BaseTransactionHeader {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  transactionType: TransactionTypeCodeValue;
  transactionNumber: string;
  entityId: string;
  entityName?: string;
  transactionDate: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
}

// ============================================================================
// BASE TRANSACTION LINE
// ============================================================================

export interface BaseTransactionLine {
  id: string;
  transactionId: string;
  lineNumber: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const createTransactionLineInputSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  itemId: z.string().uuid().optional(),
  itemName: z.string().min(1),
  itemDescription: z.string().optional(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().optional(),
  unitPrice: z.number(),
  taxAmount: z.number().optional().default(0),
  accountId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  memo: z.string().optional(),
});

export type CreateTransactionLineInput = z.infer<typeof createTransactionLineInputSchema>;

export const createTransactionHeaderInputSchema = z.object({
  subsidiaryId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityName: z.string().optional(),
  transactionDate: z.string().or(z.date()),
  currencyCode: z.string().default('USD'),
  exchangeRate: z.number().positive().default(1),
  memo: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type CreateTransactionHeaderInput = z.infer<typeof createTransactionHeaderInputSchema>;

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface TransactionFilters {
  status?: string | string[];
  entityId?: string;
  subsidiaryId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  search?: string;
  transactionType?: TransactionTypeCodeValue;
}

// ============================================================================
// TRANSACTION WITH LINES
// ============================================================================

export interface TransactionWithLines<
  THeader extends BaseTransactionHeader = BaseTransactionHeader,
  TLine extends BaseTransactionLine = BaseTransactionLine
> {
  header: THeader;
  lines: TLine[];
}

// ============================================================================
// NUMBER PREFIX MAPPING
// ============================================================================

export const TransactionNumberPrefix: Record<TransactionTypeCodeValue, string> = {
  PURCHASE_ORDER: 'PO',
  PO_RECEIPT: 'RCV',
  VENDOR_BILL: 'BILL',
  BILL_PAYMENT: 'BPAY',
  SALES_ORDER: 'SO',
  INVOICE: 'INV',
  CUSTOMER_PAYMENT: 'CPAY',
};

// ============================================================================
// STATUS TRANSITIONS (per transaction type)
// ============================================================================

export interface StatusTransition {
  from: string;
  to: string;
  action: string;
}

// P2P Approval Action Types
export const TransactionApprovalAction = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  RECALLED: 'RECALLED',
  VOIDED: 'VOIDED',
} as const;

export type TransactionApprovalActionValue = typeof TransactionApprovalAction[keyof typeof TransactionApprovalAction];

// ============================================================================
// LINE CALCULATION RESULT
// ============================================================================

export interface LineCalculationResult {
  lines: Array<CreateTransactionLineInput & { amount: number }>;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
}

// ============================================================================
// TRANSACTION APPROVAL HISTORY ENTRY
// ============================================================================

export interface TransactionApprovalHistoryEntry {
  id: string;
  transactionId: string;
  action: TransactionApprovalActionValue;
  fromStatus?: string;
  toStatus: string;
  performedBy: string;
  performedAt: string;
  comments?: string;
  approvalLevel?: number;
  nextApproverId?: string;
}
