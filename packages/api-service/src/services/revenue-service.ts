import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  SubscriptionRepository,
  SubscriptionItemRepository,
  InvoiceRepository,
  db as globalDb,
  type ContextualDatabase,
  performanceObligations,
  revenueSchedules,
  contractSspAllocations,
  revenueJournalEntries,
  type PerformanceObligation,
  type RevenueSchedule,
  type NewPerformanceObligation,
  type NewRevenueSchedule
} from '@glapi/database';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { RevenueCalculationEngine, type CalculationResult } from '@glapi/business';

export interface RevenueServiceOptions {
  db?: ContextualDatabase;
}

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
  private db: ContextualDatabase;
  private subscriptionRepository: SubscriptionRepository;
  private subscriptionItemRepository: SubscriptionItemRepository;
  private invoiceRepository: InvoiceRepository;
  private calculationEngine: RevenueCalculationEngine;

  constructor(context: ServiceContext = {}, options: RevenueServiceOptions = {}) {
    super(context);
    // Use contextual db for RLS support, fall back to global
    this.db = options.db ?? globalDb;
    // Pass the contextual db to repositories for RLS support
    this.subscriptionRepository = new SubscriptionRepository(options.db);
    this.subscriptionItemRepository = new SubscriptionItemRepository(options.db);
    this.invoiceRepository = new InvoiceRepository(options.db);
    this.calculationEngine = new RevenueCalculationEngine();
  }

  async calculateRevenue(
    subscriptionId: string,
    calculationType: 'initial' | 'modification' | 'renewal' | 'termination',
    effectiveDate: Date | string,
    options: CalculateRevenueOptions = {}
  ): Promise<RevenueCalculationResult> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate subscription exists and belongs to organization
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    // Use the RevenueCalculationEngine for ASC 606 compliant calculation
    const effectiveDateObj = typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate;
    
    const calculationResult = await this.calculationEngine.calculate({
      subscriptionId,
      organizationId,
      calculationType,
      effectiveDate: effectiveDateObj,
      options: {
        forceRecalculation: options.forceRecalculation,
        includeHistorical: options.includeHistorical,
        dryRun: false
      }
    });
    
    // Transform engine result to API format
    return {
      subscriptionId,
      performanceObligations: calculationResult.performanceObligations.map(o => ({
        itemId: o.itemId,
        obligationType: o.obligationType,
        allocatedAmount: o.allocatedAmount,
        satisfactionMethod: o.satisfactionMethod,
        satisfactionPeriodMonths: o.satisfactionPeriodMonths
      })),
      totalContractValue: calculationResult.transactionPrice,
      recognitionPattern: 'straight_line',
      schedules: calculationResult.schedules.map(s => ({
        periodStart: s.periodStartDate.toISOString().split('T')[0],
        periodEnd: s.periodEndDate.toISOString().split('T')[0],
        amount: s.scheduledAmount
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
      this.db.select()
        .from(performanceObligations)
        .where(whereClause)
        .orderBy(desc(performanceObligations.createdAt))
        .limit(take)
        .offset(skip),
      this.db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(performanceObligations)
        .where(whereClause)
    ]);
    
    return this.createPaginatedResult(data, totalResult[0].count, page, limit);
  }

  async getPerformanceObligationById(id: string): Promise<PerformanceObligation | null> {
    const organizationId = this.requireOrganizationContext();
    
    const [result] = await this.db.select()
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
    const [updated] = await this.db.update(performanceObligations)
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
      this.db.select()
        .from(revenueSchedules)
        .where(whereClause)
        .orderBy(revenueSchedules.periodStartDate)
        .limit(take)
        .offset(skip),
      this.db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(revenueSchedules)
        .where(whereClause)
    ]);
    
    return this.createPaginatedResult(data, totalResult[0].count, page, limit);
  }

  async getRevenueScheduleById(id: string): Promise<RevenueSchedule | null> {
    const organizationId = this.requireOrganizationContext();
    
    const [result] = await this.db.select()
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
    
    const [updated] = await this.db.update(revenueSchedules)
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
      conditions.push(sql`${revenueSchedules.id} = ANY(${scheduleIds})`);
    }
    
    const schedulesToRecognize = await this.db.select()
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
      await this.db.update(revenueSchedules)
        .set({
          status: 'recognized',
          recognizedAmount: schedule.scheduledAmount,
          recognitionDate: periodDateStr,
          updatedAt: new Date()
        })
        .where(eq(revenueSchedules.id, schedule.id));
      
      // Create journal entry
      await this.db.insert(revenueJournalEntries).values({
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
    const groupBy = input.groupBy || 'month';

    // Get date truncation function based on groupBy
    const dateTrunc = groupBy === 'year' ? 'year' : groupBy === 'quarter' ? 'quarter' : 'month';

    // Aggregate recognized revenue by period
    const recognizedByPeriod = await this.db.select({
      period: sql`date_trunc(${dateTrunc}, ${revenueSchedules.recognitionDate}::date)::date`.as('period'),
      amount: sql`COALESCE(SUM(${revenueSchedules.recognizedAmount}), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.status, 'recognized'),
          gte(revenueSchedules.recognitionDate, startDate),
          lte(revenueSchedules.recognitionDate, endDate)
        )
      )
      .groupBy(sql`date_trunc(${dateTrunc}, ${revenueSchedules.recognitionDate}::date)`)
      .orderBy(sql`date_trunc(${dateTrunc}, ${revenueSchedules.recognitionDate}::date)`);

    // Get scheduled revenue by period
    const scheduledByPeriod = await this.db.select({
      period: sql`date_trunc(${dateTrunc}, ${revenueSchedules.periodStartDate}::date)::date`.as('period'),
      amount: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount}), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.status, 'scheduled'),
          gte(revenueSchedules.periodStartDate, startDate),
          lte(revenueSchedules.periodStartDate, endDate)
        )
      )
      .groupBy(sql`date_trunc(${dateTrunc}, ${revenueSchedules.periodStartDate}::date)`)
      .orderBy(sql`date_trunc(${dateTrunc}, ${revenueSchedules.periodStartDate}::date)`);

    // Calculate deferred balance at end of period
    const [deferredResult] = await this.db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount} - COALESCE(${revenueSchedules.recognizedAmount}, 0)), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          lte(revenueSchedules.periodStartDate, endDate),
          sql`(${revenueSchedules.status} = 'scheduled' OR (${revenueSchedules.status} = 'recognized' AND ${revenueSchedules.recognitionDate} > ${endDate}))`
        )
      );

    // Calculate totals
    const totalRecognized = recognizedByPeriod.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalScheduled = scheduledByPeriod.reduce((sum, r) => sum + (r.amount || 0), 0);

    // Build period breakdown
    const periods = new Map<string, { recognized: number; scheduled: number }>();

    for (const r of recognizedByPeriod) {
      const key = r.period ? new Date(String(r.period)).toISOString().split('T')[0] : 'unknown';
      if (!periods.has(key)) {
        periods.set(key, { recognized: 0, scheduled: 0 });
      }
      periods.get(key)!.recognized = r.amount || 0;
    }

    for (const s of scheduledByPeriod) {
      const key = s.period ? new Date(String(s.period)).toISOString().split('T')[0] : 'unknown';
      if (!periods.has(key)) {
        periods.set(key, { recognized: 0, scheduled: 0 });
      }
      periods.get(key)!.scheduled = s.amount || 0;
    }

    const periodBreakdown = Array.from(periods.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        recognized: data.recognized,
        scheduled: data.scheduled
      }));

    return {
      startDate,
      endDate,
      groupBy,
      totals: {
        recognized: totalRecognized,
        scheduled: totalScheduled,
        deferred: deferredResult.total || 0
      },
      periods: periodBreakdown
    };
  }

  async getDeferredBalance(asOfDate: Date | string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const dateStr = typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().split('T')[0];
    
    // Calculate deferred revenue balance
    const [result] = await this.db.select({
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

    // Get active subscriptions with their items
    const activeSubscriptions = await this.subscriptionRepository.list({
      organizationId,
      status: 'active',
      ...(entityId && { entityId }),
      limit: 1000 // Get all active subscriptions
    });

    // Calculate ARR for each subscription
    let totalARR = 0;
    const subscriptionBreakdown = [];

    for (const subscription of activeSubscriptions.data) {
      // Skip if subscription has ended or hasn't started yet
      if (subscription.endDate && new Date(subscription.endDate) < new Date(dateStr)) continue;
      if (new Date(subscription.startDate) > new Date(dateStr)) continue;

      // Calculate annual value based on billing frequency and contract value
      const contractValue = parseFloat(subscription.contractValue || '0');
      let annualizedValue = 0;

      // Calculate subscription term in months
      const startDate = new Date(subscription.startDate);
      const endDate = subscription.endDate ? new Date(subscription.endDate) : null;

      // If we have both dates, calculate the term-based annualization
      if (endDate) {
        const termMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (endDate.getMonth() - startDate.getMonth()) + 1;
        annualizedValue = termMonths > 0 ? (contractValue / termMonths) * 12 : contractValue;
      } else {
        // Without end date, use billing frequency to annualize
        switch (subscription.billingFrequency) {
          case 'monthly':
            // If contractValue represents monthly value, multiply by 12
            // If it represents annual value, use as-is
            annualizedValue = contractValue;
            break;
          case 'quarterly':
            annualizedValue = contractValue;
            break;
          case 'semi_annual':
            annualizedValue = contractValue;
            break;
          case 'annual':
            annualizedValue = contractValue;
            break;
          default:
            annualizedValue = contractValue;
        }
      }

      totalARR += annualizedValue;
      subscriptionBreakdown.push({
        subscriptionId: subscription.id,
        subscriptionNumber: subscription.subscriptionNumber,
        entityId: subscription.entityId,
        contractValue,
        annualizedValue,
        billingFrequency: subscription.billingFrequency,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      });
    }

    return {
      asOfDate: dateStr,
      arr: Math.round(totalARR * 100) / 100,
      activeSubscriptions: subscriptionBreakdown.length,
      currency: 'USD',
      breakdown: subscriptionBreakdown
    };
  }

  async calculateMRR(forMonth?: Date | string, entityId?: string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const monthDate = forMonth
      ? (typeof forMonth === 'string' ? new Date(forMonth) : forMonth)
      : new Date();

    // Get the first and last day of the month
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const prevMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    const prevMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0);

    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];
    const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0];
    const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0];

    // Get ARR for current and previous month to calculate changes
    const currentARR = await this.calculateARR(monthEndStr, entityId);
    const previousARR = await this.calculateARR(prevMonthEndStr, entityId);

    // Create maps for comparison
    const currentSubscriptions = new Map(
      currentARR.breakdown.map((s: any) => [s.subscriptionId, s])
    );
    const previousSubscriptions = new Map(
      previousARR.breakdown.map((s: any) => [s.subscriptionId, s])
    );

    // Calculate MRR components
    let newMRR = 0;
    let expansionMRR = 0;
    let contractionMRR = 0;
    let churnMRR = 0;

    // New subscriptions (in current but not in previous)
    for (const [id, sub] of currentSubscriptions) {
      const current = sub as any;
      if (!previousSubscriptions.has(id)) {
        // Check if subscription started this month
        const startDate = new Date(current.startDate);
        if (startDate >= monthStart && startDate <= monthEnd) {
          newMRR += current.annualizedValue / 12;
        }
      }
    }

    // Expansion and contraction (in both periods but value changed)
    for (const [id, currentSub] of currentSubscriptions) {
      const current = currentSub as any;
      if (previousSubscriptions.has(id)) {
        const previous = previousSubscriptions.get(id) as any;
        const currentMRRValue = current.annualizedValue / 12;
        const previousMRRValue = previous.annualizedValue / 12;
        const diff = currentMRRValue - previousMRRValue;

        if (diff > 0) {
          expansionMRR += diff;
        } else if (diff < 0) {
          contractionMRR += Math.abs(diff);
        }
      }
    }

    // Churned subscriptions (in previous but not in current)
    for (const [id, prevSub] of previousSubscriptions) {
      const previous = prevSub as any;
      if (!currentSubscriptions.has(id)) {
        churnMRR += previous.annualizedValue / 12;
      }
    }

    const totalMRR = currentARR.arr / 12;
    const netNewMRR = newMRR + expansionMRR - contractionMRR - churnMRR;

    return {
      month: monthStartStr,
      mrr: Math.round(totalMRR * 100) / 100,
      newMRR: Math.round(newMRR * 100) / 100,
      expansionMRR: Math.round(expansionMRR * 100) / 100,
      contractionMRR: Math.round(contractionMRR * 100) / 100,
      churnMRR: Math.round(churnMRR * 100) / 100,
      netNewMRR: Math.round(netNewMRR * 100) / 100,
      activeSubscriptions: currentARR.activeSubscriptions,
      currency: 'USD'
    };
  }

  async getRevenueWaterfall(input: RevenueWaterfallInput): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    const startDate = typeof input.startDate === 'string' ? input.startDate : input.startDate.toISOString().split('T')[0];
    const endDate = typeof input.endDate === 'string' ? input.endDate : input.endDate.toISOString().split('T')[0];

    // Calculate beginning balance (deferred revenue as of start date)
    // This is scheduled revenue that hasn't been recognized yet as of startDate
    const [beginningBalanceResult] = await this.db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount} - COALESCE(${revenueSchedules.recognizedAmount}, 0)), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          lte(revenueSchedules.periodStartDate, startDate),
          sql`(${revenueSchedules.status} = 'scheduled' OR (${revenueSchedules.status} = 'recognized' AND ${revenueSchedules.recognitionDate} >= ${startDate}))`
        )
      );

    // Calculate new deferrals (revenue scheduled during the period)
    const [newDeferralsResult] = await this.db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount}), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          gte(revenueSchedules.createdAt, new Date(startDate)),
          lte(revenueSchedules.createdAt, new Date(endDate + 'T23:59:59'))
        )
      );

    // Calculate revenue recognized during the period
    const [recognizedResult] = await this.db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.recognizedAmount}), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.status, 'recognized'),
          gte(revenueSchedules.recognitionDate, startDate),
          lte(revenueSchedules.recognitionDate, endDate)
        )
      );

    // Calculate ending balance (deferred revenue as of end date)
    const [endingBalanceResult] = await this.db.select({
      total: sql`COALESCE(SUM(${revenueSchedules.scheduledAmount} - COALESCE(${revenueSchedules.recognizedAmount}, 0)), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          lte(revenueSchedules.periodStartDate, endDate),
          sql`(${revenueSchedules.status} = 'scheduled' OR (${revenueSchedules.status} = 'recognized' AND ${revenueSchedules.recognitionDate} > ${endDate}))`
        )
      );

    const beginningBalance = beginningBalanceResult.total || 0;
    const newDeferrals = newDeferralsResult.total || 0;
    const recognized = recognizedResult.total || 0;
    const endingBalance = endingBalanceResult.total || 0;

    // Get monthly breakdown for the period
    const monthlyBreakdown = await this.db.select({
      month: sql`date_trunc('month', ${revenueSchedules.recognitionDate}::date)::date`.as('month'),
      recognizedAmount: sql`COALESCE(SUM(${revenueSchedules.recognizedAmount}), 0)::numeric`.mapWith(Number)
    })
      .from(revenueSchedules)
      .where(
        and(
          eq(revenueSchedules.organizationId, organizationId),
          eq(revenueSchedules.status, 'recognized'),
          gte(revenueSchedules.recognitionDate, startDate),
          lte(revenueSchedules.recognitionDate, endDate)
        )
      )
      .groupBy(sql`date_trunc('month', ${revenueSchedules.recognitionDate}::date)`)
      .orderBy(sql`date_trunc('month', ${revenueSchedules.recognitionDate}::date)`);

    // Build waterfall chart data (running balance)
    const waterfallData = [];
    let runningBalance = beginningBalance;

    // Add beginning balance
    waterfallData.push({
      label: 'Beginning Balance',
      value: beginningBalance,
      runningBalance: beginningBalance,
      type: 'balance'
    });

    // Add new deferrals
    if (newDeferrals > 0) {
      runningBalance += newDeferrals;
      waterfallData.push({
        label: 'New Deferrals',
        value: newDeferrals,
        runningBalance,
        type: 'addition'
      });
    }

    // Add recognized (subtraction)
    if (recognized > 0) {
      runningBalance -= recognized;
      waterfallData.push({
        label: 'Revenue Recognized',
        value: -recognized,
        runningBalance,
        type: 'subtraction'
      });
    }

    // Add ending balance
    waterfallData.push({
      label: 'Ending Balance',
      value: endingBalance,
      runningBalance: endingBalance,
      type: 'balance'
    });

    return {
      startDate,
      endDate,
      summary: {
        beginningBalance: Math.round(beginningBalance * 100) / 100,
        newDeferrals: Math.round(newDeferrals * 100) / 100,
        recognized: Math.round(recognized * 100) / 100,
        endingBalance: Math.round(endingBalance * 100) / 100,
        // Sanity check: beginningBalance + newDeferrals - recognized ≈ endingBalance
        calculatedEndingBalance: Math.round((beginningBalance + newDeferrals - recognized) * 100) / 100
      },
      waterfallData,
      monthlyRecognition: monthlyBreakdown.map(m => ({
        month: m.month ? new Date(String(m.month)).toISOString().split('T')[0] : 'unknown',
        recognized: m.recognizedAmount
      })),
      currency: 'USD'
    };
  }

  async getRecognitionHistory(input: {
    subscriptionId?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResult<any>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);
    
    const conditions = [eq(revenueJournalEntries.organizationId, organizationId)];
    
    if (input.subscriptionId) {
      // Join with revenue schedules to filter by subscription
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${revenueSchedules} rs
          JOIN ${performanceObligations} po ON rs.performance_obligation_id = po.id
          WHERE rs.id = ${revenueJournalEntries.revenueScheduleId}
          AND po.subscription_id = ${input.subscriptionId}
        )`
      );
    }
    
    if (input.startDate) {
      const startDateStr = typeof input.startDate === 'string' ? input.startDate : input.startDate.toISOString().split('T')[0];
      conditions.push(gte(revenueJournalEntries.entryDate, startDateStr));
    }
    
    if (input.endDate) {
      const endDateStr = typeof input.endDate === 'string' ? input.endDate : input.endDate.toISOString().split('T')[0];
      conditions.push(lte(revenueJournalEntries.entryDate, endDateStr));
    }
    
    const whereClause = and(...conditions);
    
    const [data, totalResult] = await Promise.all([
      this.db.select({
        id: revenueJournalEntries.id,
        entryDate: revenueJournalEntries.entryDate,
        recognizedAmount: revenueJournalEntries.recognizedRevenueAmount,
        deferredAmount: revenueJournalEntries.deferredRevenueAmount,
        status: revenueJournalEntries.status,
        scheduleId: revenueJournalEntries.revenueScheduleId,
        createdAt: revenueJournalEntries.createdAt
      })
        .from(revenueJournalEntries)
        .where(whereClause)
        .orderBy(desc(revenueJournalEntries.entryDate), desc(revenueJournalEntries.createdAt))
        .limit(take)
        .offset(skip),
      this.db.select({ count: sql`count(*)::int`.mapWith(Number) })
        .from(revenueJournalEntries)
        .where(whereClause)
    ]);
    
    // Transform the data to include additional context
    const enrichedData = await Promise.all(data.map(async (entry) => {
      // Get schedule details
      const [schedule] = await this.db.select({
        periodStart: revenueSchedules.periodStartDate,
        periodEnd: revenueSchedules.periodEndDate,
        performanceObligationId: revenueSchedules.performanceObligationId
      })
        .from(revenueSchedules)
        .where(eq(revenueSchedules.id, entry.scheduleId))
        .limit(1);
      
      let subscriptionInfo = null;
      if (schedule?.performanceObligationId) {
        const [obligation] = await this.db.select({
          subscriptionId: performanceObligations.subscriptionId,
          itemId: performanceObligations.itemId,
          obligationType: performanceObligations.obligationType
        })
          .from(performanceObligations)
          .where(eq(performanceObligations.id, schedule.performanceObligationId))
          .limit(1);
        
        subscriptionInfo = obligation;
      }
      
      return {
        ...entry,
        recognizedAmount: parseFloat(entry.recognizedAmount || '0'),
        deferredAmount: parseFloat(entry.deferredAmount || '0'),
        schedule: schedule ? {
          periodStart: schedule.periodStart,
          periodEnd: schedule.periodEnd
        } : null,
        subscription: subscriptionInfo
      };
    }));
    
    return this.createPaginatedResult(enrichedData, totalResult[0].count, page || 1, limit || 50);
  }

  async compareASC605vs606(subscriptionId: string, comparisonDate?: Date | string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate subscription exists
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }
    
    const effectiveDate = comparisonDate 
      ? (typeof comparisonDate === 'string' ? new Date(comparisonDate) : comparisonDate)
      : new Date();
    
    // Get ASC 606 calculation
    const calculationResult = await this.calculationEngine.calculate({
      subscriptionId,
      organizationId,
      calculationType: 'initial',
      effectiveDate,
      options: { dryRun: true }
    });
    
    // ASC 605 would recognize revenue more simply (often upfront or ratably)
    const asc605Revenue = parseFloat(subscription.contractValue || '0');
    const asc606Revenue = calculationResult.transactionPrice;
    const difference = asc606Revenue - asc605Revenue;
    const percentageChange = asc605Revenue !== 0 ? (difference / asc605Revenue) * 100 : 0;
    
    return {
      subscriptionId,
      comparisonDate: effectiveDate.toISOString().split('T')[0],
      asc605Revenue,
      asc606Revenue,
      difference,
      percentageChange,
      impactAnalysis: {
        allocations: calculationResult.allocations,
        performanceObligations: calculationResult.performanceObligations.length,
        recognitionPattern: 'ASC 606 allocates based on SSP and satisfaction patterns'
      }
    };
  }

  async previewAllocation(subscriptionId: string, effectiveDate: Date | string): Promise<any> {
    const organizationId = this.requireOrganizationContext();
    
    // Validate subscription exists
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }
    
    const effectiveDateObj = typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate;
    
    // Run calculation in dry-run mode for preview
    const calculationResult = await this.calculationEngine.calculate({
      subscriptionId,
      organizationId,
      calculationType: 'initial',
      effectiveDate: effectiveDateObj,
      options: { dryRun: true }
    });
    
    return {
      subscriptionId,
      effectiveDate: effectiveDateObj.toISOString().split('T')[0],
      transactionPrice: calculationResult.transactionPrice,
      performanceObligations: calculationResult.performanceObligations.map(o => ({
        itemId: o.itemId,
        itemName: o.itemName,
        obligationType: o.obligationType,
        satisfactionMethod: o.satisfactionMethod,
        satisfactionPeriodMonths: o.satisfactionPeriodMonths,
        startDate: o.startDate.toISOString().split('T')[0],
        endDate: o.endDate.toISOString().split('T')[0]
      })),
      allocations: calculationResult.allocations.map(a => ({
        itemId: a.itemId,
        sspAmount: a.sspAmount,
        allocatedAmount: a.allocatedAmount,
        allocationPercentage: (a.allocationPercentage * 100).toFixed(2) + '%',
        allocationMethod: a.allocationMethod
      })),
      schedulePreview: calculationResult.schedules.slice(0, 12).map(s => ({
        period: `${s.periodStartDate.toISOString().split('T')[0]} to ${s.periodEndDate.toISOString().split('T')[0]}`,
        amount: s.scheduledAmount,
        recognitionPattern: s.recognitionPattern
      })),
      totalSchedules: calculationResult.schedules.length
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
    await this.db.update(revenueSchedules)
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