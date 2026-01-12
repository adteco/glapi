/**
 * Procure-to-Pay Types
 *
 * Type definitions for the P2P lifecycle:
 * - Purchase Orders
 * - Receipts
 * - Vendor Bills (with 3-way match)
 * - Bill Payments
 */

import type {
  PurchaseOrderStatusValue,
  ReceiptStatusValue,
  POApprovalActionTypeValue,
  VendorBillStatusValue,
  BillPaymentStatusValue,
  VendorPaymentMethodValue,
  ThreeWayMatchStatusValue,
  BillApprovalActionTypeValue,
} from '@glapi/database/schema';

// ============================================================================
// Re-export schema types
// ============================================================================

export type {
  PurchaseOrderStatusValue,
  ReceiptStatusValue,
  POApprovalActionTypeValue,
  VendorBillStatusValue,
  BillPaymentStatusValue,
  VendorPaymentMethodValue,
  ThreeWayMatchStatusValue,
  BillApprovalActionTypeValue,
};

// ============================================================================
// PURCHASE ORDER Input Types
// ============================================================================

/**
 * Input for creating a purchase order
 */
export interface CreatePurchaseOrderInput {
  subsidiaryId: string;
  vendorId: string;
  orderDate: string | Date;
  expectedDeliveryDate?: string | Date;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: number | string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  lines: CreatePurchaseOrderLineInput[];
}

/**
 * Input for creating a purchase order line
 */
export interface CreatePurchaseOrderLineInput {
  lineNumber?: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number | string;
  unitOfMeasure?: string;
  unitPrice: number | string;
  taxAmount?: number | string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  expectedDeliveryDate?: string | Date;
  memo?: string;
}

/**
 * Input for updating a purchase order
 */
export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: string | Date;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for submitting a PO for approval
 */
export interface SubmitPurchaseOrderInput {
  purchaseOrderId: string;
  comments?: string;
}

/**
 * Input for approving/rejecting a PO
 */
export interface ApprovePurchaseOrderInput {
  purchaseOrderId: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN';
  comments?: string;
}

/**
 * Filter options for listing purchase orders
 */
export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatusValue | PurchaseOrderStatusValue[];
  vendorId?: string;
  subsidiaryId?: string;
  orderDateFrom?: string | Date;
  orderDateTo?: string | Date;
  expectedDeliveryFrom?: string | Date;
  expectedDeliveryTo?: string | Date;
  minAmount?: number | string;
  maxAmount?: number | string;
  hasUnreceivedItems?: boolean;
  search?: string;
}

// ============================================================================
// RECEIPT Input Types
// ============================================================================

/**
 * Input for creating a receipt
 */
export interface CreateReceiptInput {
  subsidiaryId: string;
  purchaseOrderId: string;
  receiptDate: string | Date;
  locationId?: string;
  memo?: string;
  shippingRef?: string;
  carrierName?: string;
  lines: CreateReceiptLineInput[];
}

/**
 * Input for creating a receipt line
 */
export interface CreateReceiptLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number | string;
  quantityAccepted?: number | string;
  quantityRejected?: number | string;
  rejectionReason?: string;
  binLocation?: string;
  lotNumber?: string;
  serialNumbers?: string[];
  memo?: string;
}

/**
 * Input for posting a receipt
 */
export interface PostReceiptInput {
  receiptId: string;
}

/**
 * Filter options for listing receipts
 */
export interface ReceiptFilters {
  status?: ReceiptStatusValue | ReceiptStatusValue[];
  purchaseOrderId?: string;
  vendorId?: string;
  subsidiaryId?: string;
  receiptDateFrom?: string | Date;
  receiptDateTo?: string | Date;
  search?: string;
}

// ============================================================================
// VENDOR BILL Input Types
// ============================================================================

/**
 * Input for creating a vendor bill
 */
export interface CreateVendorBillInput {
  subsidiaryId: string;
  vendorId: string;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  billDate: string | Date;
  dueDate: string | Date;
  receivedDate?: string | Date;
  paymentTerms?: string;
  discountDate?: string | Date;
  discountPercent?: number | string;
  discountAmount?: number | string;
  apAccountId?: string;
  currencyCode?: string;
  exchangeRate?: number | string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  lines: CreateVendorBillLineInput[];
}

/**
 * Input for creating a vendor bill line
 */
export interface CreateVendorBillLineInput {
  lineNumber?: number;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: number | string;
  unitOfMeasure?: string;
  unitPrice: number | string;
  taxAmount?: number | string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
}

/**
 * Input for creating a bill from a PO (auto-populate)
 */
export interface CreateBillFromPOInput {
  purchaseOrderId: string;
  vendorInvoiceNumber?: string;
  billDate: string | Date;
  dueDate: string | Date;
  discountDate?: string | Date;
  discountPercent?: number | string;
  memo?: string;
  // If not provided, creates bill for all unreceived items
  receiptIds?: string[];
}

/**
 * Input for submitting a bill for approval
 */
export interface SubmitVendorBillInput {
  vendorBillId: string;
  comments?: string;
}

/**
 * Input for approving/rejecting a bill
 */
export interface ApproveVendorBillInput {
  vendorBillId: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN';
  comments?: string;
}

/**
 * Input for overriding 3-way match exception
 */
export interface OverrideMatchExceptionInput {
  vendorBillId: string;
  reason: string;
}

/**
 * Filter options for listing vendor bills
 */
export interface VendorBillFilters {
  status?: VendorBillStatusValue | VendorBillStatusValue[];
  vendorId?: string;
  subsidiaryId?: string;
  purchaseOrderId?: string;
  billDateFrom?: string | Date;
  billDateTo?: string | Date;
  dueDateFrom?: string | Date;
  dueDateTo?: string | Date;
  minAmount?: number | string;
  maxAmount?: number | string;
  threeWayMatchStatus?: ThreeWayMatchStatusValue;
  hasBalance?: boolean;
  search?: string;
}

// ============================================================================
// BILL PAYMENT Input Types
// ============================================================================

/**
 * Input for creating a bill payment
 */
export interface CreateBillPaymentInput {
  subsidiaryId: string;
  vendorId: string;
  paymentDate: string | Date;
  paymentMethod: VendorPaymentMethodValue;
  paymentAmount: number | string;
  bankAccountId: string;
  checkNumber?: string;
  achTraceNumber?: string;
  wireReference?: string;
  externalRef?: string;
  payeeName?: string;
  payeeAddress?: string;
  currencyCode?: string;
  exchangeRate?: number | string;
  memo?: string;
  metadata?: Record<string, unknown>;
  applications: BillPaymentApplicationInput[];
}

/**
 * Input for applying a payment to a bill
 */
export interface BillPaymentApplicationInput {
  vendorBillId: string;
  appliedAmount: number | string;
  discountAmount?: number | string;
  writeOffAmount?: number | string;
}

/**
 * Input for voiding a bill payment
 */
export interface VoidBillPaymentInput {
  billPaymentId: string;
  reason: string;
}

/**
 * Filter options for listing bill payments
 */
export interface BillPaymentFilters {
  status?: BillPaymentStatusValue | BillPaymentStatusValue[];
  vendorId?: string;
  subsidiaryId?: string;
  paymentMethod?: VendorPaymentMethodValue;
  paymentDateFrom?: string | Date;
  paymentDateTo?: string | Date;
  minAmount?: number | string;
  maxAmount?: number | string;
  bankAccountId?: string;
  search?: string;
}

// ============================================================================
// VENDOR CREDIT MEMO Input Types
// ============================================================================

/**
 * Input for creating a vendor credit memo
 */
export interface CreateVendorCreditMemoInput {
  subsidiaryId: string;
  vendorId: string;
  vendorCreditNumber?: string;
  creditDate: string | Date;
  sourceType: 'RETURN' | 'PRICE_ADJUSTMENT' | 'REBATE' | 'OTHER';
  originalBillId?: string;
  originalAmount: number | string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for applying a vendor credit memo to a bill
 */
export interface ApplyVendorCreditInput {
  creditMemoId: string;
  vendorBillId: string;
  amount: number | string;
  memo?: string;
}

// ============================================================================
// PURCHASE ORDER Output Types
// ============================================================================

/**
 * Purchase order with all details
 */
export interface PurchaseOrderWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  poNumber: string;
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
    email?: string;
  };
  vendorName?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatusValue;
  subtotal: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  receivedAmount: string;
  billedAmount: string;
  shipToLocationId?: string;
  shipToLocation?: {
    id: string;
    name: string;
  };
  shippingAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  currencyCode: string;
  exchangeRate: string;
  currentApproverId?: string;
  approvedAt?: string;
  approvedBy?: string;
  memo?: string;
  internalNotes?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  closedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  lines?: PurchaseOrderLineWithDetails[];
  receipts?: ReceiptSummary[];
  approvalHistory?: PurchaseOrderApprovalEntry[];
}

/**
 * Purchase order line with details
 */
export interface PurchaseOrderLineWithDetails {
  id: string;
  purchaseOrderId: string;
  lineNumber: number;
  itemId?: string;
  item?: {
    id: string;
    name: string;
    sku?: string;
  };
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  quantityReceived: string;
  quantityBilled: string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  expectedDeliveryDate?: string;
  memo?: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Purchase order approval history entry
 */
export interface PurchaseOrderApprovalEntry {
  id: string;
  purchaseOrderId: string;
  action: POApprovalActionTypeValue;
  performedBy: string;
  performedByName?: string;
  fromStatus?: PurchaseOrderStatusValue;
  toStatus: PurchaseOrderStatusValue;
  comments?: string;
  performedAt: string;
}

// ============================================================================
// RECEIPT Output Types
// ============================================================================

/**
 * Receipt with details
 */
export interface ReceiptWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrder?: {
    id: string;
    poNumber: string;
    vendorId: string;
  };
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
  };
  receiptDate: string;
  status: ReceiptStatusValue;
  locationId?: string;
  location?: {
    id: string;
    name: string;
  };
  totalReceivedValue: string;
  memo?: string;
  shippingRef?: string;
  carrierName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  postedBy?: string;
  cancelledAt?: string;
  lines?: ReceiptLineWithDetails[];
}

/**
 * Receipt line with details
 */
export interface ReceiptLineWithDetails {
  id: string;
  receiptId: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  itemId?: string;
  item?: {
    id: string;
    name: string;
    sku?: string;
  };
  itemName: string;
  quantityReceived: string;
  unitOfMeasure?: string;
  unitCost: string;
  receivedValue: string;
  quantityAccepted?: string;
  quantityRejected?: string;
  rejectionReason?: string;
  binLocation?: string;
  lotNumber?: string;
  serialNumbers?: string[];
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Receipt summary for PO display
 */
export interface ReceiptSummary {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  status: ReceiptStatusValue;
  totalReceivedValue: string;
}

// ============================================================================
// VENDOR BILL Output Types
// ============================================================================

/**
 * Vendor bill with details
 */
export interface VendorBillWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  billNumber: string;
  vendorInvoiceNumber?: string;
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
    email?: string;
  };
  vendorName?: string;
  purchaseOrderId?: string;
  purchaseOrder?: {
    id: string;
    poNumber: string;
  };
  billDate: string;
  dueDate: string;
  receivedDate?: string;
  status: VendorBillStatusValue;
  threeWayMatchStatus: ThreeWayMatchStatusValue;
  matchVarianceAmount?: string;
  matchOverrideReason?: string;
  matchOverrideBy?: string;
  matchOverrideAt?: string;
  subtotal: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  discountDate?: string;
  discountPercent?: string;
  discountAmount?: string;
  discountTaken: string;
  apAccountId?: string;
  paymentTerms?: string;
  currencyCode: string;
  exchangeRate: string;
  currentApproverId?: string;
  approvedAt?: string;
  approvedBy?: string;
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
  lines?: VendorBillLineWithDetails[];
  paymentApplications?: BillPaymentApplicationWithDetails[];
  approvalHistory?: VendorBillApprovalEntry[];
}

/**
 * Vendor bill line with details
 */
export interface VendorBillLineWithDetails {
  id: string;
  vendorBillId: string;
  lineNumber: number;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  itemId?: string;
  item?: {
    id: string;
    name: string;
    sku?: string;
  };
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  // 3-way match details
  poQuantity?: string;
  poUnitPrice?: string;
  receivedQuantity?: string;
  quantityVariance?: string;
  priceVariance?: string;
  matchStatus?: ThreeWayMatchStatusValue;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vendor bill approval history entry
 */
export interface VendorBillApprovalEntry {
  id: string;
  vendorBillId: string;
  action: BillApprovalActionTypeValue;
  performedBy: string;
  performedByName?: string;
  fromStatus?: VendorBillStatusValue;
  toStatus: VendorBillStatusValue;
  comments?: string;
  performedAt: string;
}

// ============================================================================
// BILL PAYMENT Output Types
// ============================================================================

/**
 * Bill payment with details
 */
export interface BillPaymentWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  paymentNumber: string;
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
    email?: string;
  };
  vendorName?: string;
  paymentDate: string;
  paymentMethod: VendorPaymentMethodValue;
  status: BillPaymentStatusValue;
  paymentAmount: string;
  appliedAmount: string;
  unappliedAmount: string;
  discountTaken: string;
  bankAccountId?: string;
  bankAccount?: {
    id: string;
    name: string;
  };
  checkNumber?: string;
  achTraceNumber?: string;
  wireReference?: string;
  externalRef?: string;
  payeeName?: string;
  payeeAddress?: string;
  currencyCode: string;
  exchangeRate: string;
  clearedDate?: string;
  clearedAmount?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  applications?: BillPaymentApplicationWithDetails[];
}

/**
 * Bill payment application with details
 */
export interface BillPaymentApplicationWithDetails {
  id: string;
  billPaymentId: string;
  vendorBillId: string;
  vendorBill?: {
    id: string;
    billNumber: string;
    vendorInvoiceNumber?: string;
    totalAmount: string;
  };
  appliedAmount: string;
  discountAmount: string;
  writeOffAmount: string;
  createdBy: string;
  createdAt: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}

// ============================================================================
// VENDOR CREDIT MEMO Output Types
// ============================================================================

/**
 * Vendor credit memo with details
 */
export interface VendorCreditMemoWithDetails {
  id: string;
  organizationId: string;
  subsidiaryId: string;
  creditMemoNumber: string;
  vendorCreditNumber?: string;
  vendorId: string;
  vendor?: {
    id: string;
    name: string;
  };
  vendorName?: string;
  sourceType: string;
  sourceRef?: string;
  originalBillId?: string;
  originalBill?: {
    id: string;
    billNumber: string;
  };
  creditDate: string;
  originalAmount: string;
  appliedAmount: string;
  remainingAmount: string;
  status: string;
  currencyCode: string;
  memo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  voidedAt?: string;
}

// ============================================================================
// 3-WAY MATCH Types
// ============================================================================

/**
 * Result of 3-way match validation
 */
export interface ThreeWayMatchResult {
  vendorBillId: string;
  overallStatus: ThreeWayMatchStatusValue;
  totalVariance: string;
  lineResults: ThreeWayMatchLineResult[];
  canApprove: boolean;
  requiresOverride: boolean;
}

/**
 * 3-way match result for a single line
 */
export interface ThreeWayMatchLineResult {
  vendorBillLineId: string;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  matchStatus: ThreeWayMatchStatusValue;
  // PO vs Bill
  poQuantity?: string;
  billedQuantity: string;
  quantityVariance?: string;
  poUnitPrice?: string;
  billedUnitPrice: string;
  priceVariance?: string;
  // Receipt vs Bill
  receivedQuantity?: string;
  receivedVariance?: string;
  // Totals
  totalVariance: string;
  exceptions: string[];
}

// ============================================================================
// SUMMARY Types
// ============================================================================

/**
 * Vendor account summary (AP)
 */
export interface VendorAccountSummary {
  vendorId: string;
  vendorName: string;
  totalOutstanding: string;
  totalOverdue: string;
  totalUnappliedCredits: string;
  oldestBillDate?: string;
  billCount: number;
  overdueBillCount: number;
}

/**
 * AP aging summary
 */
export interface APAgingSummary {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  total: string;
  byVendor?: {
    vendorId: string;
    vendorName: string;
    current: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    over90: string;
    total: string;
  }[];
}

/**
 * PO status summary
 */
export interface POStatusSummary {
  draft: number;
  submitted: number;
  approved: number;
  partiallyReceived: number;
  received: number;
  billed: number;
  closed: number;
  cancelled: number;
  totalOpenValue: string;
  totalUnreceivedValue: string;
}

/**
 * Bill payment summary for a period
 */
export interface BillPaymentSummary {
  periodStart: string;
  periodEnd: string;
  totalPaid: string;
  totalDiscountTaken: string;
  paymentCount: number;
  byMethod: {
    method: VendorPaymentMethodValue;
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

// ============================================================================
// GL Posting Types
// ============================================================================

/**
 * GL posting result for vendor bill
 */
export interface VendorBillPostingResult {
  vendorBillId: string;
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
 * GL posting result for bill payment
 */
export interface BillPaymentPostingResult {
  billPaymentId: string;
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
 * GL posting configuration for AP
 */
export interface APGLConfig {
  defaultAPAccountId: string;
  defaultCashAccountId: string;
  defaultDiscountAccountId?: string;
  defaultWriteOffAccountId?: string;
  postOnApproval: boolean;
}
