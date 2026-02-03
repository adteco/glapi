/**
 * Purchase Order Receipt Repository
 *
 * Data access layer for purchase order receipts and receipt lines,
 * handling all database operations for the purchase_order_receipts
 * and purchase_order_receipt_lines tables.
 */

import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  purchaseOrderReceipts,
  purchaseOrderReceiptLines,
  purchaseOrders,
  locations,
  type ReceiptStatusValue,
} from '../db/schema';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptFilters {
  status?: ReceiptStatusValue;
  purchaseOrderId?: string;
  locationId?: string;
  receiptDateFrom?: string | Date;
  receiptDateTo?: string | Date;
  search?: string;
}

export interface ReceiptPaginationParams {
  skip: number;
  take: number;
}

export interface CreateReceiptData {
  organizationId: string;
  subsidiaryId: string;
  purchaseOrderId: string;
  receiptNumber: string;
  vendorId: string;
  locationId?: string;
  receiptDate: string;
  status: ReceiptStatusValue;
  memo?: string;
  shippingRef?: string;
  carrierName?: string;
  totalReceivedValue?: string;
  createdBy: string;
}

export interface CreateReceiptLineData {
  receiptId: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  itemId?: string;
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
  serialNumbers?: string;
  memo?: string;
}

// ============================================================================
// Repository
// ============================================================================

export class PurchaseOrderReceiptRepository extends BaseRepository {
  /**
   * Find a receipt by ID with organization context
   */
  async findById(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrderReceipts)
      .where(
        and(
          eq(purchaseOrderReceipts.id, id),
          eq(purchaseOrderReceipts.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Find receipts with filters and pagination
   */
  async findAll(
    organizationId: string,
    pagination: ReceiptPaginationParams,
    filters: ReceiptFilters = {}
  ) {
    const conditions = this.buildFilterConditions(organizationId, filters);

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrderReceipts)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Fetch receipts
    const results = await this.db
      .select()
      .from(purchaseOrderReceipts)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrderReceipts.createdAt))
      .limit(pagination.take)
      .offset(pagination.skip);

    return { results, total };
  }

  /**
   * Find receipts by purchase order ID
   */
  async findByPurchaseOrderId(purchaseOrderId: string) {
    return this.db
      .select()
      .from(purchaseOrderReceipts)
      .where(eq(purchaseOrderReceipts.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchaseOrderReceipts.createdAt));
  }

  /**
   * Create a new receipt
   */
  async create(data: CreateReceiptData) {
    const [result] = await this.db
      .insert(purchaseOrderReceipts)
      .values({
        organizationId: data.organizationId,
        subsidiaryId: data.subsidiaryId,
        purchaseOrderId: data.purchaseOrderId,
        receiptNumber: data.receiptNumber,
        vendorId: data.vendorId,
        locationId: data.locationId,
        receiptDate: data.receiptDate,
        status: data.status,
        memo: data.memo,
        shippingRef: data.shippingRef,
        carrierName: data.carrierName,
        totalReceivedValue: data.totalReceivedValue || '0',
        createdBy: data.createdBy,
      })
      .returning();

    return result;
  }

  /**
   * Update receipt status
   */
  async updateStatus(id: string, status: ReceiptStatusValue, userId: string) {
    const additionalFields: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (status === 'POSTED') {
      additionalFields.postedAt = new Date();
      additionalFields.postedBy = userId;
    }

    const [result] = await this.db
      .update(purchaseOrderReceipts)
      .set({
        status,
        ...additionalFields,
      })
      .where(eq(purchaseOrderReceipts.id, id))
      .returning();

    return result || null;
  }

  /**
   * Generate next receipt number
   */
  async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as seq
      FROM purchase_order_receipts
      WHERE receipt_number LIKE ${`RCV-${year}-%`}
    `);
    const seq = String((result.rows[0] as { seq: number }).seq).padStart(6, '0');
    return `RCV-${year}-${seq}`;
  }

  /**
   * Get purchase order for a receipt
   */
  async getPurchaseOrder(purchaseOrderId: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, organizationId)
        )
      )
      .limit(1);

    return result || null;
  }

  /**
   * Get location info
   */
  async getLocation(locationId: string) {
    const [result] = await this.db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1);

    return result || null;
  }

  // ============================================================================
  // Receipt Lines
  // ============================================================================

  /**
   * Find receipt lines by receipt ID
   */
  async findLinesByReceiptId(receiptId: string) {
    return this.db
      .select()
      .from(purchaseOrderReceiptLines)
      .where(eq(purchaseOrderReceiptLines.receiptId, receiptId))
      .orderBy(asc(purchaseOrderReceiptLines.lineNumber));
  }

  /**
   * Create a receipt line
   */
  async createLine(data: CreateReceiptLineData) {
    const [result] = await this.db
      .insert(purchaseOrderReceiptLines)
      .values({
        receiptId: data.receiptId,
        purchaseOrderLineId: data.purchaseOrderLineId,
        lineNumber: data.lineNumber,
        itemId: data.itemId,
        itemName: data.itemName,
        quantityReceived: data.quantityReceived,
        unitOfMeasure: data.unitOfMeasure,
        unitCost: data.unitCost,
        receivedValue: data.receivedValue,
        quantityAccepted: data.quantityAccepted,
        quantityRejected: data.quantityRejected,
        rejectionReason: data.rejectionReason,
        binLocation: data.binLocation,
        lotNumber: data.lotNumber,
        serialNumbers: data.serialNumbers,
        memo: data.memo,
      })
      .returning();

    return result;
  }

  /**
   * Create multiple receipt lines in bulk
   */
  async createManyLines(lines: CreateReceiptLineData[]) {
    if (lines.length === 0) return [];

    return this.db
      .insert(purchaseOrderReceiptLines)
      .values(
        lines.map((data) => ({
          receiptId: data.receiptId,
          purchaseOrderLineId: data.purchaseOrderLineId,
          lineNumber: data.lineNumber,
          itemId: data.itemId,
          itemName: data.itemName,
          quantityReceived: data.quantityReceived,
          unitOfMeasure: data.unitOfMeasure,
          unitCost: data.unitCost,
          receivedValue: data.receivedValue,
          quantityAccepted: data.quantityAccepted,
          quantityRejected: data.quantityRejected,
          rejectionReason: data.rejectionReason,
          binLocation: data.binLocation,
          lotNumber: data.lotNumber,
          serialNumbers: data.serialNumbers,
          memo: data.memo,
        }))
      )
      .returning();
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private buildFilterConditions(organizationId: string, filters: ReceiptFilters) {
    const conditions: ReturnType<typeof eq>[] = [
      eq(purchaseOrderReceipts.organizationId, organizationId),
    ];

    if (filters.status) {
      conditions.push(eq(purchaseOrderReceipts.status, filters.status));
    }

    if (filters.purchaseOrderId) {
      conditions.push(eq(purchaseOrderReceipts.purchaseOrderId, filters.purchaseOrderId));
    }

    if (filters.locationId) {
      conditions.push(eq(purchaseOrderReceipts.locationId, filters.locationId));
    }

    if (filters.receiptDateFrom) {
      const dateFrom =
        typeof filters.receiptDateFrom === 'string'
          ? filters.receiptDateFrom
          : filters.receiptDateFrom.toISOString().split('T')[0];
      conditions.push(gte(purchaseOrderReceipts.receiptDate, dateFrom));
    }

    if (filters.receiptDateTo) {
      const dateTo =
        typeof filters.receiptDateTo === 'string'
          ? filters.receiptDateTo
          : filters.receiptDateTo.toISOString().split('T')[0];
      conditions.push(lte(purchaseOrderReceipts.receiptDate, dateTo));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(purchaseOrderReceipts.receiptNumber, `%${filters.search}%`),
          ilike(purchaseOrderReceipts.shippingRef, `%${filters.search}%`),
          ilike(purchaseOrderReceipts.memo, `%${filters.search}%`)
        )!
      );
    }

    return conditions;
  }
}
