/**
 * Purchase Order Repository
 *
 * Data access layer for purchase orders, handling all database operations
 * for the purchase_orders table.
 */

import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  purchaseOrders,
  purchaseOrderApprovalHistory,
  entities,
  type PurchaseOrderStatusValue,
  type POApprovalActionTypeValue,
} from '../db/schema';

// ============================================================================
// Types
// ============================================================================

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatusValue | PurchaseOrderStatusValue[];
  vendorId?: string;
  subsidiaryId?: string;
  orderDateFrom?: string | Date;
  orderDateTo?: string | Date;
  search?: string;
}

export interface PurchaseOrderPaginationParams {
  skip: number;
  take: number;
}

export interface CreatePurchaseOrderData {
  organizationId: string;
  subsidiaryId: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  status: PurchaseOrderStatusValue;
  subtotal: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  receivedAmount: string;
  billedAmount: string;
  paymentTerms?: string;
  currencyCode: string;
  exchangeRate: string;
  memo?: string;
  internalNotes?: string;
  createdBy: string;
}

export interface UpdatePurchaseOrderData {
  vendorId?: string;
  vendorName?: string;
  orderDate?: string;
  expectedDeliveryDate?: string | null;
  shipToLocationId?: string;
  shippingAddress?: string;
  shippingMethod?: string;
  status?: PurchaseOrderStatusValue;
  subtotal?: string;
  taxAmount?: string;
  shippingAmount?: string;
  totalAmount?: string;
  receivedAmount?: string;
  billedAmount?: string;
  paymentTerms?: string;
  currencyCode?: string;
  exchangeRate?: string;
  memo?: string;
  internalNotes?: string;
  approvedAt?: Date;
  approvedBy?: string;
  closedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  updatedBy?: string;
}

export interface POApprovalHistoryEntry {
  purchaseOrderId: string;
  action: POApprovalActionTypeValue;
  fromStatus?: PurchaseOrderStatusValue;
  toStatus: PurchaseOrderStatusValue;
  performedBy: string;
  comments?: string;
}

// ============================================================================
// Repository
// ============================================================================

export class PurchaseOrderRepository extends BaseRepository {
  /**
   * Find a purchase order by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
      .limit(1);

    return result || null;
  }

  /**
   * Find purchase orders with filters and pagination
   */
  async findAll(
    organizationId: string,
    pagination: PurchaseOrderPaginationParams,
    filters: PurchaseOrderFilters = {}
  ) {
    const conditions = this.buildFilterConditions(organizationId, filters);

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch orders
    const results = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(pagination.take)
      .offset(pagination.skip);

    return { results, total };
  }

  /**
   * Find orders by vendor ID with optional status filter
   */
  async findByVendorId(vendorId: string, organizationId: string, statuses?: PurchaseOrderStatusValue[]) {
    const conditions = [
      eq(purchaseOrders.organizationId, organizationId),
      eq(purchaseOrders.vendorId, vendorId),
    ];

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(purchaseOrders.status, statuses));
    }

    return this.db.select().from(purchaseOrders).where(and(...conditions));
  }

  /**
   * Create a new purchase order
   */
  async create(data: CreatePurchaseOrderData) {
    const [result] = await this.db
      .insert(purchaseOrders)
      .values({
        organizationId: data.organizationId,
        subsidiaryId: data.subsidiaryId,
        poNumber: data.poNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        orderDate: data.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        shipToLocationId: data.shipToLocationId,
        shippingAddress: data.shippingAddress,
        shippingMethod: data.shippingMethod,
        status: data.status,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        shippingAmount: data.shippingAmount,
        totalAmount: data.totalAmount,
        receivedAmount: data.receivedAmount,
        billedAmount: data.billedAmount,
        paymentTerms: data.paymentTerms,
        currencyCode: data.currencyCode,
        exchangeRate: data.exchangeRate,
        memo: data.memo,
        internalNotes: data.internalNotes,
        createdBy: data.createdBy,
      })
      .returning();

    return result;
  }

  /**
   * Update a purchase order
   */
  async update(id: string, organizationId: string, data: UpdatePurchaseOrderData) {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: PurchaseOrderStatusValue,
    userId: string,
    additionalFields?: Record<string, unknown>
  ) {
    const updateData: Record<string, unknown> = {
      status,
      updatedBy: userId,
      updatedAt: new Date(),
      ...additionalFields,
    };

    const [result] = await this.db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
      .returning();

    return result || null;
  }

  /**
   * Delete a purchase order (should only be called for DRAFT orders)
   */
  async delete(id: string, organizationId: string) {
    await this.db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));
  }

  /**
   * Update received amount
   */
  async updateReceivedAmount(id: string, receivedAmount: string) {
    await this.db
      .update(purchaseOrders)
      .set({
        receivedAmount,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id));
  }

  /**
   * Update billed amount
   */
  async updateBilledAmount(id: string, billedAmount: string, status?: PurchaseOrderStatusValue) {
    const updateData: Record<string, unknown> = {
      billedAmount,
      updatedAt: new Date(),
    };
    if (status) {
      updateData.status = status;
    }

    await this.db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, id));
  }

  /**
   * Record approval history
   */
  async recordApprovalHistory(entry: POApprovalHistoryEntry) {
    await this.db.insert(purchaseOrderApprovalHistory).values({
      purchaseOrderId: entry.purchaseOrderId,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      performedBy: entry.performedBy,
      comments: entry.comments,
    });
  }

  /**
   * Get approval history for an order
   */
  async getApprovalHistory(purchaseOrderId: string) {
    return this.db
      .select()
      .from(purchaseOrderApprovalHistory)
      .where(eq(purchaseOrderApprovalHistory.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchaseOrderApprovalHistory.performedAt));
  }

  /**
   * Get vendor info
   */
  async getVendor(vendorId: string) {
    const [result] = await this.db
      .select({ id: entities.id, name: entities.name })
      .from(entities)
      .where(eq(entities.id, vendorId))
      .limit(1);

    return result || null;
  }

  /**
   * Generate next PO number
   */
  async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM purchase_orders
      WHERE po_number LIKE ${`PO-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `PO-${year}-${seq}`;
  }

  /**
   * Get PO status summary (for reporting)
   */
  async getPOStatusSummary(organizationId: string, subsidiaryId?: string) {
    const conditions = [eq(purchaseOrders.organizationId, organizationId)];

    if (subsidiaryId) {
      conditions.push(eq(purchaseOrders.subsidiaryId, subsidiaryId));
    }

    const summary = await this.db
      .select({
        status: purchaseOrders.status,
        count: sql<number>`count(*)`,
        totalValue: sql<string>`sum(total_amount::decimal)`,
      })
      .from(purchaseOrders)
      .where(and(...conditions))
      .groupBy(purchaseOrders.status);

    return summary;
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private buildFilterConditions(organizationId: string, filters: PurchaseOrderFilters) {
    const conditions: ReturnType<typeof eq>[] = [eq(purchaseOrders.organizationId, organizationId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(purchaseOrders.status, filters.status));
      } else {
        conditions.push(eq(purchaseOrders.status, filters.status));
      }
    }

    if (filters.vendorId) {
      conditions.push(eq(purchaseOrders.vendorId, filters.vendorId));
    }

    if (filters.subsidiaryId) {
      conditions.push(eq(purchaseOrders.subsidiaryId, filters.subsidiaryId));
    }

    if (filters.orderDateFrom) {
      const dateFrom =
        typeof filters.orderDateFrom === 'string'
          ? filters.orderDateFrom
          : filters.orderDateFrom.toISOString().split('T')[0];
      conditions.push(gte(purchaseOrders.orderDate, dateFrom));
    }

    if (filters.orderDateTo) {
      const dateTo =
        typeof filters.orderDateTo === 'string'
          ? filters.orderDateTo
          : filters.orderDateTo.toISOString().split('T')[0];
      conditions.push(lte(purchaseOrders.orderDate, dateTo));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(purchaseOrders.poNumber, `%${filters.search}%`),
          ilike(purchaseOrders.vendorName, `%${filters.search}%`),
          ilike(purchaseOrders.memo, `%${filters.search}%`)
        )!
      );
    }

    return conditions;
  }
}
