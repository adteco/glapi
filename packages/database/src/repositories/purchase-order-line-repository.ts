/**
 * Purchase Order Line Repository
 *
 * Data access layer for purchase order line items, handling all database operations
 * for the purchase_order_lines table.
 */

import { asc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';
import { purchaseOrderLines } from '../db/schema';

// ============================================================================
// Types
// ============================================================================

export interface CreatePurchaseOrderLineData {
  purchaseOrderId: string;
  lineNumber: number;
  itemId?: string;
  itemName: string;
  itemDescription?: string;
  quantity: string;
  unitOfMeasure?: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
  quantityReceived?: string;
  quantityBilled?: string;
  accountId?: string;
  departmentId?: string;
  locationId?: string;
  classId?: string;
  projectId?: string;
  memo?: string;
}

// ============================================================================
// Repository
// ============================================================================

export class PurchaseOrderLineRepository extends BaseRepository {
  /**
   * Find lines by purchase order ID
   */
  async findByPurchaseOrderId(purchaseOrderId: string) {
    return this.db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId))
      .orderBy(asc(purchaseOrderLines.lineNumber));
  }

  /**
   * Find a single line by ID
   */
  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.id, id))
      .limit(1);

    return result || null;
  }

  /**
   * Create a new purchase order line
   */
  async create(data: CreatePurchaseOrderLineData) {
    const [result] = await this.db
      .insert(purchaseOrderLines)
      .values({
        purchaseOrderId: data.purchaseOrderId,
        lineNumber: data.lineNumber,
        itemId: data.itemId,
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        quantity: data.quantity,
        unitOfMeasure: data.unitOfMeasure,
        unitPrice: data.unitPrice,
        amount: data.amount,
        taxAmount: data.taxAmount,
        quantityReceived: data.quantityReceived || '0',
        quantityBilled: data.quantityBilled || '0',
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
  async createMany(lines: CreatePurchaseOrderLineData[]) {
    if (lines.length === 0) return [];

    return this.db
      .insert(purchaseOrderLines)
      .values(
        lines.map((data) => ({
          purchaseOrderId: data.purchaseOrderId,
          lineNumber: data.lineNumber,
          itemId: data.itemId,
          itemName: data.itemName,
          itemDescription: data.itemDescription,
          quantity: data.quantity,
          unitOfMeasure: data.unitOfMeasure,
          unitPrice: data.unitPrice,
          amount: data.amount,
          taxAmount: data.taxAmount,
          quantityReceived: data.quantityReceived || '0',
          quantityBilled: data.quantityBilled || '0',
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
   * Update a line
   */
  async update(id: string, data: Partial<CreatePurchaseOrderLineData>) {
    const [result] = await this.db
      .update(purchaseOrderLines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrderLines.id, id))
      .returning();

    return result || null;
  }

  /**
   * Delete lines by purchase order ID
   */
  async deleteByPurchaseOrderId(purchaseOrderId: string) {
    await this.db
      .delete(purchaseOrderLines)
      .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId));
  }

  /**
   * Update received quantity for a line
   */
  async updateReceivedQuantity(id: string, quantityToAdd: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_received = quantity_received + ${quantityToAdd}::decimal,
          updated_at = NOW()
      WHERE id = ${id}
    `);
  }

  /**
   * Reverse received quantity for a line
   */
  async reverseReceivedQuantity(id: string, quantityToSubtract: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_received = GREATEST(0, quantity_received - ${quantityToSubtract}::decimal),
          updated_at = NOW()
      WHERE id = ${id}
    `);
  }

  /**
   * Update billed quantity for a line
   */
  async updateBilledQuantity(id: string, quantityToAdd: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_billed = quantity_billed + ${quantityToAdd}::decimal,
          updated_at = NOW()
      WHERE id = ${id}
    `);
  }

  /**
   * Reverse billed quantity for a line
   */
  async reverseBilledQuantity(id: string, quantityToSubtract: string) {
    await this.db.execute(sql`
      UPDATE purchase_order_lines
      SET quantity_billed = GREATEST(0, quantity_billed - ${quantityToSubtract}::decimal),
          updated_at = NOW()
      WHERE id = ${id}
    `);
  }
}
