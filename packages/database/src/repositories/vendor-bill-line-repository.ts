/**
 * Vendor Bill Line Repository
 *
 * Data access layer for vendor bill line items, handling all database operations
 * for the vendor_bill_lines table.
 */

import { asc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import {
  vendorBillLines,
  purchaseOrderLines,
  purchaseOrderReceiptLines,
  type ThreeWayMatchStatusValue,
} from '../db/schema';

// ============================================================================
// Types
// ============================================================================

export interface CreateVendorBillLineData {
  vendorBillId: string;
  lineNumber: number;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
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
}

export interface UpdateVendorBillLineMatchData {
  poQuantity?: string;
  poUnitPrice?: string;
  receivedQuantity?: string;
  quantityVariance?: string;
  priceVariance?: string;
  matchStatus?: ThreeWayMatchStatusValue;
}

// ============================================================================
// Repository
// ============================================================================

export class VendorBillLineRepository extends BaseRepository {
  /**
   * Find lines by vendor bill ID
   */
  async findByBillId(vendorBillId: string) {
    return this.db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.vendorBillId, vendorBillId))
      .orderBy(asc(vendorBillLines.lineNumber));
  }

  /**
   * Find a single line by ID
   */
  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Create a new vendor bill line
   */
  async create(data: CreateVendorBillLineData) {
    const [result] = await this.db
      .insert(vendorBillLines)
      .values({
        vendorBillId: data.vendorBillId,
        lineNumber: data.lineNumber,
        purchaseOrderLineId: data.purchaseOrderLineId,
        receiptLineId: data.receiptLineId,
        itemId: data.itemId,
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        quantity: data.quantity,
        unitOfMeasure: data.unitOfMeasure,
        unitPrice: data.unitPrice,
        amount: data.amount,
        taxAmount: data.taxAmount,
        accountId: data.accountId,
        departmentId: data.departmentId,
        locationId: data.locationId,
        classId: data.classId,
        projectId: data.projectId,
        memo: data.memo,
      })
      .returning();

    return result;
  }

  /**
   * Create multiple lines in bulk
   */
  async createMany(lines: CreateVendorBillLineData[]) {
    if (lines.length === 0) return [];

    return this.db
      .insert(vendorBillLines)
      .values(
        lines.map((data) => ({
          vendorBillId: data.vendorBillId,
          lineNumber: data.lineNumber,
          purchaseOrderLineId: data.purchaseOrderLineId,
          receiptLineId: data.receiptLineId,
          itemId: data.itemId,
          itemName: data.itemName,
          itemDescription: data.itemDescription,
          quantity: data.quantity,
          unitOfMeasure: data.unitOfMeasure,
          unitPrice: data.unitPrice,
          amount: data.amount,
          taxAmount: data.taxAmount,
          accountId: data.accountId,
          departmentId: data.departmentId,
          locationId: data.locationId,
          classId: data.classId,
          projectId: data.projectId,
          memo: data.memo,
        }))
      )
      .returning();
  }

  /**
   * Update match status for a line (3-way match)
   */
  async updateMatchStatus(id: string, data: UpdateVendorBillLineMatchData) {
    await this.db
      .update(vendorBillLines)
      .set({
        poQuantity: data.poQuantity,
        poUnitPrice: data.poUnitPrice,
        receivedQuantity: data.receivedQuantity,
        quantityVariance: data.quantityVariance,
        priceVariance: data.priceVariance,
        matchStatus: data.matchStatus,
        updatedAt: new Date(),
      })
      .where(eq(vendorBillLines.id, id));
  }

  /**
   * Delete lines by bill ID
   */
  async deleteByBillId(vendorBillId: string) {
    await this.db.delete(vendorBillLines).where(eq(vendorBillLines.vendorBillId, vendorBillId));
  }

  /**
   * Get PO line by ID
   */
  async getPurchaseOrderLine(id: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Get PO lines by purchase order ID
   */
  async getPurchaseOrderLines(purchaseOrderId: string) {
    return this.db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))
      .orderBy(asc(purchaseOrderLines.lineNumber));
  }

  /**
   * Get received quantity for a PO line
   */
  async getReceivedQuantity(purchaseOrderLineId: string): Promise<string> {
    const receivedResult = await this.db
      .select({ total: sql<string>`sum(quantity_received)` })
      .from(purchaseOrderReceiptLines)
      .where(eq(purchaseOrderReceiptLines.purchaseOrderLineId, purchaseOrderLineId));

    return receivedResult[0]?.total || '0';
  }

  /**
   * Update PO line billed quantity
   */
  async updatePOLineBilledQuantity(purchaseOrderLineId: string, quantityToAdd: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_billed = quantity_billed + ${quantityToAdd}::decimal,
          updated_at = NOW()
      WHERE id = ${purchaseOrderLineId}
    `);
  }

  /**
   * Reverse PO line billed quantity
   */
  async reversePOLineBilledQuantity(purchaseOrderLineId: string, quantityToSubtract: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_billed = GREATEST(0, quantity_billed - ${quantityToSubtract}::decimal),
          updated_at = NOW()
      WHERE id = ${purchaseOrderLineId}
    `);
  }
}
