# TASK-010: Revenue Reporting Engine

## Description
Implement comprehensive revenue reporting engine that generates key financial metrics (ARR, MRR, deferred balance), revenue waterfalls, and ASC 605 vs 606 comparison reports for management and compliance purposes.

## Acceptance Criteria
- [ ] ARR (Annual Recurring Revenue) calculation engine
- [ ] MRR (Monthly Recurring Revenue) calculation with cohort analysis
- [ ] Deferred revenue balance tracking and aging
- [ ] Revenue waterfall analysis for period-over-period changes
- [ ] ASC 605 vs 606 comparison reporting
- [ ] Revenue summary reports with multiple grouping options
- [ ] Performance obligation aging and satisfaction reports
- [ ] Real-time dashboard metrics calculation
- [ ] Unit tests for all calculation methods
- [ ] Performance optimization for large datasets

## Dependencies
- TASK-003: Revenue recognition database schema
- TASK-009: Revenue calculation engine

## Estimated Effort
3 days

## Technical Implementation

### Core Reporting Service
```typescript
// packages/business/src/services/revenue-reporting-service.ts
import { Database } from '@glapi/database';

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export interface ARRCalculation {
  totalARR: number;
  newARR: number;
  expansionARR: number;
  contractionARR: number;
  churnARR: number;
  netARRGrowth: number;
  arrByCustomer: CustomerARR[];
  arrByProduct: ProductARR[];
}

export interface MRRCalculation {
  totalMRR: number;
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnMRR: number;
  netMRRGrowth: number;
  mrrCohorts: MRRCohort[];
}

export interface DeferredBalanceReport {
  totalDeferred: number;
  currentPortion: number; // Due within 12 months
  longTermPortion: number; // Due after 12 months
  deferredByCustomer: CustomerDeferred[];
  agingBuckets: DeferredAging[];
  expectedRecognitionSchedule: ExpectedRecognition[];
}

export class RevenueReportingService {
  constructor(
    private db: Database,
    private organizationId: string
  ) {}

  // ARR Calculation
  async calculateARR(asOfDate?: Date, entityId?: string): Promise<ARRCalculation> {
    const calculationDate = asOfDate || new Date();
    const startOfYear = new Date(calculationDate.getFullYear(), 0, 1);
    
    // Get all active subscriptions as of date
    const activeSubscriptions = await this.getActiveSubscriptions(calculationDate, entityId);
    
    // Calculate total ARR
    let totalARR = 0;
    const arrByCustomer: CustomerARR[] = [];
    const arrByProduct: ProductARR[] = [];
    
    for (const subscription of activeSubscriptions) {
      const subscriptionARR = await this.calculateSubscriptionARR(subscription, calculationDate);
      totalARR += subscriptionARR.annualValue;
      
      // Group by customer
      const customerIndex = arrByCustomer.findIndex(c => c.entityId === subscription.entityId);
      if (customerIndex >= 0) {
        arrByCustomer[customerIndex].arr += subscriptionARR.annualValue;
      } else {
        arrByCustomer.push({
          entityId: subscription.entityId,
          customerName: subscription.customerName,
          arr: subscriptionARR.annualValue,
          subscriptionCount: 1
        });
      }
      
      // Group by product
      for (const item of subscription.items) {
        const productIndex = arrByProduct.findIndex(p => p.itemId === item.itemId);
        const itemARR = subscriptionARR.itemBreakdown.find(i => i.itemId === item.itemId)?.annualValue || 0;
        
        if (productIndex >= 0) {
          arrByProduct[productIndex].arr += itemARR;
        } else {
          arrByProduct.push({
            itemId: item.itemId,
            productName: item.productName,
            arr: itemARR,
            subscriptionCount: 1
          });
        }
      }
    }
    
    // Calculate ARR movements
    const movements = await this.calculateARRMovements(startOfYear, calculationDate, entityId);
    
    return {
      totalARR,
      newARR: movements.newARR,
      expansionARR: movements.expansionARR,
      contractionARR: movements.contractionARR,
      churnARR: movements.churnARR,
      netARRGrowth: movements.newARR + movements.expansionARR - movements.contractionARR - movements.churnARR,
      arrByCustomer: arrByCustomer.sort((a, b) => b.arr - a.arr),
      arrByProduct: arrByProduct.sort((a, b) => b.arr - a.arr)
    };
  }

  // MRR Calculation with Cohort Analysis
  async calculateMRR(forMonth?: Date, entityId?: string): Promise<MRRCalculation> {
    const targetMonth = forMonth || new Date();
    const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    
    // Get revenue schedules for the month
    const monthlySchedules = await this.db
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, this.organizationId),
          gte(revenueSchedules.periodStartDate, startOfMonth),
          lte(revenueSchedules.periodEndDate, endOfMonth),
          entityId ? eq(subscriptions.entityId, entityId) : undefined
        )
      )
      .leftJoin(performanceObligations, eq(performanceObligations.id, revenueSchedules.performanceObligationId))
      .leftJoin(subscriptions, eq(subscriptions.id, performanceObligations.subscriptionId));
    
    let totalMRR = 0;
    const customerMRR: { [entityId: string]: number } = {};
    
    for (const schedule of monthlySchedules) {
      // Annualize and then convert to monthly
      const monthlyAmount = this.annualizeAndMonthlyConvert(
        schedule.revenue_schedules.scheduledAmount,
        schedule.performance_obligations.satisfactionMethod
      );
      
      totalMRR += monthlyAmount;
      
      if (schedule.subscriptions?.entityId) {
        customerMRR[schedule.subscriptions.entityId] = 
          (customerMRR[schedule.subscriptions.entityId] || 0) + monthlyAmount;
      }
    }
    
    // Calculate MRR movements
    const previousMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1);
    const previousMRR = await this.calculateMRR(previousMonth, entityId);
    
    const movements = await this.calculateMRRMovements(previousMonth, targetMonth, entityId);
    const cohorts = await this.generateMRRCohorts(targetMonth, entityId);
    
    return {
      totalMRR,
      newMRR: movements.newMRR,
      expansionMRR: movements.expansionMRR,
      contractionMRR: movements.contractionMRR,
      churnMRR: movements.churnMRR,
      netMRRGrowth: totalMRR - previousMRR.totalMRR,
      mrrCohorts: cohorts
    };
  }

  // Deferred Revenue Balance
  async getDeferredBalance(asOfDate?: Date): Promise<DeferredBalanceReport> {
    const balanceDate = asOfDate || new Date();
    const twelveMonthsOut = new Date(balanceDate.getFullYear() + 1, balanceDate.getMonth(), balanceDate.getDate());
    
    // Get all unrecognized revenue schedules
    const deferredSchedules = await this.db
      .select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, this.organizationId),
          gte(revenueSchedules.periodStartDate, balanceDate),
          or(
            eq(revenueSchedules.status, 'scheduled'),
            eq(revenueSchedules.status, 'deferred')
          )
        )
      )
      .leftJoin(performanceObligations, eq(performanceObligations.id, revenueSchedules.performanceObligationId))
      .leftJoin(subscriptions, eq(subscriptions.id, performanceObligations.subscriptionId));
    
    let totalDeferred = 0;
    let currentPortion = 0;
    let longTermPortion = 0;
    
    const deferredByCustomer: { [entityId: string]: CustomerDeferred } = {};
    const agingBuckets: DeferredAging[] = [
      { period: '0-30 days', amount: 0 },
      { period: '31-90 days', amount: 0 },
      { period: '91-365 days', amount: 0 },
      { period: '1-2 years', amount: 0 },
      { period: '2+ years', amount: 0 }
    ];
    
    for (const schedule of deferredSchedules) {
      const amount = schedule.revenue_schedules.scheduledAmount - schedule.revenue_schedules.recognizedAmount;
      totalDeferred += amount;
      
      // Classify as current vs long-term
      if (schedule.revenue_schedules.periodStartDate <= twelveMonthsOut) {
        currentPortion += amount;
      } else {
        longTermPortion += amount;
      }
      
      // Group by customer
      if (schedule.subscriptions?.entityId) {
        const entityId = schedule.subscriptions.entityId;
        if (!deferredByCustomer[entityId]) {
          deferredByCustomer[entityId] = {
            entityId,
            customerName: schedule.subscriptions.customerName,
            deferredAmount: 0,
            scheduleCount: 0
          };
        }
        deferredByCustomer[entityId].deferredAmount += amount;
        deferredByCustomer[entityId].scheduleCount += 1;
      }
      
      // Age the deferred amounts
      const daysToRecognition = Math.floor(
        (schedule.revenue_schedules.periodStartDate.getTime() - balanceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysToRecognition <= 30) agingBuckets[0].amount += amount;
      else if (daysToRecognition <= 90) agingBuckets[1].amount += amount;
      else if (daysToRecognition <= 365) agingBuckets[2].amount += amount;
      else if (daysToRecognition <= 730) agingBuckets[3].amount += amount;
      else agingBuckets[4].amount += amount;
    }
    
    // Generate expected recognition schedule
    const expectedRecognitionSchedule = await this.generateExpectedRecognitionSchedule(balanceDate);
    
    return {
      totalDeferred,
      currentPortion,
      longTermPortion,
      deferredByCustomer: Object.values(deferredByCustomer).sort((a, b) => b.deferredAmount - a.deferredAmount),
      agingBuckets,
      expectedRecognitionSchedule
    };
  }

  // Revenue Waterfall Analysis
  async getRevenueWaterfall(params: {
    startDate: Date;
    endDate: Date;
    compareToASC605?: boolean;
  }): Promise<RevenueWaterfallReport> {
    const { startDate, endDate, compareToASC605 = false } = params;
    
    // Get recognized revenue for the period
    const recognizedRevenue = await this.getRecognizedRevenue(startDate, endDate);
    
    // Get deferred revenue movements
    const deferredMovements = await this.getDeferredRevenueMovements(startDate, endDate);
    
    // Calculate waterfall components
    const waterfall: RevenueWaterfallComponent[] = [
      {
        component: 'Beginning Deferred Revenue',
        amount: deferredMovements.beginningBalance,
        type: 'opening'
      },
      {
        component: 'New Bookings',
        amount: deferredMovements.newBookings,
        type: 'addition'
      },
      {
        component: 'Revenue Recognized',
        amount: -recognizedRevenue.totalRecognized,
        type: 'subtraction'
      },
      {
        component: 'Contract Modifications',
        amount: deferredMovements.modifications,
        type: 'adjustment'
      },
      {
        component: 'Ending Deferred Revenue',
        amount: deferredMovements.endingBalance,
        type: 'closing'
      }
    ];
    
    let asc605Comparison;
    if (compareToASC605) {
      asc605Comparison = await this.generateASC605RevenueComparison(startDate, endDate);
    }
    
    return {
      period: { startDate, endDate },
      waterfall,
      totalRecognizedRevenue: recognizedRevenue.totalRecognized,
      asc605Comparison,
      keyMetrics: {
        recognitionRate: recognizedRevenue.totalRecognized / deferredMovements.totalAvailableForRecognition,
        averageDaysToRecognition: await this.calculateAverageDaysToRecognition(startDate, endDate)
      }
    };
  }

  // ASC 605 vs 606 Comparison
  async compareASC605vs606(
    subscriptionId: string,
    comparisonDate?: Date
  ): Promise<ASC605vs606Comparison> {
    const comparison = comparisonDate || new Date();
    
    // Get ASC 606 calculation (current system)
    const asc606Recognition = await this.getASC606Recognition(subscriptionId, comparison);
    
    // Simulate ASC 605 calculation
    const asc605Recognition = await this.simulateASC605Recognition(subscriptionId, comparison);
    
    const totalDifference = asc606Recognition.totalRecognized - asc605Recognition.totalRecognized;
    const percentageDifference = (totalDifference / asc605Recognition.totalRecognized) * 100;
    
    return {
      subscriptionId,
      comparisonDate: comparison,
      asc605: {
        totalRecognized: asc605Recognition.totalRecognized,
        recognitionPattern: 'straight_line_contract_term',
        keyAssumptions: asc605Recognition.assumptions
      },
      asc606: {
        totalRecognized: asc606Recognition.totalRecognized,
        recognitionPattern: 'performance_obligation_based',
        keyAssumptions: asc606Recognition.assumptions
      },
      variance: {
        amount: totalDifference,
        percentage: percentageDifference,
        explanation: this.explainVariance(asc605Recognition, asc606Recognition)
      },
      impactAnalysis: await this.analyzeImpactOfStandardChange(subscriptionId)
    };
  }

  // Helper Methods
  private async calculateSubscriptionARR(subscription: Subscription, asOfDate: Date): Promise<SubscriptionARR> {
    // Convert subscription value to annual recurring revenue
    const termMonths = this.calculateTermMonths(subscription.startDate, subscription.endDate);
    const annualValue = (subscription.contractValue / termMonths) * 12;
    
    const itemBreakdown: ItemARR[] = [];
    for (const item of subscription.items) {
      const itemAnnualValue = ((item.unitPrice * item.quantity) / termMonths) * 12;
      itemBreakdown.push({
        itemId: item.itemId,
        annualValue: itemAnnualValue
      });
    }
    
    return {
      subscriptionId: subscription.id,
      annualValue,
      itemBreakdown
    };
  }

  private explainVariance(asc605: any, asc606: any): string[] {
    const explanations: string[] = [];
    
    if (asc605.recognitionPattern === 'straight_line' && asc606.hasMultipleObligations) {
      explanations.push('ASC 606 recognizes revenue based on separate performance obligations vs. straight-line contract recognition under ASC 605');
    }
    
    if (asc606.hasPointInTimeObligations) {
      explanations.push('Some performance obligations are satisfied at a point in time under ASC 606, accelerating recognition');
    }
    
    if (asc606.hasVariablePricing) {
      explanations.push('ASC 606 includes variable consideration in transaction price, subject to constraint');
    }
    
    return explanations;
  }
}
```

### Test Requirements

#### Unit Tests
```typescript
describe('Revenue Reporting Service', () => {
  describe('calculateARR', () => {
    it('should calculate total ARR correctly', async () => {
      // Test ARR calculation
    });
    
    it('should group ARR by customer and product', async () => {
      // Test grouping logic
    });
    
    it('should calculate ARR movements', async () => {
      // Test new, expansion, contraction, churn
    });
  });

  describe('calculateMRR', () => {
    it('should calculate monthly recurring revenue', async () => {
      // Test MRR calculation
    });
    
    it('should handle different billing frequencies', async () => {
      // Test quarterly, annual conversion to monthly
    });
    
    it('should generate cohort analysis', async () => {
      // Test cohort tracking
    });
  });

  describe('getDeferredBalance', () => {
    it('should calculate total deferred revenue', async () => {
      // Test deferred balance calculation
    });
    
    it('should separate current vs long-term portions', async () => {
      // Test balance sheet classification
    });
    
    it('should age deferred revenue correctly', async () => {
      // Test aging buckets
    });
  });

  describe('compareASC605vs606', () => {
    it('should identify revenue recognition differences', async () => {
      // Test comparison logic
    });
    
    it('should explain variances clearly', async () => {
      // Test variance explanation
    });
  });
});
```

### Files to Create
- `packages/business/src/services/revenue-reporting-service.ts`
- `packages/business/src/types/revenue-reporting-types.ts`
- `packages/business/src/utils/arr-calculations.ts`
- `packages/business/src/utils/mrr-calculations.ts`
- `packages/business/src/services/__tests__/revenue-reporting-service.test.ts`

### Definition of Done
- [ ] All key metrics (ARR, MRR, deferred balance) calculate correctly
- [ ] Revenue waterfall analysis provides clear period insights
- [ ] ASC 605 vs 606 comparison highlights key differences
- [ ] Performance optimized for large datasets
- [ ] Real-time metrics supported
- [ ] Unit tests cover all calculation scenarios
- [ ] Error handling for edge cases
- [ ] Dashboard integration ready