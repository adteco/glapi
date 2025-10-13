# TASK-017: Contract Modifications Advanced Workflows

## Description
Implement comprehensive contract modification workflows supporting both prospective and cumulative catch-up accounting methods, partial terminations, upgrades/downgrades, and complex multi-step modifications with full ASC 606 compliance.

## Acceptance Criteria
- [ ] Prospective vs cumulative catch-up decision engine
- [ ] Partial termination handling with proration
- [ ] Upgrade/downgrade workflows with SSP reallocation
- [ ] Multi-step modification support (combine multiple changes)
- [ ] Modification impact preview and simulation
- [ ] Amendment tracking with full audit trail
- [ ] Retroactive adjustment calculations
- [ ] Contract blend and extend scenarios
- [ ] Cancellation and refund processing
- [ ] Modification approval workflows

## Dependencies
- TASK-009: Revenue calculation engine
- TASK-003: Revenue recognition schema
- TASK-005: Subscription tRPC router

## Estimated Effort
4 days

## Technical Implementation

### Contract Modification Schema Extensions
```typescript
// packages/database/src/db/schema/contract-modifications.ts
import { pgTable, uuid, varchar, timestamp, jsonb, decimal, date, boolean, integer } from "drizzle-orm/pg-core";

export const modificationMethodEnum = pgEnum("modification_method", [
  "prospective",
  "cumulative_catch_up",
  "separate_contract",
  "blend_extend"
]);

export const modificationTypeEnum = pgEnum("modification_type", [
  "add_items",
  "remove_items",
  "quantity_change",
  "price_change",
  "term_extension",
  "early_termination",
  "partial_termination",
  "upgrade",
  "downgrade",
  "blend_extend"
]);

export const contractModifications = pgTable("contract_modifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),
  
  // Modification details
  modificationNumber: varchar("modification_number", { length: 50 }).notNull().unique(),
  modificationType: modificationTypeEnum("modification_type").notNull(),
  modificationMethod: modificationMethodEnum("modification_method").notNull(),
  
  // Dates
  requestDate: date("request_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  approvalDate: date("approval_date"),
  
  // Values
  originalContractValue: decimal("original_contract_value", { precision: 12, scale: 2 }).notNull(),
  modifiedContractValue: decimal("modified_contract_value", { precision: 12, scale: 2 }).notNull(),
  adjustmentAmount: decimal("adjustment_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Modification details
  modificationDetails: jsonb("modification_details").notNull(),
  
  // Impact analysis
  revenueImpact: jsonb("revenue_impact"),
  obligationChanges: jsonb("obligation_changes"),
  
  // Workflow
  status: varchar("status", { length: 20 }).notNull(), // draft, pending_approval, approved, applied, rejected
  requestedBy: uuid("requested_by").references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  
  // Audit
  reason: text("reason"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// Track individual line item changes
export const modificationLineItems = pgTable("modification_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  modificationId: uuid("modification_id").references(() => contractModifications.id).notNull(),
  
  // Change type
  changeType: varchar("change_type", { length: 20 }).notNull(), // add, remove, modify
  
  // Item references
  originalItemId: uuid("original_item_id").references(() => subscriptionItems.id),
  newItemId: uuid("new_item_id").references(() => items.id),
  
  // Original values (for modifications)
  originalQuantity: decimal("original_quantity", { precision: 10, scale: 2 }),
  originalUnitPrice: decimal("original_unit_price", { precision: 12, scale: 2 }),
  originalStartDate: date("original_start_date"),
  originalEndDate: date("original_end_date"),
  
  // New values
  newQuantity: decimal("new_quantity", { precision: 10, scale: 2 }),
  newUnitPrice: decimal("new_unit_price", { precision: 12, scale: 2 }),
  newStartDate: date("new_start_date"),
  newEndDate: date("new_end_date"),
  
  // Financial impact
  revenueAdjustment: decimal("revenue_adjustment", { precision: 12, scale: 2 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

// Cumulative catch-up adjustments
export const catchUpAdjustments = pgTable("catch_up_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  modificationId: uuid("modification_id").references(() => contractModifications.id).notNull(),
  performanceObligationId: uuid("performance_obligation_id").references(() => performanceObligations.id).notNull(),
  
  // Adjustment calculation
  priorRecognizedAmount: decimal("prior_recognized_amount", { precision: 12, scale: 2 }).notNull(),
  revisedCumulativeAmount: decimal("revised_cumulative_amount", { precision: 12, scale: 2 }).notNull(),
  catchUpAdjustment: decimal("catch_up_adjustment", { precision: 12, scale: 2 }).notNull(),
  
  // Journal entry reference
  journalEntryId: uuid("journal_entry_id").references(() => revenueJournalEntries.id),
  
  adjustmentDate: date("adjustment_date").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // calculated, posted, reversed
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
```

### Contract Modification Engine
```typescript
// packages/business/src/services/contract-modification-engine.ts
import { Database } from '@glapi/database';
import { RevenueCalculationEngine } from './revenue-calculation-engine';

export interface ModificationRequest {
  subscriptionId: string;
  modificationType: string;
  effectiveDate: Date;
  changes: ModificationChanges;
  reason?: string;
  notes?: string;
}

export interface ModificationChanges {
  addItems?: Array<{
    itemId: string;
    quantity: number;
    unitPrice: number;
    startDate?: Date;
    endDate?: Date;
  }>;
  removeItems?: string[]; // subscription item IDs
  modifyItems?: Array<{
    subscriptionItemId: string;
    newQuantity?: number;
    newUnitPrice?: number;
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
}

export interface ModificationImpact {
  method: 'prospective' | 'cumulative_catch_up' | 'separate_contract';
  financialImpact: {
    originalValue: number;
    modifiedValue: number;
    adjustment: number;
    refundAmount?: number;
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
}

export class ContractModificationEngine {
  constructor(
    private db: Database,
    private revenueEngine: RevenueCalculationEngine
  ) {}

  // Main modification processing method
  async processModification(
    request: ModificationRequest,
    options?: {
      preview?: boolean;
      autoApprove?: boolean;
    }
  ): Promise<{
    modificationId?: string;
    impact: ModificationImpact;
    warnings?: string[];
  }> {
    // Step 1: Validate modification request
    await this.validateModification(request);

    // Step 2: Determine modification method (ASC 606-10-25-12)
    const method = await this.determineModificationMethod(request);

    // Step 3: Calculate impact
    const impact = await this.calculateModificationImpact(request, method);

    // Step 4: Check for warnings
    const warnings = this.checkForWarnings(impact);

    if (options?.preview) {
      return { impact, warnings };
    }

    // Step 5: Apply modification
    const modificationId = await this.applyModification(request, impact);

    // Step 6: Handle approvals
    if (options?.autoApprove) {
      await this.approveModification(modificationId);
    }

    return { modificationId, impact, warnings };
  }

  // Determine accounting method based on ASC 606 criteria
  private async determineModificationMethod(
    request: ModificationRequest
  ): Promise<'prospective' | 'cumulative_catch_up' | 'separate_contract'> {
    const subscription = await this.getSubscription(request.subscriptionId);
    
    // Check if modification adds distinct goods/services
    if (request.changes.addItems && request.changes.addItems.length > 0) {
      const hasDistinctItems = await this.areItemsDistinct(
        request.changes.addItems.map(i => i.itemId)
      );
      
      if (hasDistinctItems) {
        // Check if price reflects standalone selling price
        const reflectsSSP = await this.priceReflectsSSP(request.changes.addItems);
        
        if (reflectsSSP) {
          // Treat as separate contract (ASC 606-10-25-12(a))
          return 'separate_contract';
        }
      }
    }

    // Check if remaining goods/services are distinct
    const hasDistinctRemaining = await this.hasDistinctRemainingObligations(
      request.subscriptionId,
      request.effectiveDate
    );

    if (!hasDistinctRemaining) {
      // Use cumulative catch-up (ASC 606-10-25-13(a))
      return 'cumulative_catch_up';
    }

    // Default to prospective (ASC 606-10-25-13(b))
    return 'prospective';
  }

  // Calculate modification impact
  private async calculateModificationImpact(
    request: ModificationRequest,
    method: 'prospective' | 'cumulative_catch_up' | 'separate_contract'
  ): Promise<ModificationImpact> {
    const subscription = await this.getSubscription(request.subscriptionId);
    
    // Get current state
    const currentObligations = await this.getCurrentObligations(request.subscriptionId);
    const currentSchedules = await this.getCurrentSchedules(request.subscriptionId);
    const recognizedToDate = await this.getRecognizedRevenue(
      request.subscriptionId,
      request.effectiveDate
    );

    // Apply changes to create modified contract
    const modifiedContract = await this.applyChangesToContract(subscription, request.changes);

    // Recalculate revenue based on method
    let impact: ModificationImpact;

    switch (method) {
      case 'cumulative_catch_up':
        impact = await this.calculateCumulativeCatchUpImpact(
          subscription,
          modifiedContract,
          currentObligations,
          recognizedToDate,
          request.effectiveDate
        );
        break;

      case 'prospective':
        impact = await this.calculateProspectiveImpact(
          subscription,
          modifiedContract,
          currentObligations,
          request.effectiveDate
        );
        break;

      case 'separate_contract':
        impact = await this.calculateSeparateContractImpact(
          subscription,
          request.changes,
          request.effectiveDate
        );
        break;

      default:
        throw new Error(`Unknown modification method: ${method}`);
    }

    return impact;
  }

  // Cumulative catch-up calculation
  private async calculateCumulativeCatchUpImpact(
    originalContract: any,
    modifiedContract: any,
    currentObligations: any[],
    recognizedToDate: number,
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Recalculate from inception with modified terms
    const modifiedCalculation = await this.revenueEngine.calculate({
      subscriptionId: originalContract.id,
      organizationId: originalContract.organizationId,
      calculationType: 'modification',
      effectiveDate,
      options: { forceRecalculation: true }
    });

    // Calculate what should have been recognized to date
    const shouldHaveRecognized = this.calculateRevenueToDate(
      modifiedCalculation.schedules,
      originalContract.startDate,
      effectiveDate
    );

    // Cumulative catch-up adjustment
    const catchUpAdjustment = shouldHaveRecognized - recognizedToDate;

    // Calculate obligation changes
    const obligationChanges = this.compareObligations(
      currentObligations,
      modifiedCalculation.performanceObligations
    );

    return {
      method: 'cumulative_catch_up',
      financialImpact: {
        originalValue: parseFloat(originalContract.contractValue),
        modifiedValue: modifiedCalculation.transactionPrice,
        adjustment: modifiedCalculation.transactionPrice - parseFloat(originalContract.contractValue)
      },
      obligationChanges,
      revenueImpact: {
        currentPeriodAdjustment: catchUpAdjustment,
        futurePeriodImpact: modifiedCalculation.transactionPrice - shouldHaveRecognized,
        cumulativeCatchUp: catchUpAdjustment
      },
      scheduleChanges: {
        schedulesToCancel: currentObligations.length,
        schedulesToCreate: modifiedCalculation.schedules.length,
        schedulesToModify: 0
      }
    };
  }

  // Prospective impact calculation
  private async calculateProspectiveImpact(
    originalContract: any,
    modifiedContract: any,
    currentObligations: any[],
    effectiveDate: Date
  ): Promise<ModificationImpact> {
    // Only adjust going forward
    const remainingObligations = currentObligations.filter(
      o => o.status === 'active' && new Date(o.endDate) >= effectiveDate
    );

    // Calculate remaining unrecognized revenue
    const unrecognizedRevenue = await this.getUnrecognizedRevenue(
      originalContract.id,
      effectiveDate
    );

    // Reallocate to modified obligations
    const modifiedAllocations = await this.reallocateRevenue(
      unrecognizedRevenue,
      modifiedContract,
      effectiveDate
    );

    return {
      method: 'prospective',
      financialImpact: {
        originalValue: parseFloat(originalContract.contractValue),
        modifiedValue: parseFloat(modifiedContract.contractValue),
        adjustment: parseFloat(modifiedContract.contractValue) - parseFloat(originalContract.contractValue)
      },
      obligationChanges: modifiedAllocations.changes,
      revenueImpact: {
        currentPeriodAdjustment: 0, // No immediate catch-up
        futurePeriodImpact: modifiedAllocations.futureImpact,
        cumulativeCatchUp: undefined
      },
      scheduleChanges: {
        schedulesToCancel: modifiedAllocations.cancelCount,
        schedulesToCreate: modifiedAllocations.createCount,
        schedulesToModify: modifiedAllocations.modifyCount
      }
    };
  }

  // Handle partial terminations
  async processPartialTermination(
    subscriptionId: string,
    itemsToTerminate: string[],
    terminationDate: Date,
    options?: {
      refundPolicy?: 'none' | 'prorated' | 'full';
      finalInvoice?: boolean;
    }
  ): Promise<{
    terminationId: string;
    refundAmount: number;
    affectedObligations: string[];
    cancelledSchedules: number;
  }> {
    // Get items to terminate
    const subscriptionItems = await this.getSubscriptionItems(subscriptionId);
    const itemsToRemove = subscriptionItems.filter(
      item => itemsToTerminate.includes(item.id)
    );

    if (itemsToRemove.length === 0) {
      throw new Error('No valid items to terminate');
    }

    // Calculate refund if applicable
    let refundAmount = 0;
    if (options?.refundPolicy && options.refundPolicy !== 'none') {
      refundAmount = await this.calculateRefund(
        itemsToRemove,
        terminationDate,
        options.refundPolicy
      );
    }

    // Get affected performance obligations
    const affectedObligations = await this.getObligationsForItems(
      itemsToRemove.map(i => i.id)
    );

    // Cancel future revenue schedules
    const cancelledSchedules = await this.cancelFutureSchedules(
      affectedObligations.map(o => o.id),
      terminationDate
    );

    // Create modification record
    const modification = await this.createModification({
      subscriptionId,
      modificationType: 'partial_termination',
      modificationMethod: 'prospective',
      effectiveDate: terminationDate,
      changes: {
        removeItems: itemsToTerminate
      },
      adjustmentAmount: -refundAmount
    });

    // Generate final invoice if requested
    if (options?.finalInvoice) {
      await this.generateFinalInvoice(subscriptionId, terminationDate, refundAmount);
    }

    return {
      terminationId: modification.id,
      refundAmount,
      affectedObligations: affectedObligations.map(o => o.id),
      cancelledSchedules
    };
  }

  // Handle upgrades and downgrades
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
    const subscription = await this.getSubscription(subscriptionId);
    const fromItem = await this.getSubscriptionItem(changes.fromItemId);
    const toItem = await this.getItem(changes.toItemId);

    // Calculate credit for unused portion
    let creditAmount = 0;
    if (changes.creditPolicy && changes.creditPolicy !== 'none') {
      creditAmount = await this.calculateUpgradeCredit(
        fromItem,
        changes.effectiveDate,
        changes.creditPolicy
      );
    }

    // Determine if this is an upgrade or downgrade
    const isUpgrade = toItem.defaultPrice > fromItem.unitPrice;

    // Create modification request
    const modificationRequest: ModificationRequest = {
      subscriptionId,
      modificationType: isUpgrade ? 'upgrade' : 'downgrade',
      effectiveDate: changes.effectiveDate,
      changes: {
        removeItems: [changes.fromItemId],
        addItems: [{
          itemId: changes.toItemId,
          quantity: fromItem.quantity,
          unitPrice: toItem.defaultPrice - creditAmount,
          startDate: changes.effectiveDate,
          endDate: fromItem.endDate
        }]
      }
    };

    // Process the modification
    const result = await this.processModification(modificationRequest);

    return {
      modificationId: result.modificationId!,
      creditAmount,
      newObligations: result.impact.obligationChanges,
      impact: result.impact
    };
  }

  // Blend and extend scenarios
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

    // Calculate blended rate
    const remainingValue = await this.getUnrecognizedRevenue(
      subscriptionId,
      new Date()
    );
    
    const extensionValue = priceAdjustment 
      ? priceAdjustment * extendedMonths
      : (remainingValue / this.monthsDifference(new Date(), currentEndDate)) * extendedMonths;
    
    const totalRemainingMonths = this.monthsDifference(new Date(), newTermEndDate);
    const blendedRate = (remainingValue + extensionValue) / totalRemainingMonths;

    // Create blend and extend modification
    const modificationRequest: ModificationRequest = {
      subscriptionId,
      modificationType: 'blend_extend',
      effectiveDate: new Date(),
      changes: {
        termExtension: {
          newEndDate: newTermEndDate
        },
        modifyItems: subscription.items.map((item: any) => ({
          subscriptionItemId: item.id,
          newUnitPrice: blendedRate * (item.quantity || 1),
          newEndDate: newTermEndDate
        }))
      }
    };

    const result = await this.processModification(modificationRequest, {
      autoApprove: false
    });

    return {
      modificationId: result.modificationId!,
      blendedRate,
      extendedMonths,
      impact: result.impact
    };
  }

  // Helper methods
  private async areItemsDistinct(itemIds: string[]): Promise<boolean> {
    // Check if items are distinct per ASC 606-10-25-19
    const items = await this.db
      .select()
      .from(items)
      .where(sql`id = ANY(${itemIds})`);
    
    // Items are distinct if customer can benefit from each on its own
    return items.every(item => 
      item.itemType === 'non_inventory' || 
      item.itemType === 'service'
    );
  }

  private async priceReflectsSSP(
    addedItems: Array<{ itemId: string; unitPrice: number }>
  ): Promise<boolean> {
    // Check if prices reflect standalone selling prices
    for (const item of addedItems) {
      const ssp = await this.getCurrentSSP(item.itemId);
      if (!ssp) return false;
      
      // Allow 10% variance from SSP
      const variance = Math.abs(item.unitPrice - ssp.amount) / ssp.amount;
      if (variance > 0.1) return false;
    }
    
    return true;
  }

  private calculateRefund(
    items: any[],
    terminationDate: Date,
    policy: 'prorated' | 'full'
  ): number {
    if (policy === 'full') {
      return items.reduce((sum, item) => sum + parseFloat(item.unitPrice), 0);
    }
    
    // Prorated refund
    let refund = 0;
    for (const item of items) {
      const totalDays = this.daysDifference(item.startDate, item.endDate);
      const usedDays = this.daysDifference(item.startDate, terminationDate);
      const unusedDays = totalDays - usedDays;
      
      if (unusedDays > 0) {
        refund += (parseFloat(item.unitPrice) / totalDays) * unusedDays;
      }
    }
    
    return refund;
  }

  private monthsDifference(date1: Date, date2: Date): number {
    const months = (date2.getFullYear() - date1.getFullYear()) * 12;
    return months + date2.getMonth() - date1.getMonth();
  }

  private daysDifference(date1: Date, date2: Date): number {
    return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }
}
```

### Files to Create
- `packages/database/src/db/schema/contract-modifications.ts`
- `packages/business/src/services/contract-modification-engine.ts`
- `packages/business/src/services/modification-approval-workflow.ts`
- `packages/api-service/src/services/contract-modification-service.ts`
- `packages/trpc/src/routers/contract-modifications.ts`
- `packages/business/src/services/__tests__/contract-modification-engine.test.ts`

### Definition of Done
- [ ] Prospective vs cumulative catch-up decision logic implemented
- [ ] Partial termination with refund calculation working
- [ ] Upgrade/downgrade workflows with credit handling
- [ ] Multi-step modifications supported
- [ ] Impact preview and simulation functional
- [ ] Amendment tracking with audit trail
- [ ] Retroactive adjustments calculating correctly
- [ ] Blend and extend scenarios handled
- [ ] Cancellation and refund processing complete
- [ ] Approval workflow integrated
- [ ] ASC 606-10-25-12 criteria properly applied
- [ ] Unit tests covering all modification scenarios
- [ ] Performance optimized for complex modifications
- [ ] Documentation with accounting guidance