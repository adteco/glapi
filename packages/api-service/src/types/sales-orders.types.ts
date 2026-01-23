/**
 * Sales Order types - partially re-exported from @glapi/types for backward compatibility
 *
 * This file re-exports sales order types from the centralized @glapi/types package.
 * Types that depend on database-specific enums (SalesOrderStatusValue, ApprovalActionTypeValue)
 * are defined locally to maintain type safety with the database layer.
 *
 * New code should import directly from '@glapi/types' when possible, except for
 * filter and result types that need strict database enum types.
 */

import type {
  SalesOrderStatusValue,
  ApprovalActionTypeValue,
} from '@glapi/database/schema';

// Re-export schema types
export type { SalesOrderStatusValue, ApprovalActionTypeValue };

// Re-export generic types from centralized package
export {
  // Sales Order Input Types
  type CreateSalesOrderInput,
  type CreateSalesOrderLineInput,
  type UpdateSalesOrderInput,
  type UpdateSalesOrderLineInput,
  type CreateInvoiceFromOrderInput,

  // State Machine Types
  type SalesOrderEvent,
  type SalesOrderStateMachineContext,
} from '@glapi/types';

// ============================================================================
// Types that depend on database-specific enums (defined locally)
// ============================================================================

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
