/**
 * Inventory Adjustment Service
 *
 * Handles inventory quantity and value adjustments with:
 * - Workflow management (draft -> approval -> posting)
 * - GL posting integration
 * - Cost layer updates
 * - Approval history tracking
 */

import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import {
  inventoryAdjustments,
  inventoryAdjustmentLines,
  inventoryApprovalHistory,
  adjustmentReasonCodes,
  itemCostLayers,
  itemCostHistory,
  type InventoryAdjustmentRecord,
  type InsertInventoryAdjustment,
  type InventoryAdjustmentLineRecord,
  type InsertInventoryAdjustmentLine,
  type AdjustmentTypeValue,
  type AdjustmentStatusValue,
} from '@glapi/database';
import { getDb } from '@glapi/database';
import { DatabaseType } from '@glapi/database';
import { ItemCostingConfigService } from './item-costing-config-service';

// Service context
export interface AdjustmentServiceContext {
  organizationId: string;
  userId?: string;
  userName?: string;
}

// Adjustment with lines
export interface AdjustmentWithLines extends InventoryAdjustmentRecord {
  lines: InventoryAdjustmentLineRecord[];
}

// Create adjustment input
export interface CreateAdjustmentInput {
  subsidiaryId: string;
  adjustmentDate: string;
  adjustmentType: AdjustmentTypeValue;
  reasonCode?: string;
  reason?: string;
  reference?: string;
  notes?: string;
  lines: CreateAdjustmentLineInput[];
}

export interface CreateAdjustmentLineInput {
  itemId: string;
  warehouseId?: string;
  locationId?: string;
  binId?: string;
  lotNumberId?: string;
  serialNumber?: string;
  quantityAdjustment?: number;
  unitCostAfter?: number;
  inventoryAccountId?: string;
  adjustmentAccountId?: string;
  notes?: string;
}

// Status transition validation
const VALID_TRANSITIONS: Record<AdjustmentStatusValue, AdjustmentStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  POSTED: [],
  REJECTED: ['DRAFT'],
  CANCELLED: [],
};

export class InventoryAdjustmentService {
  private db: DatabaseType;
  private context: AdjustmentServiceContext;
  private costingService: ItemCostingConfigService;

  constructor(context: AdjustmentServiceContext) {
    this.db = getDb();
    this.context = context;
    this.costingService = new ItemCostingConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });
  }

  /**
   * Generate unique adjustment number
   */
  private async generateAdjustmentNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count of adjustments this month
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.organizationId, this.context.organizationId),
          sql`extract(year from ${inventoryAdjustments.adjustmentDate}) = ${year}`,
          sql`extract(month from ${inventoryAdjustments.adjustmentDate}) = ${date.getMonth() + 1}`
        )
      );

    const sequence = String((result?.count || 0) + 1).padStart(4, '0');
    return `ADJ-${year}${month}-${sequence}`;
  }

  /**
   * Create a new adjustment
   */
  async createAdjustment(input: CreateAdjustmentInput): Promise<AdjustmentWithLines> {
    const adjustmentNumber = await this.generateAdjustmentNumber();

    // Get reason code defaults if provided
    let defaultInventoryAccountId: string | undefined;
    let defaultAdjustmentAccountId: string | undefined;

    if (input.reasonCode) {
      const [reasonCode] = await this.db
        .select()
        .from(adjustmentReasonCodes)
        .where(
          and(
            eq(adjustmentReasonCodes.organizationId, this.context.organizationId),
            eq(adjustmentReasonCodes.code, input.reasonCode),
            eq(adjustmentReasonCodes.isActive, true)
          )
        );

      if (reasonCode) {
        defaultInventoryAccountId = reasonCode.defaultInventoryAccountId ?? undefined;
        defaultAdjustmentAccountId = reasonCode.defaultAdjustmentAccountId ?? undefined;
      }
    }

    // Create adjustment header
    const [adjustment] = await this.db
      .insert(inventoryAdjustments)
      .values({
        organizationId: this.context.organizationId,
        subsidiaryId: input.subsidiaryId,
        adjustmentNumber,
        adjustmentDate: input.adjustmentDate,
        adjustmentType: input.adjustmentType,
        status: 'DRAFT',
        reasonCode: input.reasonCode,
        reason: input.reason,
        reference: input.reference,
        notes: input.notes,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    // Create adjustment lines
    const lines: InventoryAdjustmentLineRecord[] = [];

    for (const lineInput of input.lines) {
      // Get current quantity and cost from cost layers
      const currentValues = await this.getCurrentItemValues(
        lineInput.itemId,
        input.subsidiaryId,
        lineInput.warehouseId,
        lineInput.locationId
      );

      const quantityBefore = currentValues.quantity;
      const unitCostBefore = currentValues.unitCost;
      const quantityAdjustment = lineInput.quantityAdjustment ?? 0;
      const quantityAfter = quantityBefore + quantityAdjustment;
      const unitCostAfter = lineInput.unitCostAfter ?? unitCostBefore;
      const totalValueBefore = quantityBefore * unitCostBefore;
      const totalValueAfter = quantityAfter * unitCostAfter;
      const adjustmentValue = totalValueAfter - totalValueBefore;

      const [line] = await this.db
        .insert(inventoryAdjustmentLines)
        .values({
          adjustmentId: adjustment.id,
          itemId: lineInput.itemId,
          warehouseId: lineInput.warehouseId,
          locationId: lineInput.locationId,
          binId: lineInput.binId,
          lotNumberId: lineInput.lotNumberId,
          serialNumber: lineInput.serialNumber,
          quantityBefore: String(quantityBefore),
          quantityAdjustment: String(quantityAdjustment),
          quantityAfter: String(quantityAfter),
          unitCostBefore: String(unitCostBefore),
          unitCostAfter: String(unitCostAfter),
          totalValueBefore: String(totalValueBefore),
          totalValueAfter: String(totalValueAfter),
          adjustmentValue: String(adjustmentValue),
          inventoryAccountId: lineInput.inventoryAccountId ?? defaultInventoryAccountId,
          adjustmentAccountId: lineInput.adjustmentAccountId ?? defaultAdjustmentAccountId,
          costingMethod: currentValues.costingMethod,
          notes: lineInput.notes,
        })
        .returning();

      lines.push(line);
    }

    return { ...adjustment, lines };
  }

  /**
   * Get current item values from cost layers
   */
  private async getCurrentItemValues(
    itemId: string,
    subsidiaryId: string,
    warehouseId?: string,
    locationId?: string
  ): Promise<{ quantity: number; unitCost: number; costingMethod: string }> {
    // Get effective costing config
    const config = await this.costingService.getEffectiveConfig(itemId, subsidiaryId);

    // Get current quantity and cost from layers
    const layers = await this.db
      .select()
      .from(itemCostLayers)
      .where(
        and(
          eq(itemCostLayers.organizationId, this.context.organizationId),
          eq(itemCostLayers.itemId, itemId),
          eq(itemCostLayers.subsidiaryId, subsidiaryId),
          eq(itemCostLayers.isFullyDepleted, false)
        )
      );

    let totalQty = 0;
    let totalValue = 0;

    for (const layer of layers) {
      const qty = Number(layer.quantityRemaining);
      const cost = Number(layer.unitCost);
      totalQty += qty;
      totalValue += qty * cost;
    }

    return {
      quantity: totalQty,
      unitCost: totalQty > 0 ? totalValue / totalQty : 0,
      costingMethod: config.costingMethod,
    };
  }

  /**
   * Get adjustment by ID
   */
  async getAdjustment(id: string): Promise<AdjustmentWithLines | null> {
    const [adjustment] = await this.db
      .select()
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.id, id),
          eq(inventoryAdjustments.organizationId, this.context.organizationId)
        )
      );

    if (!adjustment) return null;

    const lines = await this.db
      .select()
      .from(inventoryAdjustmentLines)
      .where(eq(inventoryAdjustmentLines.adjustmentId, id));

    return { ...adjustment, lines };
  }

  /**
   * List adjustments with optional filters
   */
  async listAdjustments(options?: {
    status?: AdjustmentStatusValue;
    subsidiaryId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: InventoryAdjustmentRecord[]; total: number }> {
    const conditions = [eq(inventoryAdjustments.organizationId, this.context.organizationId)];

    if (options?.status) {
      conditions.push(eq(inventoryAdjustments.status, options.status));
    }
    if (options?.subsidiaryId) {
      conditions.push(eq(inventoryAdjustments.subsidiaryId, options.subsidiaryId));
    }
    if (options?.fromDate) {
      conditions.push(sql`${inventoryAdjustments.adjustmentDate} >= ${options.fromDate}`);
    }
    if (options?.toDate) {
      conditions.push(sql`${inventoryAdjustments.adjustmentDate} <= ${options.toDate}`);
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryAdjustments)
      .where(and(...conditions));

    const query = this.db
      .select()
      .from(inventoryAdjustments)
      .where(and(...conditions))
      .orderBy(desc(inventoryAdjustments.adjustmentDate));

    if (options?.limit) query.limit(options.limit);
    if (options?.offset) query.offset(options.offset);

    const data = await query;

    return { data, total: countResult?.count || 0 };
  }

  /**
   * Submit adjustment for approval
   */
  async submitForApproval(id: string): Promise<AdjustmentWithLines> {
    return this.transitionStatus(id, 'PENDING_APPROVAL', 'SUBMITTED');
  }

  /**
   * Approve adjustment
   */
  async approve(id: string, comments?: string): Promise<AdjustmentWithLines> {
    return this.transitionStatus(id, 'APPROVED', 'APPROVED', comments);
  }

  /**
   * Reject adjustment
   */
  async reject(id: string, reason: string): Promise<AdjustmentWithLines> {
    const adjustment = await this.getAdjustment(id);
    if (!adjustment) {
      throw new Error('Adjustment not found');
    }

    if (!VALID_TRANSITIONS[adjustment.status].includes('REJECTED')) {
      throw new Error(`Cannot reject adjustment in ${adjustment.status} status`);
    }

    const [updated] = await this.db
      .update(inventoryAdjustments)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: this.context.userId,
        rejectionReason: reason,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryAdjustments.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'REJECTED', adjustment.status, 'REJECTED', reason);

    const lines = await this.db
      .select()
      .from(inventoryAdjustmentLines)
      .where(eq(inventoryAdjustmentLines.adjustmentId, id));

    return { ...updated, lines };
  }

  /**
   * Cancel adjustment
   */
  async cancel(id: string): Promise<AdjustmentWithLines> {
    return this.transitionStatus(id, 'CANCELLED', 'CANCELLED');
  }

  /**
   * Post adjustment to GL and update inventory
   */
  async post(id: string): Promise<AdjustmentWithLines> {
    const adjustment = await this.getAdjustment(id);
    if (!adjustment) {
      throw new Error('Adjustment not found');
    }

    if (adjustment.status !== 'APPROVED') {
      throw new Error('Adjustment must be approved before posting');
    }

    // Update cost layers based on adjustment type
    for (const line of adjustment.lines) {
      await this.updateCostLayers(adjustment, line);
    }

    // TODO: Create GL transaction via GL posting engine
    // const glTransaction = await this.glPostingEngine.postAdjustment(adjustment);

    const [updated] = await this.db
      .update(inventoryAdjustments)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        // glTransactionId: glTransaction.id,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryAdjustments.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'POSTED', 'APPROVED', 'POSTED');

    return { ...updated, lines: adjustment.lines };
  }

  /**
   * Update cost layers based on adjustment
   */
  private async updateCostLayers(
    adjustment: InventoryAdjustmentRecord,
    line: InventoryAdjustmentLineRecord
  ): Promise<void> {
    const quantityAdjustment = Number(line.quantityAdjustment || 0);
    const unitCostAfter = Number(line.unitCostAfter || 0);

    if (adjustment.adjustmentType === 'QUANTITY_INCREASE' && quantityAdjustment > 0) {
      // Create a new cost layer for the added quantity
      await this.costingService.createCostLayer({
        subsidiaryId: adjustment.subsidiaryId,
        itemId: line.itemId,
        layerNumber: `ADJ-${adjustment.adjustmentNumber}-${line.id}`,
        receiptDate: new Date(),
        sourceTransactionId: adjustment.id,
        sourceTransactionType: 'ADJUSTMENT',
        sourceDocumentNumber: adjustment.adjustmentNumber,
        quantityReceived: String(quantityAdjustment),
        quantityRemaining: String(quantityAdjustment),
        unitCost: String(unitCostAfter),
        totalCost: String(quantityAdjustment * unitCostAfter),
      });
    } else if (
      (adjustment.adjustmentType === 'QUANTITY_DECREASE' ||
        adjustment.adjustmentType === 'WRITE_OFF') &&
      quantityAdjustment < 0
    ) {
      // Consume from existing layers
      const config = await this.costingService.getEffectiveConfig(
        line.itemId,
        adjustment.subsidiaryId
      );

      if (config.costingMethod === 'FIFO' || config.costingMethod === 'LIFO') {
        await this.costingService.consumeFromLayers(
          line.itemId,
          adjustment.subsidiaryId,
          Math.abs(quantityAdjustment),
          config.costingMethod
        );
      }
    }

    // Record cost history
    await this.costingService.recordCostHistory({
      organizationId: this.context.organizationId,
      subsidiaryId: adjustment.subsidiaryId,
      itemId: line.itemId,
      changeType: adjustment.adjustmentType,
      previousCost: line.unitCostBefore,
      newCost: line.unitCostAfter,
      varianceAmount: line.adjustmentValue,
      affectedTransactionId: adjustment.id,
      affectedTransactionType: 'ADJUSTMENT',
      quantityAffected: line.quantityAdjustment,
      totalValueChange: line.adjustmentValue,
      changeReason: adjustment.reason,
      createdBy: this.context.userId,
    });
  }

  /**
   * Transition status with validation
   */
  private async transitionStatus(
    id: string,
    newStatus: AdjustmentStatusValue,
    action: string,
    comments?: string
  ): Promise<AdjustmentWithLines> {
    const adjustment = await this.getAdjustment(id);
    if (!adjustment) {
      throw new Error('Adjustment not found');
    }

    if (!VALID_TRANSITIONS[adjustment.status].includes(newStatus)) {
      throw new Error(`Cannot transition from ${adjustment.status} to ${newStatus}`);
    }

    const updateData: Partial<InsertInventoryAdjustment> = {
      status: newStatus,
      updatedAt: new Date(),
      updatedBy: this.context.userId,
    };

    if (newStatus === 'PENDING_APPROVAL') {
      updateData.submittedAt = new Date();
      updateData.submittedBy = this.context.userId;
    } else if (newStatus === 'APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = this.context.userId;
    }

    const [updated] = await this.db
      .update(inventoryAdjustments)
      .set(updateData)
      .where(eq(inventoryAdjustments.id, id))
      .returning();

    await this.recordApprovalHistory(id, action, adjustment.status, newStatus, comments);

    return { ...updated, lines: adjustment.lines };
  }

  /**
   * Record approval history
   */
  private async recordApprovalHistory(
    documentId: string,
    action: string,
    previousStatus: string,
    newStatus: string,
    comments?: string
  ): Promise<void> {
    await this.db.insert(inventoryApprovalHistory).values({
      organizationId: this.context.organizationId,
      documentType: 'ADJUSTMENT',
      documentId,
      action,
      previousStatus,
      newStatus,
      actorId: this.context.userId!,
      actorName: this.context.userName,
      comments,
    });
  }
}
