/**
 * Inventory Transfer Service
 *
 * Handles inventory transfers between locations/subsidiaries with:
 * - Workflow management (draft -> approval -> in_transit -> received -> posted)
 * - Intercompany transfer support with transfer pricing
 * - Transit accounting
 * - GL posting integration
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import {
  inventoryTransfers,
  inventoryTransferLines,
  inventoryApprovalHistory,
  itemCostLayers,
  type InventoryTransferRecord,
  type InsertInventoryTransfer,
  type InventoryTransferLineRecord,
  type InsertInventoryTransferLine,
  type TransferTypeValue,
  type TransferStatusValue,
} from '@glapi/database';
import { getDb } from '@glapi/database';
import { DatabaseType } from '@glapi/database';
import { ItemCostingConfigService } from './item-costing-config-service';
import { InventoryGlPostingService, InventoryAccountConfig } from './inventory-gl-posting-service';

// Service context
export interface TransferServiceContext {
  organizationId: string;
  userId?: string;
  userName?: string;
}

// Transfer with lines
export interface TransferWithLines extends InventoryTransferRecord {
  lines: InventoryTransferLineRecord[];
}

// Create transfer input
export interface CreateTransferInput {
  transferDate: string;
  transferType: TransferTypeValue;
  fromSubsidiaryId: string;
  fromWarehouseId?: string;
  fromLocationId?: string;
  toSubsidiaryId: string;
  toWarehouseId?: string;
  toLocationId?: string;
  isIntercompany?: boolean;
  transferPrice?: number;
  currencyCode?: string;
  expectedShipDate?: string;
  expectedReceiveDate?: string;
  reason?: string;
  reference?: string;
  notes?: string;
  lines: CreateTransferLineInput[];
}

export interface CreateTransferLineInput {
  itemId: string;
  fromBinId?: string;
  toBinId?: string;
  lotNumberId?: string;
  serialNumber?: string;
  quantityRequested: number;
  transferUnitPrice?: number;
  fromInventoryAccountId?: string;
  toInventoryAccountId?: string;
  transitAccountId?: string;
  notes?: string;
}

// Status transition validation
const VALID_TRANSITIONS: Record<TransferStatusValue, TransferStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['POSTED', 'CANCELLED'],
  POSTED: [],
  REJECTED: ['DRAFT'],
  CANCELLED: [],
};

export class InventoryTransferService {
  private db: DatabaseType;
  private context: TransferServiceContext;
  private costingService: ItemCostingConfigService;
  private glPostingService: InventoryGlPostingService;

  constructor(context: TransferServiceContext) {
    this.db = getDb();
    this.context = context;
    this.costingService = new ItemCostingConfigService({
      organizationId: context.organizationId,
      userId: context.userId,
    });
    this.glPostingService = new InventoryGlPostingService({
      organizationId: context.organizationId,
      userId: context.userId,
    });
  }

  /**
   * Generate unique transfer number
   */
  private async generateTransferNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryTransfers)
      .where(
        and(
          eq(inventoryTransfers.organizationId, this.context.organizationId),
          sql`extract(year from ${inventoryTransfers.transferDate}) = ${year}`,
          sql`extract(month from ${inventoryTransfers.transferDate}) = ${date.getMonth() + 1}`
        )
      );

    const sequence = String((result?.count || 0) + 1).padStart(4, '0');
    return `TRF-${year}${month}-${sequence}`;
  }

  /**
   * Create a new transfer
   */
  async createTransfer(input: CreateTransferInput): Promise<TransferWithLines> {
    const transferNumber = await this.generateTransferNumber();

    // Determine if intercompany
    const isIntercompany =
      input.isIntercompany ?? input.fromSubsidiaryId !== input.toSubsidiaryId;

    // Create transfer header
    const [transfer] = await this.db
      .insert(inventoryTransfers)
      .values({
        organizationId: this.context.organizationId,
        transferNumber,
        transferDate: input.transferDate,
        transferType: input.transferType,
        status: 'DRAFT',
        fromSubsidiaryId: input.fromSubsidiaryId,
        fromWarehouseId: input.fromWarehouseId,
        fromLocationId: input.fromLocationId,
        toSubsidiaryId: input.toSubsidiaryId,
        toWarehouseId: input.toWarehouseId,
        toLocationId: input.toLocationId,
        isIntercompany,
        transferPrice: input.transferPrice ? String(input.transferPrice) : undefined,
        currencyCode: input.currencyCode ?? 'USD',
        expectedShipDate: input.expectedShipDate,
        expectedReceiveDate: input.expectedReceiveDate,
        reason: input.reason,
        reference: input.reference,
        notes: input.notes,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    // Create transfer lines
    const lines: InventoryTransferLineRecord[] = [];

    for (const lineInput of input.lines) {
      // Get current cost for the item
      const config = await this.costingService.getEffectiveConfig(
        lineInput.itemId,
        input.fromSubsidiaryId
      );

      let unitCost = 0;
      if (config.costingMethod === 'STANDARD' && config.standardCost) {
        unitCost = config.standardCost;
      } else {
        unitCost = await this.costingService.getAverageCost(
          lineInput.itemId,
          input.fromSubsidiaryId
        );
      }

      const totalCost = unitCost * lineInput.quantityRequested;
      const transferUnitPrice = lineInput.transferUnitPrice ?? unitCost;
      const transferTotalPrice = transferUnitPrice * lineInput.quantityRequested;

      const [line] = await this.db
        .insert(inventoryTransferLines)
        .values({
          transferId: transfer.id,
          itemId: lineInput.itemId,
          fromBinId: lineInput.fromBinId,
          toBinId: lineInput.toBinId,
          lotNumberId: lineInput.lotNumberId,
          serialNumber: lineInput.serialNumber,
          quantityRequested: String(lineInput.quantityRequested),
          unitCost: String(unitCost),
          totalCost: String(totalCost),
          transferUnitPrice: String(transferUnitPrice),
          transferTotalPrice: String(transferTotalPrice),
          fromInventoryAccountId: lineInput.fromInventoryAccountId,
          toInventoryAccountId: lineInput.toInventoryAccountId,
          transitAccountId: lineInput.transitAccountId,
          notes: lineInput.notes,
        })
        .returning();

      lines.push(line);
    }

    return { ...transfer, lines };
  }

  /**
   * Get transfer by ID
   */
  async getTransfer(id: string): Promise<TransferWithLines | null> {
    const [transfer] = await this.db
      .select()
      .from(inventoryTransfers)
      .where(
        and(
          eq(inventoryTransfers.id, id),
          eq(inventoryTransfers.organizationId, this.context.organizationId)
        )
      );

    if (!transfer) return null;

    const lines = await this.db
      .select()
      .from(inventoryTransferLines)
      .where(eq(inventoryTransferLines.transferId, id));

    return { ...transfer, lines };
  }

  /**
   * List transfers with optional filters
   */
  async listTransfers(options?: {
    status?: TransferStatusValue;
    fromSubsidiaryId?: string;
    toSubsidiaryId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: InventoryTransferRecord[]; total: number }> {
    const conditions = [eq(inventoryTransfers.organizationId, this.context.organizationId)];

    if (options?.status) {
      conditions.push(eq(inventoryTransfers.status, options.status));
    }
    if (options?.fromSubsidiaryId) {
      conditions.push(eq(inventoryTransfers.fromSubsidiaryId, options.fromSubsidiaryId));
    }
    if (options?.toSubsidiaryId) {
      conditions.push(eq(inventoryTransfers.toSubsidiaryId, options.toSubsidiaryId));
    }
    if (options?.fromDate) {
      conditions.push(sql`${inventoryTransfers.transferDate} >= ${options.fromDate}`);
    }
    if (options?.toDate) {
      conditions.push(sql`${inventoryTransfers.transferDate} <= ${options.toDate}`);
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryTransfers)
      .where(and(...conditions));

    const query = this.db
      .select()
      .from(inventoryTransfers)
      .where(and(...conditions))
      .orderBy(desc(inventoryTransfers.transferDate));

    if (options?.limit) query.limit(options.limit);
    if (options?.offset) query.offset(options.offset);

    const data = await query;

    return { data, total: countResult?.count || 0 };
  }

  /**
   * Submit transfer for approval
   */
  async submitForApproval(id: string): Promise<TransferWithLines> {
    return this.transitionStatus(id, 'PENDING_APPROVAL', 'SUBMITTED');
  }

  /**
   * Approve transfer
   */
  async approve(id: string, comments?: string): Promise<TransferWithLines> {
    return this.transitionStatus(id, 'APPROVED', 'APPROVED', comments);
  }

  /**
   * Reject transfer
   */
  async reject(id: string, reason: string): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (!VALID_TRANSITIONS[transfer.status].includes('REJECTED')) {
      throw new Error(`Cannot reject transfer in ${transfer.status} status`);
    }

    const [updated] = await this.db
      .update(inventoryTransfers)
      .set({
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: this.context.userId,
        rejectionReason: reason,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryTransfers.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'REJECTED', transfer.status, 'REJECTED', reason);

    return { ...updated, lines: transfer.lines };
  }

  /**
   * Ship transfer (move to in-transit)
   */
  async ship(
    id: string,
    shipData?: {
      trackingNumber?: string;
      carrier?: string;
      estimatedArrival?: Date;
      shippedQuantities?: Record<string, number>;
      accountConfig?: InventoryAccountConfig;
    }
  ): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'APPROVED') {
      throw new Error('Transfer must be approved before shipping');
    }

    // Update shipped quantities
    for (const line of transfer.lines) {
      const shippedQty = shipData?.shippedQuantities?.[line.id] ?? Number(line.quantityRequested);

      await this.db
        .update(inventoryTransferLines)
        .set({
          quantityShipped: String(shippedQty),
          updatedAt: new Date(),
        })
        .where(eq(inventoryTransferLines.id, line.id));

      // Remove from source inventory (consume from layers)
      await this.removeFromSourceInventory(transfer, line, shippedQty);
    }

    // Post shipment to GL if account config provided
    let shipGlTransactionId: string | undefined;
    if (shipData?.accountConfig) {
      const glResult = await this.glPostingService.postTransferShipment(id, shipData.accountConfig);
      shipGlTransactionId = glResult.glTransactionId;
    }

    // Update transfer header
    const [updated] = await this.db
      .update(inventoryTransfers)
      .set({
        status: 'IN_TRANSIT',
        actualShipDate: new Date().toISOString().split('T')[0],
        shippedAt: new Date(),
        trackingNumber: shipData?.trackingNumber,
        carrier: shipData?.carrier,
        shipGlTransactionId,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryTransfers.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'SHIPPED', 'APPROVED', 'IN_TRANSIT');

    // Refresh lines
    const lines = await this.db
      .select()
      .from(inventoryTransferLines)
      .where(eq(inventoryTransferLines.transferId, id));

    return { ...updated, lines };
  }

  /**
   * Receive transfer
   */
  async receive(
    id: string,
    receiveData?: {
      receivedQuantities?: Record<string, number>;
      accountConfig?: InventoryAccountConfig;
    }
  ): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'IN_TRANSIT') {
      throw new Error('Transfer must be in transit to receive');
    }

    // Update received quantities and add to destination inventory
    for (const line of transfer.lines) {
      const receivedQty = receiveData?.receivedQuantities?.[line.id] ?? Number(line.quantityShipped);

      await this.db
        .update(inventoryTransferLines)
        .set({
          quantityReceived: String(receivedQty),
          updatedAt: new Date(),
        })
        .where(eq(inventoryTransferLines.id, line.id));

      // Add to destination inventory
      await this.addToDestinationInventory(transfer, line, receivedQty);
    }

    // Post receipt to GL if account config provided
    let receiveGlTransactionId: string | undefined;
    if (receiveData?.accountConfig) {
      const glResult = await this.glPostingService.postTransferReceipt(id, receiveData.accountConfig);
      receiveGlTransactionId = glResult.glTransactionId;
    }

    const [updated] = await this.db
      .update(inventoryTransfers)
      .set({
        status: 'RECEIVED',
        actualReceiveDate: new Date().toISOString().split('T')[0],
        receivedAt: new Date(),
        receiveGlTransactionId,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryTransfers.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'RECEIVED', 'IN_TRANSIT', 'RECEIVED');

    const lines = await this.db
      .select()
      .from(inventoryTransferLines)
      .where(eq(inventoryTransferLines.transferId, id));

    return { ...updated, lines };
  }

  /**
   * Post transfer to GL (finalize if not already posted during ship/receive)
   */
  async post(id: string, accountConfig?: InventoryAccountConfig): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status !== 'RECEIVED') {
      throw new Error('Transfer must be received before posting');
    }

    // If GL entries haven't been created during ship/receive, create them now
    if (accountConfig && !transfer.receiveGlTransactionId) {
      // For intra-subsidiary transfers, we can do a direct entry
      if (transfer.fromSubsidiaryId === transfer.toSubsidiaryId) {
        const glResult = await this.glPostingService.postDirectTransfer(id, accountConfig);
        await this.db
          .update(inventoryTransfers)
          .set({
            receiveGlTransactionId: glResult.glTransactionId,
          })
          .where(eq(inventoryTransfers.id, id));
      } else {
        // For inter-subsidiary, ensure both ship and receive are posted
        if (!transfer.shipGlTransactionId) {
          const shipResult = await this.glPostingService.postTransferShipment(id, accountConfig);
          await this.db
            .update(inventoryTransfers)
            .set({
              shipGlTransactionId: shipResult.glTransactionId,
            })
            .where(eq(inventoryTransfers.id, id));
        }
        const receiptResult = await this.glPostingService.postTransferReceipt(id, accountConfig);
        await this.db
          .update(inventoryTransfers)
          .set({
            receiveGlTransactionId: receiptResult.glTransactionId,
          })
          .where(eq(inventoryTransfers.id, id));
      }
    }

    const [updated] = await this.db
      .update(inventoryTransfers)
      .set({
        status: 'POSTED',
        postedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(inventoryTransfers.id, id))
      .returning();

    await this.recordApprovalHistory(id, 'POSTED', 'RECEIVED', 'POSTED');

    // Refresh to get updated GL references
    const lines = await this.db
      .select()
      .from(inventoryTransferLines)
      .where(eq(inventoryTransferLines.transferId, id));

    return { ...updated, lines };
  }

  /**
   * Cancel transfer
   */
  async cancel(id: string): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    // If already shipped, need to reverse inventory changes
    if (transfer.status === 'IN_TRANSIT') {
      for (const line of transfer.lines) {
        await this.reverseShipment(transfer, line);
      }
    }

    return this.transitionStatus(id, 'CANCELLED', 'CANCELLED');
  }

  /**
   * Remove items from source inventory
   */
  private async removeFromSourceInventory(
    transfer: InventoryTransferRecord,
    line: InventoryTransferLineRecord,
    quantity: number
  ): Promise<void> {
    const config = await this.costingService.getEffectiveConfig(
      line.itemId,
      transfer.fromSubsidiaryId
    );

    if (config.costingMethod === 'FIFO' || config.costingMethod === 'LIFO') {
      await this.costingService.consumeFromLayers(
        line.itemId,
        transfer.fromSubsidiaryId,
        quantity,
        config.costingMethod
      );
    }

    // Record cost history
    await this.costingService.recordCostHistory({
      organizationId: this.context.organizationId,
      subsidiaryId: transfer.fromSubsidiaryId,
      itemId: line.itemId,
      changeType: 'TRANSFER_OUT',
      previousCost: line.unitCost,
      newCost: line.unitCost,
      affectedTransactionId: transfer.id,
      affectedTransactionType: 'TRANSFER',
      quantityAffected: String(-quantity),
      totalValueChange: String(-quantity * Number(line.unitCost)),
      changeReason: `Transfer out: ${transfer.transferNumber}`,
      createdBy: this.context.userId,
    });
  }

  /**
   * Add items to destination inventory
   */
  private async addToDestinationInventory(
    transfer: InventoryTransferRecord,
    line: InventoryTransferLineRecord,
    quantity: number
  ): Promise<void> {
    // Get cost - for intercompany, may use transfer price
    const unitCost = transfer.isIntercompany
      ? Number(line.transferUnitPrice || line.unitCost)
      : Number(line.unitCost);

    // Create new cost layer at destination
    const [newLayer] = await this.db
      .insert(itemCostLayers)
      .values({
        organizationId: this.context.organizationId,
        subsidiaryId: transfer.toSubsidiaryId,
        itemId: line.itemId,
        layerNumber: `TRF-${transfer.transferNumber}-${line.id}`,
        receiptDate: new Date(),
        sourceTransactionId: transfer.id,
        sourceTransactionType: 'TRANSFER',
        sourceDocumentNumber: transfer.transferNumber,
        quantityReceived: String(quantity),
        quantityRemaining: String(quantity),
        unitCost: String(unitCost),
        totalCost: String(quantity * unitCost),
      })
      .returning();

    // Update line with new cost layer reference
    await this.db
      .update(inventoryTransferLines)
      .set({ newCostLayerId: newLayer.id })
      .where(eq(inventoryTransferLines.id, line.id));

    // Record cost history
    await this.costingService.recordCostHistory({
      organizationId: this.context.organizationId,
      subsidiaryId: transfer.toSubsidiaryId,
      itemId: line.itemId,
      changeType: 'TRANSFER_IN',
      previousCost: String(0),
      newCost: String(unitCost),
      affectedTransactionId: transfer.id,
      affectedTransactionType: 'TRANSFER',
      costLayerId: newLayer.id,
      quantityAffected: String(quantity),
      totalValueChange: String(quantity * unitCost),
      changeReason: `Transfer in: ${transfer.transferNumber}`,
      createdBy: this.context.userId,
    });
  }

  /**
   * Reverse shipment for cancelled transfer
   */
  private async reverseShipment(
    transfer: InventoryTransferRecord,
    line: InventoryTransferLineRecord
  ): Promise<void> {
    const shippedQty = Number(line.quantityShipped || 0);
    if (shippedQty <= 0) return;

    // Create a layer to restore the items
    await this.costingService.createCostLayer({
      subsidiaryId: transfer.fromSubsidiaryId,
      itemId: line.itemId,
      layerNumber: `TRF-REV-${transfer.transferNumber}-${line.id}`,
      receiptDate: new Date(),
      sourceTransactionId: transfer.id,
      sourceTransactionType: 'TRANSFER_REVERSAL',
      sourceDocumentNumber: transfer.transferNumber,
      quantityReceived: String(shippedQty),
      quantityRemaining: String(shippedQty),
      unitCost: line.unitCost ?? '0',
      totalCost: String(shippedQty * Number(line.unitCost || 0)),
    });
  }

  /**
   * Transition status with validation
   */
  private async transitionStatus(
    id: string,
    newStatus: TransferStatusValue,
    action: string,
    comments?: string
  ): Promise<TransferWithLines> {
    const transfer = await this.getTransfer(id);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (!VALID_TRANSITIONS[transfer.status].includes(newStatus)) {
      throw new Error(`Cannot transition from ${transfer.status} to ${newStatus}`);
    }

    const updateData: Partial<InsertInventoryTransfer> = {
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
      .update(inventoryTransfers)
      .set(updateData)
      .where(eq(inventoryTransfers.id, id))
      .returning();

    await this.recordApprovalHistory(id, action, transfer.status, newStatus, comments);

    return { ...updated, lines: transfer.lines };
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
      documentType: 'TRANSFER',
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
