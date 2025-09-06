import { 
  db,
  SubscriptionRepository,
  SubscriptionItemRepository,
  ItemsRepository
} from '@glapi/database';
import { 
  performanceObligations,
  revenueSchedules,
  contractSspAllocations,
  kitComponents,
  sspEvidence,
  type PerformanceObligation,
  type RevenueSchedule,
  type NewPerformanceObligation,
  type NewRevenueSchedule,
  type NewContractSSPAllocation,
  type Subscription,
  type SubscriptionItem
} from '@glapi/database/src/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface CalculationParams {
  subscriptionId: string;
  organizationId: string;
  calculationType: 'initial' | 'modification' | 'renewal' | 'termination';
  effectiveDate: Date;
  options?: CalculationOptions;
}

export interface CalculationOptions {
  forceRecalculation?: boolean;
  includeHistorical?: boolean;
  dryRun?: boolean;
}

export interface CalculationResult {
  subscriptionId: string;
  calculationType: string;
  transactionPrice: number;
  performanceObligations: PerformanceObligationResult[];
  allocations: PriceAllocation[];
  schedules: RevenueScheduleResult[];
  comparisonToASC605?: ASC605Comparison;
}

export interface PerformanceObligationResult {
  id?: string;
  itemId: string;
  itemName: string;
  obligationType: string;
  satisfactionMethod: 'point_in_time' | 'over_time';
  satisfactionPeriodMonths?: number;
  allocatedAmount: number;
  startDate: Date;
  endDate: Date;
}

export interface PriceAllocation {
  performanceObligationId?: string;
  itemId: string;
  sspAmount: number;
  allocatedAmount: number;
  allocationPercentage: number;
  allocationMethod: 'ssp_proportional' | 'residual' | 'adjusted_market';
}

export interface RevenueScheduleResult {
  performanceObligationId?: string;
  periodStartDate: Date;
  periodEndDate: Date;
  scheduledAmount: number;
  recognitionPattern: 'immediate' | 'straight_line' | 'usage_based' | 'milestone';
  status: 'scheduled' | 'recognized' | 'deferred';
}

export interface ASC605Comparison {
  asc605Revenue: number;
  asc606Revenue: number;
  difference: number;
  percentageChange: number;
}

export interface ContractModification {
  newSubscriptionId?: string;
  addedItems: SubscriptionItem[];
  removedItems: string[];
  priceChanges: Array<{ itemId: string; newPrice: number }>;
  termExtension?: number; // months
}

export class RevenueCalculationEngine {
  private subscriptionRepo: SubscriptionRepository;
  private subscriptionItemRepo: SubscriptionItemRepository;
  private itemRepo: ItemsRepository;

  constructor() {
    this.subscriptionRepo = new SubscriptionRepository();
    this.subscriptionItemRepo = new SubscriptionItemRepository();
    this.itemRepo = new ItemsRepository();
  }

  async calculate(params: CalculationParams): Promise<CalculationResult> {
    // Step 1: Identify the contract
    const contract = await this.identifyContract(params.subscriptionId, params.organizationId);
    
    // Step 2: Identify performance obligations
    const obligations = await this.identifyPerformanceObligations(contract, params.organizationId);
    
    // Step 3: Determine transaction price
    const transactionPrice = await this.determineTransactionPrice(contract);
    
    // Step 4: Allocate price to performance obligations
    const allocations = await this.allocatePrice(obligations, transactionPrice, params.organizationId);
    
    // Step 5: Generate revenue schedules
    const schedules = await this.generateRevenueSchedules(allocations, obligations, contract);
    
    // Save results to database (unless dry run)
    if (!params.options?.dryRun) {
      await this.saveCalculationResults(params.subscriptionId, params.organizationId, {
        performanceObligations: obligations,
        allocations,
        schedules
      });
    }
    
    return {
      subscriptionId: params.subscriptionId,
      calculationType: params.calculationType,
      transactionPrice,
      performanceObligations: obligations,
      allocations,
      schedules,
      comparisonToASC605: await this.generateASC605Comparison(contract, transactionPrice)
    };
  }

  // Step 1: Identify the Contract
  private async identifyContract(subscriptionId: string, organizationId: string): Promise<any> {
    const subscription = await this.subscriptionRepo.findByIdWithItems(subscriptionId);
    
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    
    if (subscription.organizationId !== organizationId) {
      throw new Error('Subscription does not belong to organization');
    }
    
    // Validate contract enforceability
    if (!this.isContractEnforceable(subscription)) {
      throw new Error('Contract is not enforceable for revenue recognition');
    }
    
    return subscription;
  }

  // Step 2: Identify Performance Obligations
  private async identifyPerformanceObligations(
    contract: any,
    organizationId: string
  ): Promise<PerformanceObligationResult[]> {
    const obligations: PerformanceObligationResult[] = [];
    
    for (const item of contract.items) {
      const isKit = await this.isKitItem(item.itemId);
      
      if (isKit) {
        // Explode kit items into components
        const components = await this.explodeKit(item.itemId, parseFloat(item.unitPrice) * parseFloat(item.quantity));
        
        for (const component of components) {
          const itemDetails = await this.itemRepo.findById(component.componentItemId, organizationId);
          obligations.push({
            itemId: component.componentItemId,
            itemName: itemDetails?.name || 'Unknown',
            obligationType: await this.determineObligationType(component.componentItemId, organizationId),
            satisfactionMethod: await this.determineSatisfactionMethod(component.componentItemId, organizationId),
            allocatedAmount: 0, // Set in step 4
            startDate: new Date(item.startDate),
            endDate: new Date(item.endDate)
          });
        }
      } else {
        // Regular item - single performance obligation
        const itemDetails = await this.itemRepo.findById(item.itemId, organizationId);
        obligations.push({
          itemId: item.itemId,
          itemName: itemDetails?.name || 'Unknown',
          obligationType: await this.determineObligationType(item.itemId, organizationId),
          satisfactionMethod: await this.determineSatisfactionMethod(item.itemId, organizationId),
          allocatedAmount: 0, // Set in step 4
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate)
        });
      }
    }
    
    return this.consolidateObligations(obligations);
  }

  // Step 3: Determine Transaction Price
  private async determineTransactionPrice(contract: any): Promise<number> {
    let transactionPrice = parseFloat(contract.contractValue);
    
    // Handle variable consideration (discounts, rebates, etc.)
    transactionPrice += await this.estimateVariableConsideration(contract);
    
    // Apply constraint (only include amounts highly probable not to reverse)
    transactionPrice = await this.applyConstraint(transactionPrice, contract);
    
    // Adjust for time value of money if significant financing component
    transactionPrice = await this.adjustForFinancingComponent(transactionPrice, contract);
    
    // Reduce for non-cash consideration and consideration payable to customer
    transactionPrice -= await this.calculateConsiderationPayableToCustomer(contract);
    
    return transactionPrice;
  }

  // Step 4: Allocate Price to Performance Obligations
  private async allocatePrice(
    obligations: PerformanceObligationResult[],
    transactionPrice: number,
    organizationId: string
  ): Promise<PriceAllocation[]> {
    const allocations: PriceAllocation[] = [];
    
    // Get SSP for each obligation
    const sspValues = await Promise.all(
      obligations.map(async (obligation) => {
        const ssp = await this.getCurrentSSP(obligation.itemId, organizationId);
        return {
          itemId: obligation.itemId,
          ssp: ssp || { amount: 0, confidence: 'low' }
        };
      })
    );
    
    // Calculate total SSP
    const totalSSP = sspValues.reduce((sum, item) => sum + item.ssp.amount, 0);
    
    // Handle residual approach if SSP not available for some items
    if (this.shouldUseResidualApproach(sspValues)) {
      return this.allocateUsingResidualApproach(obligations, transactionPrice, sspValues);
    }
    
    // Standard proportional allocation
    for (let i = 0; i < obligations.length; i++) {
      const sspValue = sspValues[i];
      const allocationPercentage = totalSSP > 0 ? sspValue.ssp.amount / totalSSP : 1 / obligations.length;
      const allocatedAmount = transactionPrice * allocationPercentage;
      
      allocations.push({
        performanceObligationId: obligations[i].id,
        itemId: sspValue.itemId,
        sspAmount: sspValue.ssp.amount,
        allocatedAmount,
        allocationPercentage,
        allocationMethod: 'ssp_proportional'
      });
      
      // Update obligation with allocated amount
      obligations[i].allocatedAmount = allocatedAmount;
    }
    
    // Handle rounding differences
    return this.handleRoundingDifferences(allocations, transactionPrice);
  }

  // Step 5: Generate Revenue Schedules
  private async generateRevenueSchedules(
    allocations: PriceAllocation[],
    obligations: PerformanceObligationResult[],
    contract: any
  ): Promise<RevenueScheduleResult[]> {
    const schedules: RevenueScheduleResult[] = [];
    
    for (let i = 0; i < allocations.length; i++) {
      const allocation = allocations[i];
      const obligation = obligations[i];
      
      if (obligation.satisfactionMethod === 'point_in_time') {
        // Recognize immediately when control transfers
        schedules.push({
          performanceObligationId: obligation.id,
          periodStartDate: obligation.startDate,
          periodEndDate: obligation.startDate,
          scheduledAmount: allocation.allocatedAmount,
          recognitionPattern: 'immediate',
          status: 'scheduled'
        });
      } else {
        // Recognize over time
        const pattern = await this.determineRecognitionPattern(obligation);
        const periodSchedules = await this.generateOverTimeSchedules(
          allocation,
          obligation,
          pattern
        );
        schedules.push(...periodSchedules);
      }
    }
    
    return schedules.sort((a, b) => 
      a.periodStartDate.getTime() - b.periodStartDate.getTime()
    );
  }

  // Contract Modification Handling
  async handleContractModification(
    subscriptionId: string,
    organizationId: string,
    modificationDate: Date,
    modificationDetails: ContractModification
  ): Promise<CalculationResult> {
    const existingCalculation = await this.getExistingCalculation(subscriptionId, organizationId);
    
    if (this.isModificationSeparateContract(modificationDetails)) {
      // Treat as separate contract
      return this.calculate({
        subscriptionId: modificationDetails.newSubscriptionId!,
        organizationId,
        calculationType: 'initial',
        effectiveDate: modificationDate
      });
    } else {
      // Modify existing contract - cumulative catch-up
      return this.recalculateExistingContract(
        subscriptionId,
        organizationId,
        modificationDate,
        modificationDetails
      );
    }
  }

  // Helper Methods
  private isContractEnforceable(subscription: any): boolean {
    return subscription.status !== 'draft' && 
           parseFloat(subscription.contractValue) > 0 &&
           subscription.items && subscription.items.length > 0;
  }

  private async isKitItem(itemId: string): Promise<boolean> {
    const [kit] = await db.select()
      .from(kitComponents)
      .where(eq(kitComponents.parentItemId, itemId))
      .limit(1);
    
    return !!kit;
  }

  private async explodeKit(kitItemId: string, totalPrice: number): Promise<any[]> {
    const components = await db.select()
      .from(kitComponents)
      .where(eq(kitComponents.parentItemId, kitItemId));
    
    // Allocate kit price to components based on allocation percentages or SSP
    return components.map(component => ({
      componentItemId: component.componentItemId,
      allocatedPrice: totalPrice * (parseFloat(component.allocationPercentage || '0') / 100)
    }));
  }

  private async determineObligationType(itemId: string, organizationId?: string): Promise<string> {
    const item = organizationId ? await this.itemRepo.findById(itemId, organizationId) : null;
    
    if (!item) return 'other';
    
    // Business logic to determine obligation type based on item characteristics
    const itemType = item.name?.toLowerCase() || '';
    
    if (itemType.includes('license')) return 'product_license';
    if (itemType.includes('maintenance') || itemType.includes('support')) return 'maintenance_support';
    if (itemType.includes('consulting') || itemType.includes('professional')) return 'professional_services';
    if (itemType.includes('hosting') || itemType.includes('cloud')) return 'hosting_services';
    
    return 'other';
  }

  private async determineSatisfactionMethod(itemId: string, organizationId?: string): Promise<'point_in_time' | 'over_time'> {
    const item = organizationId ? await this.itemRepo.findById(itemId, organizationId) : null;
    
    if (!item) return 'point_in_time';
    
    const itemType = item.name?.toLowerCase() || '';
    
    // ASC 606-10-25-27: Over time criteria
    // 1. Customer simultaneously receives and consumes benefits
    // 2. Customer controls asset as entity creates/enhances it
    // 3. Asset has no alternative use and entity has enforceable right to payment
    
    if (itemType.includes('hosting') || itemType.includes('maintenance') || itemType.includes('support')) {
      return 'over_time'; // Customer simultaneously receives benefits
    }
    
    if (itemType.includes('consulting') || itemType.includes('professional')) {
      return 'over_time'; // No alternative use + enforceable right to payment
    }
    
    return 'point_in_time'; // Default for software licenses, standard products
  }

  private consolidateObligations(obligations: PerformanceObligationResult[]): PerformanceObligationResult[] {
    // Group by itemId and obligation type to consolidate identical obligations
    const consolidated = new Map<string, PerformanceObligationResult>();
    
    for (const obligation of obligations) {
      const key = `${obligation.itemId}-${obligation.obligationType}`;
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.allocatedAmount += obligation.allocatedAmount;
      } else {
        consolidated.set(key, { ...obligation });
      }
    }
    
    return Array.from(consolidated.values());
  }

  private async getCurrentSSP(itemId: string, organizationId: string): Promise<any> {
    // Get the best available SSP evidence for the item
    const evidence = await db.select()
      .from(sspEvidence)
      .where(
        and(
          eq(sspEvidence.organizationId, organizationId),
          eq(sspEvidence.itemId, itemId),
          eq(sspEvidence.isActive, true)
        )
      )
      .orderBy(
        // Priority: standalone_sale > competitor_pricing > cost_plus_margin > market_assessment
        // @ts-ignore - SQL template compatibility
        sql`
          CASE ${sspEvidence.evidenceType}
            WHEN 'standalone_sale' THEN 1
            WHEN 'competitor_pricing' THEN 2
            WHEN 'cost_plus_margin' THEN 3
            WHEN 'market_assessment' THEN 4
          END
        `
      )
      .limit(1);
    
    if (evidence.length > 0) {
      return {
        amount: parseFloat(evidence[0].sspAmount),
        confidence: evidence[0].confidenceLevel
      };
    }
    
    return null;
  }

  private shouldUseResidualApproach(sspValues: any[]): boolean {
    // Use residual approach if SSP is highly variable or uncertain for some items
    return sspValues.some(item => !item.ssp || item.ssp.amount === 0 || item.ssp.confidence === 'low');
  }

  private async allocateUsingResidualApproach(
    obligations: PerformanceObligationResult[],
    transactionPrice: number,
    sspValues: any[]
  ): Promise<PriceAllocation[]> {
    const allocations: PriceAllocation[] = [];
    
    // First allocate to items with reliable SSP
    const reliableSSPItems = sspValues.filter(item => item.ssp && item.ssp.amount > 0 && item.ssp.confidence !== 'low');
    const reliableTotal = reliableSSPItems.reduce((sum, item) => sum + item.ssp.amount, 0);
    
    let remainingAmount = transactionPrice;
    
    // Allocate to reliable SSP items
    for (const item of reliableSSPItems) {
      const allocatedAmount = Math.min(item.ssp.amount, remainingAmount);
      allocations.push({
        itemId: item.itemId,
        sspAmount: item.ssp.amount,
        allocatedAmount,
        allocationPercentage: allocatedAmount / transactionPrice,
        allocationMethod: 'ssp_proportional'
      });
      remainingAmount -= allocatedAmount;
    }
    
    // Allocate residual to items without reliable SSP
    const unreliableItems = sspValues.filter(item => !item.ssp || item.ssp.amount === 0 || item.ssp.confidence === 'low');
    if (unreliableItems.length > 0) {
      const residualPerItem = remainingAmount / unreliableItems.length;
      for (const item of unreliableItems) {
        allocations.push({
          itemId: item.itemId,
          sspAmount: 0,
          allocatedAmount: residualPerItem,
          allocationPercentage: residualPerItem / transactionPrice,
          allocationMethod: 'residual'
        });
      }
    }
    
    return allocations;
  }

  private handleRoundingDifferences(allocations: PriceAllocation[], transactionPrice: number): PriceAllocation[] {
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const difference = transactionPrice - totalAllocated;
    
    if (Math.abs(difference) > 0.01) {
      // Apply difference to largest allocation
      const largestAllocation = allocations.reduce((max, a) => 
        a.allocatedAmount > max.allocatedAmount ? a : max
      );
      largestAllocation.allocatedAmount += difference;
      largestAllocation.allocationPercentage = largestAllocation.allocatedAmount / transactionPrice;
    }
    
    return allocations;
  }

  private async estimateVariableConsideration(contract: any): Promise<number> {
    // Estimate variable components like discounts, rebates, performance bonuses
    // Using expected value or most likely amount method
    return 0; // Simplified for now
  }

  private async applyConstraint(transactionPrice: number, contract: any): Promise<number> {
    // Only include variable consideration that is highly probable not to reverse
    return transactionPrice;
  }

  private async adjustForFinancingComponent(transactionPrice: number, contract: any): Promise<number> {
    // Adjust for time value of money if payment terms > 1 year
    const paymentTerms = contract.paymentTerms || 30;
    if (paymentTerms > 365) {
      // Apply discount rate
      const discountRate = 0.05; // 5% annual
      const years = paymentTerms / 365;
      return transactionPrice / Math.pow(1 + discountRate, years);
    }
    return transactionPrice;
  }

  private async calculateConsiderationPayableToCustomer(contract: any): Promise<number> {
    // Calculate any amounts payable to customer (credits, refunds, etc.)
    return 0; // Simplified for now
  }

  private async determineRecognitionPattern(obligation: PerformanceObligationResult): Promise<string> {
    // Determine how revenue should be recognized over time
    if (obligation.satisfactionMethod === 'over_time') {
      // Default to straight-line for most over-time obligations
      return 'straight_line';
    }
    return 'immediate';
  }

  private async generateOverTimeSchedules(
    allocation: PriceAllocation,
    obligation: PerformanceObligationResult,
    pattern: string
  ): Promise<RevenueScheduleResult[]> {
    const schedules: RevenueScheduleResult[] = [];
    
    const startDate = new Date(obligation.startDate);
    const endDate = new Date(obligation.endDate);
    const totalMonths = this.getMonthsDifference(startDate, endDate);
    const monthlyAmount = allocation.allocatedAmount / totalMonths;
    
    for (let month = 0; month < totalMonths; month++) {
      const periodStart = new Date(startDate);
      periodStart.setMonth(periodStart.getMonth() + month);
      
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
      
      schedules.push({
        performanceObligationId: obligation.id,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        scheduledAmount: monthlyAmount,
        recognitionPattern: pattern as any,
        status: 'scheduled'
      });
    }
    
    return schedules;
  }

  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = endDate.getMonth() - startDate.getMonth();
    return yearsDiff * 12 + monthsDiff + 1;
  }

  private async generateASC605Comparison(contract: any, asc606Revenue: number): Promise<ASC605Comparison> {
    // Calculate what revenue would be under ASC 605 (simpler model)
    const asc605Revenue = parseFloat(contract.contractValue);
    const difference = asc606Revenue - asc605Revenue;
    const percentageChange = asc605Revenue !== 0 ? (difference / asc605Revenue) * 100 : 0;
    
    return {
      asc605Revenue,
      asc606Revenue,
      difference,
      percentageChange
    };
  }

  private isModificationSeparateContract(modification: ContractModification): boolean {
    // Determine if modification should be treated as separate contract
    // Based on ASC 606-10-25-12: distinct goods/services and price reflects SSP
    return modification.newSubscriptionId !== undefined;
  }

  private async getExistingCalculation(subscriptionId: string, organizationId: string): Promise<any> {
    // Get existing calculation results from database
    const obligations = await db.select()
      .from(performanceObligations)
      .where(
        and(
          eq(performanceObligations.subscriptionId, subscriptionId),
          eq(performanceObligations.organizationId, organizationId)
        )
      );
    
    return obligations;
  }

  private async recalculateExistingContract(
    subscriptionId: string,
    organizationId: string,
    modificationDate: Date,
    modificationDetails: ContractModification
  ): Promise<CalculationResult> {
    // Implement cumulative catch-up method for contract modifications
    // This would recalculate from inception with new terms
    return this.calculate({
      subscriptionId,
      organizationId,
      calculationType: 'modification',
      effectiveDate: modificationDate,
      options: { forceRecalculation: true }
    });
  }

  private async saveCalculationResults(
    subscriptionId: string,
    organizationId: string,
    results: any
  ): Promise<void> {
    // Save performance obligations
    for (const obligation of results.performanceObligations) {
      const [created] = await db.insert(performanceObligations)
        .values({
          organizationId,
          subscriptionId,
          itemId: obligation.itemId,
          obligationType: obligation.obligationType as any,
          satisfactionMethod: obligation.satisfactionMethod as any,
          satisfactionPeriodMonths: obligation.satisfactionPeriodMonths,
          allocatedAmount: String(obligation.allocatedAmount),
          startDate: obligation.startDate.toISOString().split('T')[0],
          endDate: obligation.endDate ? obligation.endDate.toISOString().split('T')[0] : null,
          status: 'active'
        })
        .returning();
      
      obligation.id = created.id;
    }
    
    // Save SSP allocations
    for (let i = 0; i < results.allocations.length; i++) {
      const allocation = results.allocations[i];
      const obligationId = results.performanceObligations[i]?.id;
      
      if (obligationId) {
        await db.insert(contractSspAllocations)
          .values({
            organizationId,
            subscriptionId,
            performanceObligationId: obligationId,
            sspAmount: String(allocation.sspAmount),
            allocatedAmount: String(allocation.allocatedAmount),
            allocationPercentage: String(allocation.allocationPercentage),
            allocationMethod: allocation.allocationMethod as any
          });
      }
    }
    
    // Save revenue schedules
    for (const schedule of results.schedules) {
      await db.insert(revenueSchedules)
        .values({
          organizationId,
          performanceObligationId: schedule.performanceObligationId!,
          periodStartDate: schedule.periodStartDate.toISOString().split('T')[0],
          periodEndDate: schedule.periodEndDate.toISOString().split('T')[0],
          scheduledAmount: String(schedule.scheduledAmount),
          recognizedAmount: '0',
          recognitionDate: null,
          recognitionPattern: schedule.recognitionPattern as any,
          status: schedule.status as any
        });
    }
  }
}