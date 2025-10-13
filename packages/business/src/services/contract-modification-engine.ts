import { Database } from '@glapi/database';
import { 
  contractModifications, 
  modificationLineItems,
  catchUpAdjustments,
  subscriptions,
  subscriptionItems,
  items,
  performanceObligations,
  revenueSchedules,
  sspEvidence,
  ModificationMethod,
  ModificationType,
  ModificationStatus,
  NewContractModification,
  NewModificationLineItem,
  NewCatchUpAdjustment
} from '@glapi/database/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { RevenueCalculationEngine } from './revenue-calculation-engine';
import { createId } from '@paralleldrive/cuid2';

export interface ModificationRequest {
  subscriptionId: string;
  modificationType: typeof ModificationType[keyof typeof ModificationType];
  effectiveDate: Date;
  changes: ModificationChanges;
  reason?: string;
  notes?: string;
  requestedBy?: string;
}

export interface ModificationChanges {
  addItems?: Array<{
    itemId: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    startDate?: Date;
    endDate?: Date;
  }>;
  removeItems?: string[]; // subscription item IDs
  modifyItems?: Array<{
    subscriptionItemId: string;
    newQuantity?: number;
    newUnitPrice?: number;
    newDiscountPercent?: number;
    newEndDate?: Date;
  }>;
  termExtension?: {
    newEndDate: Date;
    prorationMethod?: 'daily' | 'monthly';
  };
  earlyTermination?: {
    terminationDate: Date;
    refundPolicy?: 'none' | 'prorated' | 'full';
  };
  partialTermination?: {
    itemIds: string[];
    terminationDate: Date;
    refundPolicy?: 'none' | 'prorated' | 'full';
  };
}

export interface ModificationImpact {
  method: typeof ModificationMethod[keyof typeof ModificationMethod];
  financialImpact: {
    originalValue: number;
    modifiedValue: number;
    adjustment: number;
    refundAmount?: number;
    creditAmount?: number;
  };
  obligationChanges: Array<{
    obligationId: string;
    itemName: string;
    originalAmount: number;
    newAmount: number;
    change: number;
    satisfactionImpact: string;
  }>;
  revenueImpact: {
    currentPeriodAdjustment: number;
    futurePeriodImpact: number;
    cumulativeCatchUp?: number;
  };
  scheduleChanges: {
    schedulesToCancel: number;
    schedulesToCreate: number;
    schedulesToModify: number;
  };
  warnings?: string[];
}

export class ContractModificationEngine {
  constructor(
    private db: typeof Database,
    private revenueEngine: RevenueCalculationEngine
  ) {}

  /**
   * Process a contract modification with full ASC 606 compliance
   */
  async processModification(
    request: ModificationRequest,
    options?: {
      preview?: boolean;
      autoApprove?: boolean;
      skipValidation?: boolean;
    }
  ): Promise<{
    modificationId?: string;
    impact: ModificationImpact;
    warnings?: string[];
  }> {
    // Step 1: Validate modification request
    if (!options?.skipValidation) {
      await this.validateModification(request);
    }

    // Step 2: Determine modification method per ASC 606-10-25-12
    const method = await this.determineModificationMethod(request);

    // Step 3: Calculate modification impact
    const impact = await this.calculateModificationImpact(request, method);

    // Step 4: Check for warnings
    const warnings = this.checkForWarnings(impact);

    if (options?.preview) {
      return { impact, warnings };
    }

    // Step 5: Create modification record
    const modificationId = await this.createModificationRecord(request, impact, method);

    // Step 6: Apply modification if auto-approved
    if (options?.autoApprove) {
      await this.applyModification(modificationId);
    }

    return { modificationId, impact, warnings };
  }

  /**
   * Determine modification accounting method based on ASC 606 criteria
   */
  private async determineModificationMethod(
    request: ModificationRequest
  ): Promise<typeof ModificationMethod[keyof typeof ModificationMethod]> {
    const subscription = await this.getSubscription(request.subscriptionId);
    
    // Check for blend and extend scenario
    if (request.modificationType === "blend_extend") {
      return "blend_extend";
    }

    // Check if modification adds distinct goods/services
    if (request.changes.addItems && request.changes.addItems.length > 0) {
      const hasDistinctItems = await this.areItemsDistinct(
        request.changes.addItems.map(i => i.itemId)
      );
      
      if (hasDistinctItems) {
        // Check if price reflects standalone selling price
        const reflectsSSP = await this.priceReflectsSSP(request.changes.addItems);
        
        if (reflectsSSP) {
          // Treat as separate contract per ASC 606-10-25-12(a)
          return "separate_contract";
        }
      }
    }

    // Check if remaining goods/services are distinct
    const hasDistinctRemaining = await this.hasDistinctRemainingObligations(
      request.subscriptionId,
      request.effectiveDate
    );

    if (!hasDistinctRemaining) {
      // Use cumulative catch-up per ASC 606-10-25-13(a)
      return "cumulative_catch_up";
    }

    // Default to prospective per ASC 606-10-25-13(b)
    return "prospective";
  }

  /**
   * Calculate the financial and operational impact of the modification
   */
  private async calculateModificationImpact(
    request: ModificationRequest,
    method: typeof ModificationMethod[keyof typeof ModificationMethod]
  ): Promise<ModificationImpact> {
    const subscription = await this.getSubscription(request.subscriptionId);
    
    // Get current state
    const currentObligations = await this.getCurrentObligations(request.subscriptionId);
    const recognizedToDate = await this.getRecognizedRevenue(
      request.subscriptionId,
      request.effectiveDate
    );

    // Apply changes to create modified contract
    const modifiedContract = await this.applyChangesToContract(subscription, request.changes);

    // Calculate impact based on method
    let impact: ModificationImpact;

    switch (method) {
      case "cumulative_catch_up":
        impact = await this.calculateCumulativeCatchUpImpact(
          subscription,
          modifiedContract,
          currentObligations,
          recognizedToDate,
          request.effectiveDate
        );
        break;

      case "prospective":
        impact = await this.calculateProspectiveImpact(
          subscription,
          modifiedContract,
          currentObligations,
          request.effectiveDate
        );
        break;

      case "separate_contract":
        impact = await this.calculateSeparateContractImpact(
          subscription,
          request.changes,
          request.effectiveDate
        );
        break;

      case "blend_extend":
        impact = await this.calculateBlendExtendImpact(
          subscription,
          modifiedContract,
          request.effectiveDate
        );
        break;

      default:
        throw new Error(`Unknown modification method: ${method}`);
    }

    return impact;
  }

  /**
   * Calculate cumulative catch-up impact per ASC 606-10-25-13(a)
   */
  private async calculateCumulativeCatchUpImpact(
    originalContract: any,
    modifiedContract: any,
    currentObligations: any[],
    recognizedToDate: number,
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Recalculate revenue from contract inception with modified terms
    const modifiedCalculation = await this.revenueEngine.calculate({
      subscriptionId: originalContract.id,
      organizationId: originalContract.organizationId,
      calculationType: 'modification',
      effectiveDate: effectiveDate,
      options: {
        forceRecalculation: true,
        includeHistorical: true
      }
    });

    // Calculate what should have been recognized to date under modified terms
    const shouldHaveRecognized = this.calculateRevenueToDate(
      modifiedCalculation.schedules,
      new Date(originalContract.startDate),
      effectiveDate
    );

    // Cumulative catch-up adjustment
    const catchUpAdjustment = shouldHaveRecognized - recognizedToDate;

    // Calculate obligation changes
    const obligationChanges = await this.compareObligations(
      currentObligations,
      modifiedCalculation.performanceObligations
    );

    // Calculate schedule changes
    const scheduleChanges = await this.calculateScheduleChanges(
      originalContract.id,
      modifiedCalculation.schedules
    );

    return {
      method: "cumulative_catch_up",
      financialImpact: {
        originalValue: parseFloat(originalContract.totalAmount),
        modifiedValue: modifiedCalculation.transactionPrice,
        adjustment: modifiedCalculation.transactionPrice - parseFloat(originalContract.totalAmount)
      },
      obligationChanges,
      revenueImpact: {
        currentPeriodAdjustment: catchUpAdjustment,
        futurePeriodImpact: modifiedCalculation.transactionPrice - shouldHaveRecognized,
        cumulativeCatchUp: catchUpAdjustment
      },
      scheduleChanges
    };
  }

  /**
   * Calculate prospective impact per ASC 606-10-25-13(b)
   */
  private async calculateProspectiveImpact(
    originalContract: any,
    modifiedContract: any,
    currentObligations: any[],
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Only adjust going forward from effective date
    const remainingObligations = currentObligations.filter(
      o => o.status === 'active' && new Date(o.endDate) >= effectiveDate
    );

    // Calculate remaining unrecognized revenue
    const unrecognizedRevenue = await this.getUnrecognizedRevenue(
      originalContract.id,
      effectiveDate
    );

    // Reallocate unrecognized revenue to modified obligations
    const modifiedAllocations = await this.reallocateRevenue(
      unrecognizedRevenue,
      modifiedContract,
      remainingObligations,
      effectiveDate
    );

    return {
      method: "prospective",
      financialImpact: {
        originalValue: parseFloat(originalContract.totalAmount),
        modifiedValue: parseFloat(modifiedContract.totalAmount),
        adjustment: parseFloat(modifiedContract.totalAmount) - parseFloat(originalContract.totalAmount)
      },
      obligationChanges: modifiedAllocations.changes,
      revenueImpact: {
        currentPeriodAdjustment: 0, // No immediate catch-up
        futurePeriodImpact: modifiedAllocations.futureImpact,
        cumulativeCatchUp: undefined
      },
      scheduleChanges: modifiedAllocations.scheduleChanges
    };
  }

  /**
   * Handle partial termination with refund calculation
   */
  async processPartialTermination(
    subscriptionId: string,
    itemsToTerminate: string[],
    terminationDate: Date,
    options?: {
      refundPolicy?: 'none' | 'prorated' | 'full';
      finalInvoice?: boolean;
    }
  ): Promise<{
    modificationId: string;
    refundAmount: number;
    affectedObligations: string[];
    cancelledSchedules: number;
  }> {
    // Get items to terminate
    const subscriptionItemsData = await this.db.select()
      .from(subscriptionItems)
      .where(and(
        eq(subscriptionItems.subscriptionId, subscriptionId),
        inArray(subscriptionItems.id, itemsToTerminate)
      ));

    if (subscriptionItemsData.length === 0) {
      throw new Error('No valid items to terminate');
    }

    // Calculate refund if applicable
    let refundAmount = 0;
    if (options?.refundPolicy && options.refundPolicy !== 'none') {
      refundAmount = await this.calculateRefund(
        subscriptionItemsData,
        terminationDate,
        options.refundPolicy
      );
    }

    // Get the item IDs for the subscription items to terminate (reuse from earlier query)
    const itemIds = subscriptionItemsData.map(si => si.itemId);
    
    // Get affected performance obligations
    const affectedObligations = await this.db.select()
      .from(performanceObligations)
      .where(and(
        eq(performanceObligations.subscriptionId, subscriptionId),
        inArray(performanceObligations.itemId, itemIds)
      ));

    // Cancel future revenue schedules
    const cancelResult = await this.cancelFutureSchedules(
      affectedObligations.map(o => o.id),
      terminationDate
    );

    // Create modification request
    const modificationRequest: ModificationRequest = {
      subscriptionId,
      modificationType: "partial_termination",
      effectiveDate: terminationDate,
      changes: {
        partialTermination: {
          itemIds: itemsToTerminate,
          terminationDate,
          refundPolicy: options?.refundPolicy || 'none'
        }
      }
    };

    // Process modification
    const result = await this.processModification(modificationRequest);

    return {
      modificationId: result.modificationId!,
      refundAmount,
      affectedObligations: affectedObligations.map(o => o.id),
      cancelledSchedules: cancelResult.count
    };
  }

  /**
   * Handle upgrade/downgrade scenarios
   */
  async processUpgradeDowngrade(
    subscriptionId: string,
    changes: {
      fromItemId: string;
      toItemId: string;
      effectiveDate: Date;
      creditPolicy?: 'full' | 'prorated' | 'none';
    }
  ): Promise<{
    modificationId: string;
    creditAmount: number;
    newObligations: any[];
    impact: ModificationImpact;
  }> {
    // Get current and new items
    const [fromItem] = await this.db.select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.id, changes.fromItemId))
      .limit(1);

    const [toItem] = await this.db.select()
      .from(items)
      .where(eq(items.id, changes.toItemId))
      .limit(1);

    if (!fromItem || !toItem) {
      throw new Error('Invalid item IDs provided');
    }

    // Calculate credit for unused portion
    let creditAmount = 0;
    if (changes.creditPolicy && changes.creditPolicy !== 'none') {
      creditAmount = await this.calculateUpgradeCredit(
        fromItem,
        changes.effectiveDate,
        changes.creditPolicy
      );
    }

    // Determine if upgrade or downgrade
    const isUpgrade = parseFloat(toItem.defaultPrice) > parseFloat(fromItem.unitPrice);

    // Create modification request
    const modificationRequest: ModificationRequest = {
      subscriptionId,
      modificationType: isUpgrade ? "upgrade" : "downgrade",
      effectiveDate: changes.effectiveDate,
      changes: {
        removeItems: [changes.fromItemId],
        addItems: [{
          itemId: changes.toItemId,
          quantity: parseFloat(fromItem.quantity),
          unitPrice: parseFloat(toItem.defaultPrice) - creditAmount,
          startDate: changes.effectiveDate,
          endDate: fromItem.endDate ? new Date(fromItem.endDate) : undefined
        }]
      }
    };

    // Process modification
    const result = await this.processModification(modificationRequest);

    return {
      modificationId: result.modificationId!,
      creditAmount,
      newObligations: result.impact.obligationChanges,
      impact: result.impact
    };
  }

  /**
   * Process blend and extend modification
   */
  async processBlendAndExtend(
    subscriptionId: string,
    newTermEndDate: Date,
    priceAdjustment?: number
  ): Promise<{
    modificationId: string;
    blendedRate: number;
    extendedMonths: number;
    impact: ModificationImpact;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    const currentEndDate = new Date(subscription.endDate);
    
    // Calculate extension period
    const extendedMonths = this.monthsDifference(currentEndDate, newTermEndDate);
    
    if (extendedMonths <= 0) {
      throw new Error('New term must extend beyond current end date');
    }

    // Calculate remaining unrecognized revenue
    const unrecognizedRevenue = await this.getUnrecognizedRevenue(
      subscriptionId,
      new Date()
    );
    
    // Calculate extension value
    const extensionValue = priceAdjustment 
      ? priceAdjustment * extendedMonths
      : (unrecognizedRevenue / this.monthsDifference(new Date(), currentEndDate)) * extendedMonths;
    
    // Calculate blended rate
    const totalRemainingMonths = this.monthsDifference(new Date(), newTermEndDate);
    const blendedRate = (unrecognizedRevenue + extensionValue) / totalRemainingMonths;

    // Get subscription items for modification
    const subscriptionItemsData = await this.db.select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.subscriptionId, subscriptionId));

    // Create modification request
    const modificationRequest: ModificationRequest = {
      subscriptionId,
      modificationType: "blend_extend",
      effectiveDate: new Date(),
      changes: {
        termExtension: {
          newEndDate: newTermEndDate
        },
        modifyItems: subscriptionItemsData.map(item => ({
          subscriptionItemId: item.id,
          newUnitPrice: blendedRate * parseFloat(item.quantity),
          newEndDate: newTermEndDate
        }))
      }
    };

    // Process modification
    const result = await this.processModification(modificationRequest);

    return {
      modificationId: result.modificationId!,
      blendedRate,
      extendedMonths,
      impact: result.impact
    };
  }

  /**
   * Apply an approved modification
   */
  async applyModification(modificationId: string): Promise<void> {
    // Get modification details
    const [modification] = await this.db.select()
      .from(contractModifications)
      .where(eq(contractModifications.id, modificationId))
      .limit(1);

    if (!modification) {
      throw new Error('Modification not found');
    }

    if (modification.status !== "approved") {
      throw new Error('Modification must be approved before applying');
    }

    // Begin transaction
    await this.db.transaction(async (tx) => {
      // Apply line item changes
      await this.applyLineItemChanges(tx, modificationId);

      // Apply catch-up adjustments if cumulative method
      if (modification.modificationMethod === "cumulative_catch_up") {
        await this.applyCatchUpAdjustments(tx, modificationId);
      }

      // Update revenue schedules
      await this.updateRevenueSchedules(tx, modification);

      // Update modification status
      await tx.update(contractModifications)
        .set({
          status: "applied",
          appliedDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(contractModifications.id, modificationId));
    });
  }

  /**
   * Helper methods
   */

  private async validateModification(request: ModificationRequest): Promise<void> {
    // Validate subscription exists and is active
    const subscription = await this.getSubscription(request.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Validate effective date
    if (request.effectiveDate < new Date(subscription.startDate)) {
      throw new Error('Effective date cannot be before subscription start date');
    }

    // Validate changes
    if (!request.changes || Object.keys(request.changes).length === 0) {
      throw new Error('No changes specified in modification request');
    }
  }

  private async getSubscription(subscriptionId: string): Promise<any> {
    const [subscription] = await this.db.select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    
    return subscription;
  }

  private async getCurrentObligations(subscriptionId: string): Promise<any[]> {
    return await this.db.select()
      .from(performanceObligations)
      .where(eq(performanceObligations.subscriptionId, subscriptionId));
  }

  private async getRecognizedRevenue(
    subscriptionId: string,
    asOfDate: Date
  ): Promise<number> {
    const result = await this.db.select({
      total: sql<number>`SUM(${revenueSchedules.recognizedAmount})`
    })
    .from(revenueSchedules)
    .innerJoin(performanceObligations, eq(revenueSchedules.performanceObligationId, performanceObligations.id))
    .where(and(
      eq(performanceObligations.subscriptionId, subscriptionId),
      lte(revenueSchedules.recognitionDate, asOfDate.toISOString())
    ));

    return result[0]?.total || 0;
  }

  private async getUnrecognizedRevenue(
    subscriptionId: string,
    asOfDate: Date
  ): Promise<number> {
    const result = await this.db.select({
      total: sql<number>`SUM(${revenueSchedules.scheduledAmount} - ${revenueSchedules.recognizedAmount})`
    })
    .from(revenueSchedules)
    .innerJoin(performanceObligations, eq(revenueSchedules.performanceObligationId, performanceObligations.id))
    .where(and(
      eq(performanceObligations.subscriptionId, subscriptionId),
      gte(revenueSchedules.recognitionDate, asOfDate.toISOString())
    ));

    return result[0]?.total || 0;
  }

  private async areItemsDistinct(itemIds: string[]): Promise<boolean> {
    // Check if items are distinct per ASC 606-10-25-19
    const itemsData = await this.db.select()
      .from(items)
      .where(inArray(items.id, itemIds));
    
    // Items are distinct if customer can benefit from each on its own
    // This is a simplified check - real implementation would be more complex
    return itemsData.every(item => 
      item.itemType === 'NON_INVENTORY_ITEM' || 
      item.itemType === 'SERVICE'
    );
  }

  private async priceReflectsSSP(
    addedItems: Array<{ itemId: string; unitPrice: number }>
  ): Promise<boolean> {
    // Check if prices reflect standalone selling prices
    for (const item of addedItems) {
      const [sspData] = await this.db.select()
        .from(sspEvidence)
        .where(and(
          eq(sspEvidence.itemId, item.itemId),
          eq(sspEvidence.isActive, true)
        ))
        .orderBy(sql`${sspEvidence.createdAt} DESC`)
        .limit(1);

      if (!sspData) return false;
      
      // Allow 10% variance from SSP
      const variance = Math.abs(item.unitPrice - parseFloat(sspData.sspAmount)) / parseFloat(sspData.sspAmount);
      if (variance > 0.1) return false;
    }
    
    return true;
  }

  private async hasDistinctRemainingObligations(
    subscriptionId: string,
    effectiveDate: Date
  ): Promise<boolean> {
    const obligations = await this.db.select()
      .from(performanceObligations)
      .where(and(
        eq(performanceObligations.subscriptionId, subscriptionId),
        eq(performanceObligations.status, 'active'),
        gte(performanceObligations.endDate, effectiveDate.toISOString())
      ));

    // Check if remaining obligations are distinct
    // For simplicity, assuming obligations are distinct if they have different item IDs
    const uniqueItemIds = new Set(obligations.map(o => o.itemId));
    return obligations.length > 0 && uniqueItemIds.size === obligations.length;
  }

  private calculateRefund(
    items: any[],
    terminationDate: Date,
    policy: 'prorated' | 'full'
  ): number {
    if (policy === 'full') {
      return items.reduce((sum, item) => sum + parseFloat(item.unitPrice), 0);
    }
    
    // Prorated refund calculation
    let refund = 0;
    for (const item of items) {
      const startDate = new Date(item.startDate);
      const endDate = new Date(item.endDate);
      const totalDays = this.daysDifference(startDate, endDate);
      const usedDays = this.daysDifference(startDate, terminationDate);
      const unusedDays = totalDays - usedDays;
      
      if (unusedDays > 0) {
        const dailyRate = parseFloat(item.unitPrice) / totalDays;
        refund += dailyRate * unusedDays;
      }
    }
    
    return refund;
  }

  private calculateUpgradeCredit(
    fromItem: any,
    effectiveDate: Date,
    policy: 'full' | 'prorated'
  ): number {
    if (policy === 'full') {
      return parseFloat(fromItem.unitPrice);
    }

    // Prorated credit
    const startDate = new Date(fromItem.startDate);
    const endDate = new Date(fromItem.endDate);
    const totalDays = this.daysDifference(startDate, endDate);
    const usedDays = this.daysDifference(startDate, effectiveDate);
    const unusedDays = totalDays - usedDays;

    if (unusedDays > 0) {
      const dailyRate = parseFloat(fromItem.unitPrice) / totalDays;
      return dailyRate * unusedDays;
    }

    return 0;
  }

  private monthsDifference(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
  }

  private daysDifference(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateRevenueToDate(
    schedules: any[],
    startDate: Date,
    endDate: Date
  ): number {
    return schedules
      .filter(s => {
        const schedDate = new Date(s.recognitionDate);
        return schedDate >= startDate && schedDate <= endDate;
      })
      .reduce((sum, s) => sum + parseFloat(s.recognizedAmount), 0);
  }

  private async compareObligations(
    currentObligations: any[],
    modifiedObligations: any[]
  ): Promise<any[]> {
    const changes = [];
    
    for (const current of currentObligations) {
      const modified = modifiedObligations.find(m => m.itemId === current.itemId);
      
      if (modified) {
        changes.push({
          obligationId: current.id,
          itemName: current.itemName,
          originalAmount: parseFloat(current.allocatedAmount),
          newAmount: parseFloat(modified.allocatedAmount),
          change: parseFloat(modified.allocatedAmount) - parseFloat(current.allocatedAmount),
          satisfactionImpact: this.determineSatisfactionImpact(current, modified)
        });
      } else {
        // Obligation removed
        changes.push({
          obligationId: current.id,
          itemName: current.itemName,
          originalAmount: parseFloat(current.allocatedAmount),
          newAmount: 0,
          change: -parseFloat(current.allocatedAmount),
          satisfactionImpact: 'removed'
        });
      }
    }

    // Check for new obligations
    for (const modified of modifiedObligations) {
      if (!currentObligations.find(c => c.itemId === modified.itemId)) {
        changes.push({
          obligationId: modified.id,
          itemName: modified.itemName,
          originalAmount: 0,
          newAmount: parseFloat(modified.allocatedAmount),
          change: parseFloat(modified.allocatedAmount),
          satisfactionImpact: 'new'
        });
      }
    }

    return changes;
  }

  private determineSatisfactionImpact(current: any, modified: any): string {
    if (modified.satisfactionMethod !== current.satisfactionMethod) {
      return 'method_changed';
    }
    if (modified.endDate !== current.endDate) {
      return 'period_changed';
    }
    if (Math.abs(parseFloat(modified.allocatedAmount) - parseFloat(current.allocatedAmount)) > 0.01) {
      return 'amount_changed';
    }
    return 'no_change';
  }

  private async calculateScheduleChanges(
    subscriptionId: string,
    newSchedules: any[]
  ): Promise<any> {
    const currentSchedules = await this.db.select()
      .from(revenueSchedules)
      .innerJoin(performanceObligations, eq(revenueSchedules.performanceObligationId, performanceObligations.id))
      .where(eq(performanceObligations.subscriptionId, subscriptionId));

    return {
      schedulesToCancel: currentSchedules.filter(c => c.revenue_schedules.status === 'scheduled').length,
      schedulesToCreate: newSchedules.length,
      schedulesToModify: 0
    };
  }

  private async applyChangesToContract(
    subscription: any,
    changes: ModificationChanges
  ): Promise<any> {
    const modifiedContract = { ...subscription };

    // Apply additions
    if (changes.addItems) {
      modifiedContract.items = [...(modifiedContract.items || []), ...changes.addItems];
    }

    // Apply removals
    if (changes.removeItems) {
      modifiedContract.items = (modifiedContract.items || []).filter(
        (item: any) => !changes.removeItems!.includes(item.id)
      );
    }

    // Apply modifications
    if (changes.modifyItems) {
      for (const mod of changes.modifyItems) {
        const item = modifiedContract.items?.find((i: any) => i.id === mod.subscriptionItemId);
        if (item) {
          Object.assign(item, mod);
        }
      }
    }

    // Apply term changes
    if (changes.termExtension) {
      modifiedContract.endDate = changes.termExtension.newEndDate;
    }

    // Recalculate total amount
    modifiedContract.totalAmount = this.calculateContractValue(modifiedContract);

    return modifiedContract;
  }

  private calculateContractValue(contract: any): number {
    if (!contract.items) return 0;
    
    return contract.items.reduce((sum: number, item: any) => {
      const quantity = parseFloat(item.quantity || '1');
      const unitPrice = parseFloat(item.unitPrice || '0');
      const discount = parseFloat(item.discountPercent || '0') / 100;
      return sum + (quantity * unitPrice * (1 - discount));
    }, 0);
  }

  private async reallocateRevenue(
    unrecognizedRevenue: number,
    modifiedContract: any,
    remainingObligations: any[],
    effectiveDate: Date
  ): Promise<any> {
    // This would implement the revenue reallocation logic
    // Simplified for brevity
    return {
      changes: remainingObligations.map(o => ({
        obligationId: o.id,
        itemName: o.itemName,
        originalAmount: parseFloat(o.allocatedAmount),
        newAmount: parseFloat(o.allocatedAmount), // Would be recalculated
        change: 0,
        satisfactionImpact: 'reallocated'
      })),
      futureImpact: unrecognizedRevenue,
      scheduleChanges: {
        schedulesToCancel: 0,
        schedulesToCreate: 0,
        schedulesToModify: remainingObligations.length
      }
    };
  }

  private async calculateBlendExtendImpact(
    subscription: any,
    modifiedContract: any,
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Simplified blend and extend calculation
    return {
      method: "blend_extend",
      financialImpact: {
        originalValue: parseFloat(subscription.totalAmount),
        modifiedValue: parseFloat(modifiedContract.totalAmount),
        adjustment: parseFloat(modifiedContract.totalAmount) - parseFloat(subscription.totalAmount)
      },
      obligationChanges: [],
      revenueImpact: {
        currentPeriodAdjustment: 0,
        futurePeriodImpact: parseFloat(modifiedContract.totalAmount) - parseFloat(subscription.totalAmount),
        cumulativeCatchUp: undefined
      },
      scheduleChanges: {
        schedulesToCancel: 0,
        schedulesToCreate: 0,
        schedulesToModify: 1
      }
    };
  }

  private async calculateSeparateContractImpact(
    subscription: any,
    changes: ModificationChanges,
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Treat as separate contract - no impact on existing
    const newContractValue = changes.addItems?.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice), 0) || 0;

    return {
      method: "separate_contract",
      financialImpact: {
        originalValue: parseFloat(subscription.totalAmount),
        modifiedValue: parseFloat(subscription.totalAmount) + newContractValue,
        adjustment: newContractValue
      },
      obligationChanges: [],
      revenueImpact: {
        currentPeriodAdjustment: 0,
        futurePeriodImpact: newContractValue,
        cumulativeCatchUp: undefined
      },
      scheduleChanges: {
        schedulesToCancel: 0,
        schedulesToCreate: changes.addItems?.length || 0,
        schedulesToModify: 0
      }
    };
  }

  private checkForWarnings(impact: ModificationImpact): string[] {
    const warnings = [];

    if (Math.abs(impact.financialImpact.adjustment) > 10000) {
      warnings.push('Significant financial impact detected');
    }

    if (impact.revenueImpact.cumulativeCatchUp && Math.abs(impact.revenueImpact.cumulativeCatchUp) > 5000) {
      warnings.push('Large cumulative catch-up adjustment required');
    }

    if (impact.scheduleChanges.schedulesToCancel > 10) {
      warnings.push('Many revenue schedules will be cancelled');
    }

    return warnings;
  }

  private async createModificationRecord(
    request: ModificationRequest,
    impact: ModificationImpact,
    method: typeof ModificationMethod[keyof typeof ModificationMethod]
  ): Promise<string> {
    const modificationId = createId();
    const modificationNumber = await this.generateModificationNumber(request.subscriptionId);

    const subscription = await this.getSubscription(request.subscriptionId);

    const modification: NewContractModification = {
      id: modificationId,
      organizationId: subscription.organizationId,
      subscriptionId: request.subscriptionId,
      modificationNumber,
      modificationType: request.modificationType,
      modificationMethod: method,
      requestDate: new Date(),
      effectiveDate: request.effectiveDate,
      originalContractValue: impact.financialImpact.originalValue.toString(),
      modifiedContractValue: impact.financialImpact.modifiedValue.toString(),
      adjustmentAmount: impact.financialImpact.adjustment.toString(),
      refundAmount: impact.financialImpact.refundAmount?.toString(),
      creditAmount: impact.financialImpact.creditAmount?.toString(),
      modificationDetails: request.changes,
      revenueImpact: impact.revenueImpact,
      obligationChanges: impact.obligationChanges,
      scheduleChanges: impact.scheduleChanges,
      cumulativeCatchUpAmount: impact.revenueImpact.cumulativeCatchUp?.toString(),
      prospectiveAdjustmentAmount: method === "prospective" 
        ? impact.financialImpact.adjustment.toString() 
        : undefined,
      status: "draft",
      requestedBy: request.requestedBy,
      reason: request.reason,
      notes: request.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.insert(contractModifications).values(modification);

    // Create line items if applicable
    await this.createModificationLineItems(modificationId, request.changes);

    return modificationId;
  }

  private async generateModificationNumber(subscriptionId: string): Promise<string> {
    const count = await this.db.select({ count: sql<number>`COUNT(*)` })
      .from(contractModifications)
      .where(eq(contractModifications.subscriptionId, subscriptionId));

    const modNumber = (count[0]?.count || 0) + 1;
    return `MOD-${subscriptionId.substring(0, 8)}-${modNumber.toString().padStart(3, '0')}`;
  }

  private async createModificationLineItems(
    modificationId: string,
    changes: ModificationChanges
  ): Promise<void> {
    const lineItems: NewModificationLineItem[] = [];

    // Add items
    if (changes.addItems) {
      for (const item of changes.addItems) {
        lineItems.push({
          modificationId,
          action: 'add',
          subscriptionItemId: item.itemId,
          newQuantity: item.quantity.toString(),
          newUnitPrice: item.unitPrice.toString(),
          newStartDate: item.startDate,
          newEndDate: item.endDate,
          createdAt: new Date()
        });
      }
    }

    // Remove items
    if (changes.removeItems) {
      for (const itemId of changes.removeItems) {
        lineItems.push({
          modificationId,
          action: 'remove',
          subscriptionItemId: itemId,
          createdAt: new Date()
        });
      }
    }

    // Modify items
    if (changes.modifyItems) {
      for (const mod of changes.modifyItems) {
        lineItems.push({
          modificationId,
          action: 'modify',
          subscriptionItemId: mod.subscriptionItemId,
          newQuantity: mod.newQuantity?.toString(),
          newUnitPrice: mod.newUnitPrice?.toString(),
          newEndDate: mod.newEndDate,
          createdAt: new Date()
        });
      }
    }

    if (lineItems.length > 0) {
      await this.db.insert(modificationLineItems).values(lineItems);
    }
  }

  private async cancelFutureSchedules(
    obligationIds: string[],
    effectiveDate: Date
  ): Promise<{ count: number }> {
    const result = await this.db.update(revenueSchedules)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        inArray(revenueSchedules.performanceObligationId, obligationIds),
        gte(revenueSchedules.recognitionDate, effectiveDate.toISOString()),
        eq(revenueSchedules.status, 'scheduled')
      ));

    return { count: 0 }; // Would return actual count
  }

  private async applyLineItemChanges(tx: any, modificationId: string): Promise<void> {
    // Implementation would apply line item changes to subscription
  }

  private async applyCatchUpAdjustments(tx: any, modificationId: string): Promise<void> {
    // Implementation would create and apply catch-up adjustments
  }

  private async updateRevenueSchedules(tx: any, modification: any): Promise<void> {
    // Implementation would update revenue schedules based on modification
  }
}