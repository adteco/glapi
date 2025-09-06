import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import { 
  SubscriptionRepository,
  SubscriptionItemRepository,
  InvoiceRepository,
  db
} from '@glapi/database';
import { 
  performanceObligations,
  revenueSchedules,
  contractSspAllocations,
  revenueJournalEntries,
  type PerformanceObligation,
  type RevenueSchedule,
  type NewPerformanceObligation,
  type NewRevenueSchedule
} from '@glapi/database/src/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface CalculateRevenueOptions {
  forceRecalculation?: boolean;
  includeHistorical?: boolean;
}

export interface RevenueCalculationResult {
  subscriptionId: string;
  performanceObligations: Array<{
    itemId: string;
    obligationType: string;
    allocatedAmount: number;
    satisfactionMethod: string;
    satisfactionPeriodMonths?: number;
  }>;
  totalContractValue: number;
  recognitionPattern: string;
  schedules: Array<{
    periodStart: string;
    periodEnd: string;
    amount: number;
  }>;
}

export interface ListPerformanceObligationsInput {
  subscriptionId?: string;
  status?: 'active' | 'satisfied' | 'cancelled';
  obligationType?: string;
  page?: number;
  limit?: number;
}

export interface ListRevenueSchedulesInput {
  subscriptionId?: string;
  performanceObligationId?: string;
  status?: 'scheduled' | 'recognized' | 'deferred' | 'cancelled';
  periodStart?: Date | string;
  periodEnd?: Date | string;
  page?: number;
  limit?: number;
}

export interface RevenueSummaryInput {
  startDate: Date | string;
  endDate: Date | string;
  groupBy?: 'month' | 'quarter' | 'year';
  entityId?: string;
}

export interface RevenueWaterfallInput {
  startDate: Date | string;
  endDate: Date | string;
  compareToASC605?: boolean;
}

export class RevenueService extends BaseService {
  private subscriptionRepository: SubscriptionRepository;
  private subscriptionItemRepository: SubscriptionItemRepository;
  private invoiceRepository: InvoiceRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.subscriptionRepository = new SubscriptionRepository();
    this.subscriptionItemRepository = new SubscriptionItemRepository();
    this.invoiceRepository = new InvoiceRepository();
  }

  async calculateRevenue(
    subscriptionId: string,
    calculationType: 'initial' | 'modification' | 'renewal' | 'termination',
    effectiveDate: Date | string,
    options: CalculateRevenueOptions = {}
  ): Promise<RevenueCalculationResult> {
    const organizationId = this.requireOrganizationContext();
    
    // Step 1: Identify the contract (subscription)
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // Step 2: Identify performance obligations
    const obligations = await this.identifyPerformanceObligations(subscription);
    
    // Step 3: Determine transaction price
    const totalContractValue = this.calculateTotalContractValue(subscription);
    
    // Step 4: Allocate price to performance obligations using SSP
    const allocatedObligations = await this.allocatePriceToObligations(
      obligations,
      totalContractValue,
      subscriptionId
    );
    
    // Step 5: Create revenue schedules based on satisfaction method
    const schedules = await this.createRevenueSchedules(
      allocatedObligations,
      subscription,
      effectiveDate
    );
    
    return {
      subscriptionId,
      performanceObligations: allocatedObligations.map(o => ({
        itemId: o.itemId,
        obligationType: o.obligationType,
        allocatedAmount: parseFloat(o.allocatedAmount),
        satisfactionMethod: o.satisfactionMethod,
        satisfactionPeriodMonths: o.satisfactionPeriodMonths || undefined
      })),
      totalContractValue,
      recognitionPattern: 'straight_line', // Simplified for now
      schedules: schedules.map(s => ({
        periodStart: s.periodStartDate,
        periodEnd: s.periodEndDate,
        amount: parseFloat(s.scheduledAmount)
      }))
    };
  }

  async getPerformanceObligations(input: ListPerformanceObligationsInput = {}): Promise<PaginatedResult<PerformanceObligation>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);
    
    const conditions = [eq(performanceObligations.organizationId, organizationId)];
    
    if (input.subscriptionId) {
      conditions.push(eq(performanceObligations.subscriptionId, input.subscriptionId));
    }
    
    if (input.status) {
      conditions.push(eq(performanceObligations.status, input.status));
    }
    
    if (input.obligationType) {
      conditions.push(eq(performanceObligations.obligationType, input.obligationType as any));
    }
    
    const whereClause = and(...conditions);
    
    const [data, totalResult] = await Promise.all([
      db.select()
        .from(performanceObligations)
        .where(whereClause)
        .orderBy(desc(performanceObligations.createdAt))
        .limit(take)
        .offset(skip),
      db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(performanceObligations)
        .where(whereClause)
    ]);
    
    return this.createPaginatedResult(data, totalResult[0].count, page, limit);
  }

  async getPerformanceObligationById(id: string): Promise<PerformanceObligation | null> {
    const organizationId = this.requireOrganizationContext();
    
    const [result] = await db.select()
      .from(performanceObligations)
      .where(
        and(
          eq(performanceObligations.id, id),
          eq(performanceObligations.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }

  async satisfyPerformanceObligation(
    id: string,
    satisfactionDate: Date | string,
    satisfactionEvidence?: string
  ): Promise<PerformanceObligation> {
    const organizationId = this.requireOrganizationContext();
    
    const obligation = await this.getPerformanceObligationById(id);
    if (!obligation) {
      throw new ServiceError('Performance obligation not found', 'NOT_FOUND', 404);
    }
    
    if (obligation.status !== 'active') {
      throw new ServiceError('Can only satisfy active obligations', 'INVALID_STATUS', 400);
    }
    
    // Update obligation status
    const [updated] = await db.update(performanceObligations)
      .set({
        status: 'satisfied',
        endDate: typeof satisfactionDate === 'string' ? satisfactionDate : satisfactionDate.toISOString().split('T')[0],
        updatedAt: new Date()
      })
      .where(eq(performanceObligations.id, id))
      .returning();
    
    // If point-in-time satisfaction, trigger immediate recognition
    if (obligation.satisfactionMethod === 'point_in_time') {
      await this.recognizeObligationRevenue(id, satisfactionDate);
    }
    
    return updated;
  }

  async getRevenueSchedules(input: ListRevenueSchedulesInput = {}): Promise<PaginatedResult<RevenueSchedule>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);
    
    const conditions = [eq(revenueSchedules.organizationId, organizationId)];
    
    if (input.performanceObligationId) {
      conditions.push(eq(revenueSchedules.performanceObligationId, input.performanceObligationId));
    }
    
    if (input.status) {
      conditions.push(eq(revenueSchedules.status, input.status));
    }
    
    if (input.periodStart) {
      const startDate = typeof input.periodStart === 'string' ? input.periodStart : input.periodStart.toISOString().split('T')[0];
      conditions.push(gte(revenueSchedules.periodStartDate, startDate));
    }
    
    if (input.periodEnd) {
      const endDate = typeof input.periodEnd === 'string' ? input.periodEnd : input.periodEnd.toISOString().split('T')[0];
      conditions.push(lte(revenueSchedules.periodEndDate, endDate));
    }
    
    const whereClause = and(...conditions);
    
    const [data, totalResult] = await Promise.all([
      db.select()
        .from(revenueSchedules)
        .where(whereClause)
        .orderBy(revenueSchedules.periodStartDate)
        .limit(take)
        .offset(skip),
      db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(revenueSchedules)
        .where(whereClause)
    ]);
    
    return this.createPaginatedResult(data, totalResult[0].count, page, limit);
  }

  async getRevenueScheduleById(id: string): Promise<RevenueSchedule | null> {
    const organizationId = this.requireOrganizationContext();
    
    const [result] = await db.select()
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.id, id),
          eq(revenueSchedules.organizationId, organizationId)
        )
      )
      .limit(1);
    
    return result || null;
  }

  async updateRevenueSchedule(id: string, data: Partial<RevenueSchedule>): Promise<RevenueSchedule | null> {
    const organizationId = this.requireOrganizationContext();
    
    const existing = await this.getRevenueScheduleById(id);
    if (!existing) {
      throw new ServiceError('Revenue schedule not found', 'NOT_FOUND', 404);
    }
    
    const [updated] = await db.update(revenueSchedules)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(revenueSchedules.id, id))
      .returning();
    
    return updated || null;
  }

  async recognizeRevenue(
    periodDate: Date | string,
    scheduleIds?: string[],
    dryRun: boolean = false
  ): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const periodDateStr = typeof periodDate === 'string' ? periodDate : periodDate.toISOString().split('T')[0];
    
    // Get schedules to recognize
    const conditions = [
      eq(revenueSchedules.organizationId, organizationId),
      lte(revenueSchedules.periodStartDate, periodDateStr),
      gte(revenueSchedules.periodEndDate, periodDateStr),
      eq(revenueSchedules.status, 'scheduled')
    ];
    
    if (scheduleIds && scheduleIds.length > 0) {
      // @ts-ignore - SQL template compatibility
      conditions.push(sql`${revenueSchedules.id} = ANY(${scheduleIds})`);
    }
    
    const schedulesToRecognize = await db.select()
      .from(revenueSchedules)
      .where(and(...conditions));
    
    if (dryRun) {
      return {
        dryRun: true,
        schedulesCount: schedulesToRecognize.length,
        totalAmount: schedulesToRecognize.reduce((sum, s) => sum + parseFloat(s.scheduledAmount), 0),
        schedules: schedulesToRecognize
      };
    }
    
    // Process recognition
    const results = [];
    for (const schedule of schedulesToRecognize) {
      // Update schedule status
      await db.update(revenueSchedules)
        .set({
          status: 'recognized',
          recognizedAmount: schedule.scheduledAmount,
          recognitionDate: periodDateStr,
          updatedAt: new Date()
        })
        .where(eq(revenueSchedules.id, schedule.id));
      
      // Create journal entry
      await db.insert(revenueJournalEntries).values({
        organizationId,
        revenueScheduleId: schedule.id,
        entryDate: periodDateStr,
        recognizedRevenueAmount: schedule.scheduledAmount,
        status: 'draft'
      });
      
      results.push(schedule);
    }
    
    return {
      recognizedCount: results.length,
      totalRecognized: results.reduce((sum, s) => sum + parseFloat(s.scheduledAmount), 0),
      schedules: results
    };
  }

  async getRevenueSummary(input: RevenueSummaryInput): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const startDate = typeof input.startDate === 'string' ? input.startDate : input.startDate.toISOString().split('T')[0];
    const endDate = typeof input.endDate === 'string' ? input.endDate : input.endDate.toISOString().split('T')[0];
    
    // TODO: Implement revenue summary aggregation
    return {
      startDate,
      endDate,
      groupBy: input.groupBy || 'month',
      recognized: 0,
      deferred: 0,
      scheduled: 0,
      message: 'Revenue summary will be fully implemented in production'
    };
  }

  async getDeferredBalance(asOfDate: Date | string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const dateStr = typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().split('T')[0];
    
    // Calculate deferred revenue balance
    const [result] = await db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount} - ${revenueSchedules.recognizedAmount}), 0)::text`.mapWith(String)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          gte(revenueSchedules.periodEndDate, dateStr),
          eq(revenueSchedules.status, 'scheduled')
        )
      );
    
    return {
      asOfDate: dateStr,
      deferredBalance: parseFloat(result.total),
      currency: 'USD'
    };
  }

  async calculateARR(asOfDate?: Date | string, entityId?: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const dateStr = asOfDate 
      ? (typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0];
    
    // TODO: Implement ARR calculation based on active subscriptions
    return {
      asOfDate: dateStr,
      arr: 0,
      activeSubscriptions: 0,
      message: 'ARR calculation will be fully implemented in production'
    };
  }

  async calculateMRR(forMonth?: Date | string, entityId?: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const monthDate = forMonth 
      ? (typeof forMonth === 'string' ? forMonth : forMonth.toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0];
    
    // TODO: Implement MRR calculation
    return {
      month: monthDate,
      mrr: 0,
      newMRR: 0,
      expansionMRR: 0,
      contractionMRR: 0,
      churnMRR: 0,
      message: 'MRR calculation will be fully implemented in production'
    };
  }

  async getRevenueWaterfall(input: RevenueWaterfallInput): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    return {
      startDate: input.startDate,
      endDate: input.endDate,
      beginningBalance: 0,
      newRevenue: 0,
      recognized: 0,
      endingBalance: 0,
      message: 'Revenue waterfall will be fully implemented in production'
    };
  }

  async compareASC605vs606(subscriptionId: string, comparisonDate?: Date | string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    return {
      subscriptionId,
      comparisonDate: comparisonDate || new Date().toISOString().split('T')[0],
      asc605Revenue: 0,
      asc606Revenue: 0,
      difference: 0,
      percentageChange: 0,
      message: 'ASC 605 vs 606 comparison will be fully implemented in production'
    };
  }

  // Private helper methods
  private async identifyPerformanceObligations(subscription: any): Promise<any[]> {
    // Simplified implementation - in production, this would analyze items
    // and determine distinct performance obligations
    const obligations = [];
    
    if (subscription.items) {
      for (const item of subscription.items) {
        obligations.push({
          itemId: item.itemId,
          obligationType: 'product_license', // Simplified
          satisfactionMethod: 'over_time',
          satisfactionPeriodMonths: 12
        });
      }
    }
    
    return obligations;
  }

  private calculateTotalContractValue(subscription: any): number {
    if (!subscription.items) return 0;
    
    return subscription.items.reduce((total: number, item: any) => {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const discountPercentage = item.discountPercentage ? parseFloat(item.discountPercentage) : 0;
      
      const lineTotal = quantity * unitPrice;
      const discountAmount = lineTotal * (discountPercentage / 100);
      
      return total + (lineTotal - discountAmount);
    }, 0);
  }

  private async allocatePriceToObligations(
    obligations: any[],
    totalContractValue: number,
    subscriptionId: string
  ): Promise<any[]> {
    // Simplified SSP allocation - in production would use actual SSP data
    const equalAllocation = totalContractValue / obligations.length;
    
    return obligations.map(obligation => ({
      ...obligation,
      subscriptionId,
      allocatedAmount: equalAllocation.toFixed(2),
      organizationId: this.requireOrganizationContext()
    }));
  }

  private async createRevenueSchedules(
    allocatedObligations: any[],
    subscription: any,
    effectiveDate: Date | string
  ): Promise<any[]> {
    const schedules = [];
    const startDate = typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate;
    
    for (const obligation of allocatedObligations) {
      if (obligation.satisfactionMethod === 'over_time' && obligation.satisfactionPeriodMonths) {
        // Create monthly schedules for over-time recognition
        const monthlyAmount = parseFloat(obligation.allocatedAmount) / obligation.satisfactionPeriodMonths;
        
        for (let month = 0; month < obligation.satisfactionPeriodMonths; month++) {
          const periodStart = new Date(startDate);
          periodStart.setMonth(periodStart.getMonth() + month);
          
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);
          
          schedules.push({
            performanceObligationId: obligation.id,
            periodStartDate: periodStart.toISOString().split('T')[0],
            periodEndDate: periodEnd.toISOString().split('T')[0],
            scheduledAmount: monthlyAmount.toFixed(2),
            recognitionPattern: 'straight_line',
            status: 'scheduled'
          });
        }
      } else {
        // Point-in-time recognition
        schedules.push({
          performanceObligationId: obligation.id,
          periodStartDate: startDate.toISOString().split('T')[0],
          periodEndDate: startDate.toISOString().split('T')[0],
          scheduledAmount: obligation.allocatedAmount,
          recognitionPattern: 'point_in_time',
          status: 'scheduled'
        });
      }
    }
    
    return schedules;
  }

  private async recognizeObligationRevenue(obligationId: string, recognitionDate: Date | string): Promise<void> {
    const dateStr = typeof recognitionDate === 'string' ? recognitionDate : recognitionDate.toISOString().split('T')[0];
    
    // Update all schedules for this obligation to recognized
    await db.update(revenueSchedules)
      .set({
        status: 'recognized',
        recognizedAmount: revenueSchedules.scheduledAmount,
        recognitionDate: dateStr,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(revenueSchedules.performanceObligationId, obligationId),
          eq(revenueSchedules.status, 'scheduled')
        )
      );
  }
}