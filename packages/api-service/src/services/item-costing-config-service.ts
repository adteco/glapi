/**
 * Item Costing Configuration Service
 *
 * Manages inventory costing configuration at multiple levels:
 * - Organization defaults
 * - Subsidiary overrides
 * - Item-specific costing methods
 *
 * Supports FIFO, LIFO, AVERAGE, WEIGHTED_AVERAGE, and STANDARD costing methods.
 */

import { eq, and, desc, asc, isNull, or, sql } from 'drizzle-orm';
import {
  organizationCostingDefaults,
  subsidiaryCostingConfig,
  itemCostingMethods,
  itemCostLayers,
  itemCostHistory,
  type OrganizationCostingDefaultsRecord,
  type InsertOrganizationCostingDefaults,
  type SubsidiaryCostingConfigRecord,
  type InsertSubsidiaryCostingConfig,
  type ItemCostingMethodRecord,
  type InsertItemCostingMethod,
  type ItemCostLayerRecord,
  type InsertItemCostLayer,
  type ItemCostHistoryRecord,
  type InsertItemCostHistory,
  type CostingMethodValue,
} from '@glapi/database';
import { getDb } from '@glapi/database';
import { DatabaseType } from '@glapi/database';

// Service context for multi-tenant operations
export interface CostingServiceContext {
  organizationId: string;
  userId?: string;
}

// Effective costing configuration (after applying hierarchy)
export interface EffectiveCostingConfig {
  costingMethod: CostingMethodValue;
  allowStandardCostRevaluation: boolean;
  revaluationAccountId?: string;
  priceVarianceThresholdPercent: number;
  quantityVarianceThresholdPercent: number;
  standardCost?: number;
  trackCostLayers: boolean;
  autoRecalculateOnReceipt: boolean;
  source: 'organization' | 'subsidiary' | 'item';
}

// Cost calculation result
export interface CostCalculationResult {
  unitCost: number;
  totalCost: number;
  costingMethod: CostingMethodValue;
  costLayerId?: string;
  varianceAmount?: number;
}

export class ItemCostingConfigService {
  private db: DatabaseType;
  private context: CostingServiceContext;

  constructor(context: CostingServiceContext) {
    this.db = getDb();
    this.context = context;
  }

  // ========================================
  // Organization Costing Defaults
  // ========================================

  /**
   * Get organization costing defaults
   */
  async getOrganizationDefaults(): Promise<OrganizationCostingDefaultsRecord | null> {
    const [result] = await this.db
      .select()
      .from(organizationCostingDefaults)
      .where(eq(organizationCostingDefaults.organizationId, this.context.organizationId));

    return result || null;
  }

  /**
   * Create or update organization costing defaults
   */
  async upsertOrganizationDefaults(
    data: Omit<InsertOrganizationCostingDefaults, 'organizationId' | 'createdBy' | 'updatedBy'>
  ): Promise<OrganizationCostingDefaultsRecord> {
    const existing = await this.getOrganizationDefaults();

    if (existing) {
      const [updated] = await this.db
        .update(organizationCostingDefaults)
        .set({
          ...data,
          updatedAt: new Date(),
          updatedBy: this.context.userId,
        })
        .where(eq(organizationCostingDefaults.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(organizationCostingDefaults)
      .values({
        ...data,
        organizationId: this.context.organizationId,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    return created;
  }

  // ========================================
  // Subsidiary Costing Configuration
  // ========================================

  /**
   * Get costing config for a specific subsidiary
   */
  async getSubsidiaryConfig(subsidiaryId: string): Promise<SubsidiaryCostingConfigRecord | null> {
    const [result] = await this.db
      .select()
      .from(subsidiaryCostingConfig)
      .where(
        and(
          eq(subsidiaryCostingConfig.organizationId, this.context.organizationId),
          eq(subsidiaryCostingConfig.subsidiaryId, subsidiaryId),
          eq(subsidiaryCostingConfig.isActive, true)
        )
      );

    return result || null;
  }

  /**
   * List all subsidiary costing configurations
   */
  async listSubsidiaryConfigs(): Promise<SubsidiaryCostingConfigRecord[]> {
    return this.db
      .select()
      .from(subsidiaryCostingConfig)
      .where(eq(subsidiaryCostingConfig.organizationId, this.context.organizationId))
      .orderBy(asc(subsidiaryCostingConfig.subsidiaryId));
  }

  /**
   * Create subsidiary costing configuration
   */
  async createSubsidiaryConfig(
    data: Omit<InsertSubsidiaryCostingConfig, 'organizationId' | 'createdBy' | 'updatedBy'>
  ): Promise<SubsidiaryCostingConfigRecord> {
    const [created] = await this.db
      .insert(subsidiaryCostingConfig)
      .values({
        ...data,
        organizationId: this.context.organizationId,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    return created;
  }

  /**
   * Update subsidiary costing configuration
   */
  async updateSubsidiaryConfig(
    subsidiaryId: string,
    data: Partial<InsertSubsidiaryCostingConfig>
  ): Promise<SubsidiaryCostingConfigRecord | null> {
    const [updated] = await this.db
      .update(subsidiaryCostingConfig)
      .set({
        ...data,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(
        and(
          eq(subsidiaryCostingConfig.organizationId, this.context.organizationId),
          eq(subsidiaryCostingConfig.subsidiaryId, subsidiaryId)
        )
      )
      .returning();

    return updated || null;
  }

  // ========================================
  // Item Costing Methods
  // ========================================

  /**
   * Get costing method for a specific item in a subsidiary
   */
  async getItemCostingMethod(
    itemId: string,
    subsidiaryId: string
  ): Promise<ItemCostingMethodRecord | null> {
    const [result] = await this.db
      .select()
      .from(itemCostingMethods)
      .where(
        and(
          eq(itemCostingMethods.organizationId, this.context.organizationId),
          eq(itemCostingMethods.itemId, itemId),
          eq(itemCostingMethods.subsidiaryId, subsidiaryId),
          eq(itemCostingMethods.isActive, true)
        )
      );

    return result || null;
  }

  /**
   * List item costing methods for a subsidiary
   */
  async listItemCostingMethods(subsidiaryId: string): Promise<ItemCostingMethodRecord[]> {
    return this.db
      .select()
      .from(itemCostingMethods)
      .where(
        and(
          eq(itemCostingMethods.organizationId, this.context.organizationId),
          eq(itemCostingMethods.subsidiaryId, subsidiaryId)
        )
      )
      .orderBy(asc(itemCostingMethods.itemId));
  }

  /**
   * Create item costing method
   */
  async createItemCostingMethod(
    data: Omit<InsertItemCostingMethod, 'organizationId' | 'createdBy' | 'updatedBy'>
  ): Promise<ItemCostingMethodRecord> {
    const [created] = await this.db
      .insert(itemCostingMethods)
      .values({
        ...data,
        organizationId: this.context.organizationId,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    return created;
  }

  /**
   * Update item costing method
   */
  async updateItemCostingMethod(
    itemId: string,
    subsidiaryId: string,
    data: Partial<InsertItemCostingMethod>
  ): Promise<ItemCostingMethodRecord | null> {
    const [updated] = await this.db
      .update(itemCostingMethods)
      .set({
        ...data,
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(
        and(
          eq(itemCostingMethods.organizationId, this.context.organizationId),
          eq(itemCostingMethods.itemId, itemId),
          eq(itemCostingMethods.subsidiaryId, subsidiaryId)
        )
      )
      .returning();

    return updated || null;
  }

  /**
   * Update standard cost for an item
   */
  async updateStandardCost(
    itemId: string,
    subsidiaryId: string,
    newStandardCost: number,
    reason?: string
  ): Promise<ItemCostingMethodRecord | null> {
    const existing = await this.getItemCostingMethod(itemId, subsidiaryId);

    if (!existing || existing.costingMethod !== 'STANDARD') {
      return null;
    }

    const previousCost = existing.standardCost ? Number(existing.standardCost) : 0;

    // Update the item costing method
    const [updated] = await this.db
      .update(itemCostingMethods)
      .set({
        previousStandardCost: existing.standardCost,
        standardCost: String(newStandardCost),
        standardCostEffectiveDate: new Date(),
        updatedAt: new Date(),
        updatedBy: this.context.userId,
      })
      .where(eq(itemCostingMethods.id, existing.id))
      .returning();

    // Record in cost history
    await this.recordCostHistory({
      organizationId: this.context.organizationId,
      subsidiaryId,
      itemId,
      changeType: 'STANDARD_COST_UPDATE',
      costingMethod: 'STANDARD',
      previousCost: String(previousCost),
      newCost: String(newStandardCost),
      varianceAmount: String(newStandardCost - previousCost),
      changeReason: reason,
      createdBy: this.context.userId,
    });

    return updated || null;
  }

  // ========================================
  // Effective Configuration (Hierarchy Resolution)
  // ========================================

  /**
   * Get effective costing configuration for an item in a subsidiary
   * Applies hierarchy: item -> subsidiary -> organization
   */
  async getEffectiveConfig(
    itemId: string,
    subsidiaryId: string
  ): Promise<EffectiveCostingConfig> {
    // Check item-level config first
    const itemConfig = await this.getItemCostingMethod(itemId, subsidiaryId);
    if (itemConfig) {
      return {
        costingMethod: itemConfig.costingMethod,
        allowStandardCostRevaluation: itemConfig.allowStandardCostRevaluation ?? false,
        revaluationAccountId: itemConfig.revaluationAccountId ?? undefined,
        priceVarianceThresholdPercent: Number(itemConfig.priceVarianceThresholdPercent ?? 5),
        quantityVarianceThresholdPercent: Number(itemConfig.quantityVarianceThresholdPercent ?? 5),
        standardCost: itemConfig.standardCost ? Number(itemConfig.standardCost) : undefined,
        trackCostLayers: itemConfig.costingMethod === 'FIFO' || itemConfig.costingMethod === 'LIFO',
        autoRecalculateOnReceipt: true,
        source: 'item',
      };
    }

    // Check subsidiary-level config
    const subsidiaryConfig = await this.getSubsidiaryConfig(subsidiaryId);
    if (subsidiaryConfig) {
      return {
        costingMethod: subsidiaryConfig.costingMethod,
        allowStandardCostRevaluation: subsidiaryConfig.allowStandardCostRevaluation ?? false,
        revaluationAccountId: subsidiaryConfig.revaluationAccountId ?? undefined,
        priceVarianceThresholdPercent: Number(subsidiaryConfig.priceVarianceThresholdPercent ?? 5),
        quantityVarianceThresholdPercent: Number(subsidiaryConfig.quantityVarianceThresholdPercent ?? 5),
        trackCostLayers: subsidiaryConfig.costingMethod === 'FIFO' || subsidiaryConfig.costingMethod === 'LIFO',
        autoRecalculateOnReceipt: true,
        source: 'subsidiary',
      };
    }

    // Fall back to organization defaults
    const orgDefaults = await this.getOrganizationDefaults();
    if (orgDefaults) {
      return {
        costingMethod: orgDefaults.defaultCostingMethod,
        allowStandardCostRevaluation: orgDefaults.allowStandardCostRevaluation ?? false,
        revaluationAccountId: orgDefaults.defaultRevaluationAccountId ?? undefined,
        priceVarianceThresholdPercent: Number(orgDefaults.priceVarianceThresholdPercent ?? 5),
        quantityVarianceThresholdPercent: Number(orgDefaults.quantityVarianceThresholdPercent ?? 5),
        trackCostLayers: orgDefaults.trackCostLayers ?? true,
        autoRecalculateOnReceipt: orgDefaults.autoRecalculateOnReceipt ?? true,
        source: 'organization',
      };
    }

    // Ultimate fallback - AVERAGE costing
    return {
      costingMethod: 'AVERAGE',
      allowStandardCostRevaluation: false,
      priceVarianceThresholdPercent: 5,
      quantityVarianceThresholdPercent: 5,
      trackCostLayers: false,
      autoRecalculateOnReceipt: true,
      source: 'organization',
    };
  }

  // ========================================
  // Cost Layers (FIFO/LIFO)
  // ========================================

  /**
   * Create a new cost layer (for receipt transactions)
   */
  async createCostLayer(
    data: Omit<InsertItemCostLayer, 'organizationId' | 'createdBy' | 'updatedBy'>
  ): Promise<ItemCostLayerRecord> {
    const [created] = await this.db
      .insert(itemCostLayers)
      .values({
        ...data,
        organizationId: this.context.organizationId,
        createdBy: this.context.userId,
        updatedBy: this.context.userId,
      })
      .returning();

    return created;
  }

  /**
   * Get available cost layers for an item (for FIFO/LIFO consumption)
   */
  async getAvailableCostLayers(
    itemId: string,
    subsidiaryId: string,
    method: 'FIFO' | 'LIFO'
  ): Promise<ItemCostLayerRecord[]> {
    const orderDirection = method === 'FIFO' ? asc : desc;

    return this.db
      .select()
      .from(itemCostLayers)
      .where(
        and(
          eq(itemCostLayers.organizationId, this.context.organizationId),
          eq(itemCostLayers.itemId, itemId),
          eq(itemCostLayers.subsidiaryId, subsidiaryId),
          eq(itemCostLayers.isFullyDepleted, false)
        )
      )
      .orderBy(orderDirection(itemCostLayers.receiptDate));
  }

  /**
   * Consume from cost layers (FIFO/LIFO)
   * Returns the cost calculation for the consumed quantity
   */
  async consumeFromLayers(
    itemId: string,
    subsidiaryId: string,
    quantity: number,
    method: 'FIFO' | 'LIFO'
  ): Promise<CostCalculationResult> {
    const layers = await this.getAvailableCostLayers(itemId, subsidiaryId, method);

    let remainingQty = quantity;
    let totalCost = 0;
    const consumedLayers: { layerId: string; quantity: number; cost: number }[] = [];

    for (const layer of layers) {
      if (remainingQty <= 0) break;

      const available = Number(layer.quantityRemaining);
      const consumeQty = Math.min(available, remainingQty);
      const unitCost = Number(layer.unitCost);
      const lineCost = consumeQty * unitCost;

      totalCost += lineCost;
      remainingQty -= consumeQty;
      consumedLayers.push({ layerId: layer.id, quantity: consumeQty, cost: lineCost });

      // Update layer
      const newRemaining = available - consumeQty;
      const isFullyDepleted = newRemaining <= 0;

      await this.db
        .update(itemCostLayers)
        .set({
          quantityRemaining: String(newRemaining),
          isFullyDepleted,
          depletedAt: isFullyDepleted ? new Date() : null,
          updatedAt: new Date(),
          updatedBy: this.context.userId,
        })
        .where(eq(itemCostLayers.id, layer.id));
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient cost layers for item ${itemId}: needed ${quantity}, available ${quantity - remainingQty}`);
    }

    return {
      unitCost: totalCost / quantity,
      totalCost,
      costingMethod: method,
      costLayerId: consumedLayers.length === 1 ? consumedLayers[0].layerId : undefined,
    };
  }

  /**
   * Get current average cost for an item
   */
  async getAverageCost(itemId: string, subsidiaryId: string): Promise<number> {
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

    if (layers.length === 0) {
      return 0;
    }

    let totalQty = 0;
    let totalValue = 0;

    for (const layer of layers) {
      const qty = Number(layer.quantityRemaining);
      const cost = Number(layer.unitCost);
      totalQty += qty;
      totalValue += qty * cost;
    }

    return totalQty > 0 ? totalValue / totalQty : 0;
  }

  // ========================================
  // Cost History
  // ========================================

  /**
   * Record a cost change in history
   */
  async recordCostHistory(
    data: Omit<InsertItemCostHistory, 'id' | 'createdAt'>
  ): Promise<ItemCostHistoryRecord> {
    const [created] = await this.db
      .insert(itemCostHistory)
      .values(data)
      .returning();

    return created;
  }

  /**
   * Get cost history for an item
   */
  async getItemCostHistory(
    itemId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ItemCostHistoryRecord[]> {
    const query = this.db
      .select()
      .from(itemCostHistory)
      .where(
        and(
          eq(itemCostHistory.organizationId, this.context.organizationId),
          eq(itemCostHistory.itemId, itemId)
        )
      )
      .orderBy(desc(itemCostHistory.createdAt));

    if (options?.limit) {
      query.limit(options.limit);
    }
    if (options?.offset) {
      query.offset(options.offset);
    }

    return query;
  }

  // ========================================
  // Cost Calculation
  // ========================================

  /**
   * Calculate cost for an item based on its costing method
   */
  async calculateCost(
    itemId: string,
    subsidiaryId: string,
    quantity: number,
    transactionType: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT',
    receiptCost?: number
  ): Promise<CostCalculationResult> {
    const config = await this.getEffectiveConfig(itemId, subsidiaryId);

    switch (config.costingMethod) {
      case 'FIFO':
        if (transactionType === 'ISSUE') {
          return this.consumeFromLayers(itemId, subsidiaryId, quantity, 'FIFO');
        }
        // For receipts, return the receipt cost
        return {
          unitCost: receiptCost ?? 0,
          totalCost: (receiptCost ?? 0) * quantity,
          costingMethod: 'FIFO',
        };

      case 'LIFO':
        if (transactionType === 'ISSUE') {
          return this.consumeFromLayers(itemId, subsidiaryId, quantity, 'LIFO');
        }
        // For receipts, return the receipt cost
        return {
          unitCost: receiptCost ?? 0,
          totalCost: (receiptCost ?? 0) * quantity,
          costingMethod: 'LIFO',
        };

      case 'AVERAGE':
      case 'WEIGHTED_AVERAGE': {
        const avgCost = await this.getAverageCost(itemId, subsidiaryId);
        // For receipts, the average will be recalculated after adding the layer
        const unitCost = transactionType === 'RECEIPT' ? receiptCost ?? avgCost : avgCost;
        return {
          unitCost,
          totalCost: unitCost * quantity,
          costingMethod: config.costingMethod,
        };
      }

      case 'STANDARD': {
        if (!config.standardCost) {
          throw new Error(`Standard cost not defined for item ${itemId} in subsidiary ${subsidiaryId}`);
        }
        const varianceAmount = receiptCost && transactionType === 'RECEIPT'
          ? (receiptCost - config.standardCost) * quantity
          : undefined;

        return {
          unitCost: config.standardCost,
          totalCost: config.standardCost * quantity,
          costingMethod: 'STANDARD',
          varianceAmount,
        };
      }

      default:
        throw new Error(`Unknown costing method: ${config.costingMethod}`);
    }
  }
}
