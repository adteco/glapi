# TASK-009: Revenue Calculation Engine Implementation

## Description
Implement the core ASC 606 revenue calculation engine that handles the 5-step revenue recognition process, including contract identification, performance obligation analysis, transaction price determination, allocation, and schedule generation.

## Acceptance Criteria
- [ ] ASC 606 5-step calculation engine implemented
- [ ] Performance obligation identification logic
- [ ] Transaction price determination with variable consideration
- [ ] SSP-based price allocation algorithms
- [ ] Revenue schedule generation for different patterns
- [ ] Contract modification handling
- [ ] Comprehensive unit tests for all calculation scenarios
- [ ] Integration tests with database
- [ ] Performance optimization for large contracts
- [ ] Error handling for edge cases

## Dependencies
- TASK-003: Revenue recognition database schema
- TASK-004: Kit components schema (for bundle processing)

## Estimated Effort
4 days

## Technical Implementation

### Core Calculation Engine
```typescript
// packages/business/src/services/revenue-calculation-engine.ts
import { Database } from '@glapi/database';
import { SubscriptionRepository, PerformanceObligationRepository } from '@glapi/database';

export interface CalculationParams {
  subscriptionId: string;
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
  performanceObligations: PerformanceObligation[];
  allocations: PriceAllocation[];
  schedules: RevenueSchedule[];
  comparisonToASC605?: ASC605Comparison;
}

export class RevenueCalculationEngine {
  constructor(
    private db: Database,
    private subscriptionRepo: SubscriptionRepository,
    private performanceObligationRepo: PerformanceObligationRepository,
    private sspService: SSPService,
    private kitService: KitService
  ) {}

  async calculate(params: CalculationParams): Promise<CalculationResult> {
    // Step 1: Identify the contract
    const contract = await this.identifyContract(params.subscriptionId);
    
    // Step 2: Identify performance obligations
    const obligations = await this.identifyPerformanceObligations(contract);
    
    // Step 3: Determine transaction price
    const transactionPrice = await this.determineTransactionPrice(contract);
    
    // Step 4: Allocate price to performance obligations
    const allocations = await this.allocatePrice(obligations, transactionPrice);
    
    // Step 5: Generate revenue schedules
    const schedules = await this.generateRevenueSchedules(allocations, contract);
    
    // Save results to database (unless dry run)
    if (!params.options?.dryRun) {
      await this.saveCalculationResults(params.subscriptionId, {
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
      comparisonToASC605: await this.generateASC605Comparison(contract)
    };
  }

  // Step 1: Identify the Contract
  private async identifyContract(subscriptionId: string): Promise<Contract> {
    const subscription = await this.subscriptionRepo.findWithItemsById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    
    // Validate contract enforceability
    if (!this.isContractEnforceable(subscription)) {
      throw new Error('Contract is not enforceable for revenue recognition');
    }
    
    return this.mapSubscriptionToContract(subscription);
  }

  // Step 2: Identify Performance Obligations
  private async identifyPerformanceObligations(contract: Contract): Promise<PerformanceObligation[]> {
    const obligations: PerformanceObligation[] = [];
    
    for (const item of contract.items) {
      if (await this.isKitItem(item.itemId)) {
        // Explode kit items into components
        const components = await this.kitService.explodeKit(item.itemId, item.unitPrice * item.quantity);
        for (const component of components) {
          obligations.push({
            itemId: component.componentItemId,
            obligationType: await this.determineObligationType(component.componentItemId),
            satisfactionMethod: await this.determineSatisfactionMethod(component.componentItemId),
            allocatedAmount: 0, // Set in step 4
            startDate: item.startDate,
            endDate: item.endDate
          });
        }
      } else {
        // Regular item - single performance obligation
        obligations.push({
          itemId: item.itemId,
          obligationType: await this.determineObligationType(item.itemId),
          satisfactionMethod: await this.determineSatisfactionMethod(item.itemId),
          allocatedAmount: 0, // Set in step 4
          startDate: item.startDate,
          endDate: item.endDate
        });
      }
    }
    
    return this.consolidateObligations(obligations);
  }

  // Step 3: Determine Transaction Price
  private async determineTransactionPrice(contract: Contract): Promise<number> {
    let transactionPrice = contract.contractValue;
    
    // Handle variable consideration
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
    obligations: PerformanceObligation[],
    transactionPrice: number
  ): Promise<PriceAllocation[]> {
    const allocations: PriceAllocation[] = [];
    
    // Get SSP for each obligation
    const sspValues = await Promise.all(
      obligations.map(async (obligation) => ({
        obligationId: obligation.id,
        itemId: obligation.itemId,
        ssp: await this.sspService.getCurrentSSP(obligation.itemId)
      }))
    );
    
    // Calculate total SSP
    const totalSSP = sspValues.reduce((sum, item) => sum + item.ssp.amount, 0);
    
    // Handle residual approach if SSP not available for some items
    if (this.shouldUseResidualApproach(sspValues)) {
      return this.allocateUsingResidualApproach(obligations, transactionPrice, sspValues);
    }
    
    // Standard proportional allocation
    for (const sspValue of sspValues) {
      const allocationPercentage = sspValue.ssp.amount / totalSSP;
      const allocatedAmount = transactionPrice * allocationPercentage;
      
      allocations.push({
        performanceObligationId: sspValue.obligationId,
        itemId: sspValue.itemId,
        sspAmount: sspValue.ssp.amount,
        allocatedAmount,
        allocationPercentage,
        allocationMethod: 'ssp_proportional'
      });
    }
    
    // Handle rounding differences
    return this.handleRoundingDifferences(allocations, transactionPrice);
  }

  // Step 5: Generate Revenue Schedules
  private async generateRevenueSchedules(
    allocations: PriceAllocation[],
    contract: Contract
  ): Promise<RevenueSchedule[]> {
    const schedules: RevenueSchedule[] = [];
    
    for (const allocation of allocations) {
      const obligation = await this.getPerformanceObligation(allocation.performanceObligationId);
      
      if (obligation.satisfactionMethod === 'point_in_time') {
        // Recognize immediately when control transfers
        schedules.push({
          performanceObligationId: allocation.performanceObligationId,
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
    modificationDate: Date,
    modificationDetails: ContractModification
  ): Promise<CalculationResult> {
    const existingCalculation = await this.getExistingCalculation(subscriptionId);
    
    if (this.isModificationSeparateContract(modificationDetails)) {
      // Treat as separate contract
      return this.calculate({
        subscriptionId: modificationDetails.newSubscriptionId,
        calculationType: 'initial',
        effectiveDate: modificationDate
      });
    } else {
      // Modify existing contract
      return this.recalculateExistingContract(
        subscriptionId,
        modificationDate,
        modificationDetails
      );
    }
  }

  // Helper Methods
  private isContractEnforceable(subscription: Subscription): boolean {
    return subscription.status !== 'draft' && 
           subscription.contractValue > 0 &&
           subscription.items.length > 0;
  }

  private async determineObligationType(itemId: string): Promise<ObligationType> {
    const item = await this.getItemDetails(itemId);
    
    // Business logic to determine obligation type based on item characteristics
    if (item.type === 'software_license') return 'product_license';
    if (item.type === 'maintenance') return 'maintenance_support';
    if (item.type === 'consulting') return 'professional_services';
    if (item.type === 'hosting') return 'hosting_services';
    
    return 'other';
  }

  private async determineSatisfactionMethod(itemId: string): Promise<SatisfactionMethod> {
    const item = await this.getItemDetails(itemId);
    
    // ASC 606-10-25-27: Over time criteria
    // 1. Customer simultaneously receives and consumes benefits
    // 2. Customer controls asset as entity creates/enhances it
    // 3. Asset has no alternative use and entity has enforceable right to payment
    
    if (item.type === 'hosting_services' || item.type === 'maintenance') {
      return 'over_time'; // Customer simultaneously receives benefits
    }
    
    if (item.type === 'professional_services' && item.customized) {
      return 'over_time'; // No alternative use + enforceable right to payment
    }
    
    return 'point_in_time'; // Default for software licenses, standard products
  }
}
```

### Test Requirements

#### Unit Tests
```typescript
describe('Revenue Calculation Engine', () => {
  describe('identifyContract', () => {
    it('should identify valid contract from subscription', async () => {
      // Test contract identification
    });
    
    it('should reject unenforceable contracts', async () => {
      // Test validation
    });
  });

  describe('identifyPerformanceObligations', () => {
    it('should identify single obligation for simple item', async () => {
      // Test basic obligation identification
    });
    
    it('should explode kit items into component obligations', async () => {
      // Test kit handling
    });
    
    it('should consolidate identical obligations', async () => {
      // Test consolidation logic
    });
  });

  describe('allocatePrice', () => {
    it('should allocate based on SSP proportionally', async () => {
      // Test standard allocation
    });
    
    it('should use residual approach when appropriate', async () => {
      // Test residual allocation
    });
    
    it('should handle rounding differences', async () => {
      // Test rounding
    });
  });

  describe('generateRevenueSchedules', () => {
    it('should create immediate schedule for point-in-time obligations', async () => {
      // Test immediate recognition
    });
    
    it('should create periodic schedules for over-time obligations', async () => {
      // Test over-time recognition
    });
    
    it('should handle different recognition patterns', async () => {
      // Test various patterns
    });
  });

  describe('handleContractModification', () => {
    it('should handle modification as separate contract when appropriate', async () => {
      // Test separate contract logic
    });
    
    it('should recalculate existing contract for cumulative catch-up', async () => {
      // Test modification handling
    });
  });
});
```

#### Integration Tests
```typescript
describe('Revenue Engine Integration', () => {
  it('should handle complete calculation lifecycle', async () => {
    // End-to-end test with database
  });
  
  it('should persist calculation results correctly', async () => {
    // Test database integration
  });
  
  it('should handle large contracts efficiently', async () => {
    // Performance test
  });
});
```

### Files to Create
- `packages/business/src/services/revenue-calculation-engine.ts`
- `packages/business/src/services/ssp-service.ts`
- `packages/business/src/services/kit-service.ts`
- `packages/business/src/types/revenue-calculation-types.ts`
- `packages/business/src/services/__tests__/revenue-calculation-engine.test.ts`
- `packages/business/src/utils/asc606-helpers.ts`

### Definition of Done
- [ ] All 5 steps of ASC 606 implemented correctly
- [ ] Kit/bundle explosion working
- [ ] SSP allocation algorithms tested
- [ ] Contract modification handling complete
- [ ] Performance optimized for large datasets
- [ ] Error handling covers edge cases
- [ ] Unit tests achieve >90% coverage
- [ ] Integration tests verify database persistence
- [ ] ASC 605 comparison functionality working