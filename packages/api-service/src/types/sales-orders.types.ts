import type {
  SalesOrderStatusValue,
  ApprovalActionTypeValue,
} from '@glapi/database/schema';

// ============================================================================
// Re-export schema types
// ============================================================================

export type { SalesOrderStatusValue, ApprovalActionTypeValue };

// ============================================================================
// Input Types
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
  action: ApprovalActionTypeValue;
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
  status?: SalesOrderStatusValue | SalesOrderStatusValue[];
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

// ============================================================================
// Output Types
// ============================================================================

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
  status: SalesOrderStatusValue;
  previousStatus?: SalesOrderStatusValue;
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
  action: ApprovalActionTypeValue;
  fromStatus: SalesOrderStatusValue;
  toStatus: SalesOrderStatusValue;
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
  currentStatus: SalesOrderStatusValue;
  targetStatus: SalesOrderStatusValue;
  allowedTransitions: SalesOrderStatusValue[];
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
    status: SalesOrderStatusValue;
    invoicedAmount: string;
    remainingAmount: string;
  };
  linesInvoiced: number;
}

// ============================================================================
// State Machine Types
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
  currentStatus: SalesOrderStatusValue;
  totalAmount: number;
  fulfilledAmount: number;
  invoicedAmount: number;
  requiresApproval: boolean;
  approvalThreshold?: number;
}
