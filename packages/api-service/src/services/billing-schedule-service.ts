import { BaseService } from './base-service';
import { ServiceContext, ServiceError, PaginatedResult } from '../types';
import {
  BillingScheduleRepository,
  SubscriptionRepository,
  type BillingSchedule,
  type NewBillingSchedule,
  type BillingScheduleLine,
  type NewBillingScheduleLine,
  type BillingScheduleWithLines,
  type SubscriptionWithItems,
} from '@glapi/database';

export type BillingFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom';

export interface GenerateBillingScheduleInput {
  subscriptionId: string;
  startDate?: Date;
  endDate?: Date;
  billingDay?: number;
  paymentTermsDays?: number;
}

export interface BillingScheduleListInput {
  subscriptionId?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
}

export interface BillingPeriod {
  periodStart: Date;
  periodEnd: Date;
  billingDate: Date;
  dueDate: Date;
  isProrated: boolean;
  proratedDays?: number;
  fullPeriodDays?: number;
}

export class BillingScheduleService extends BaseService {
  private billingScheduleRepository: BillingScheduleRepository;
  private subscriptionRepository: SubscriptionRepository;

  constructor(context: ServiceContext = {}) {
    super(context);
    this.billingScheduleRepository = new BillingScheduleRepository();
    this.subscriptionRepository = new SubscriptionRepository();
  }

  // ============================================================================
  // Schedule Generation
  // ============================================================================

  async generateBillingSchedule(input: GenerateBillingScheduleInput): Promise<BillingScheduleWithLines> {
    const organizationId = this.requireOrganizationContext();

    // Get subscription
    const subscription = await this.subscriptionRepository.findByIdWithItems(input.subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    if (subscription.status !== 'active') {
      throw new ServiceError(
        'Billing schedule can only be generated for active subscriptions',
        'INVALID_STATE',
        400
      );
    }

    if (!subscription.items || subscription.items.length === 0) {
      throw new ServiceError(
        'Subscription must have items to generate a billing schedule',
        'MISSING_ITEMS',
        400
      );
    }

    // Determine schedule parameters
    const scheduleStartDate = input.startDate || new Date(subscription.startDate);
    const scheduleEndDate = input.endDate || (subscription.endDate ? new Date(subscription.endDate) : null);
    const frequency = (subscription.billingFrequency || 'monthly') as BillingFrequency;
    const billingDay = input.billingDay || 1;
    const paymentTermsDays = input.paymentTermsDays || 30;

    // Calculate expected amount per period from subscription items
    const periodAmount = this.calculatePeriodAmount(subscription, frequency);

    // Generate billing periods
    const billingPeriods = this.generateBillingPeriods(
      scheduleStartDate,
      scheduleEndDate,
      frequency,
      billingDay,
      paymentTermsDays
    );

    if (billingPeriods.length === 0) {
      throw new ServiceError(
        'No billing periods could be generated for the specified date range',
        'NO_PERIODS',
        400
      );
    }

    // Generate schedule number
    const scheduleNumber = await this.billingScheduleRepository.generateScheduleNumber(organizationId);

    // Create schedule data
    const scheduleData: NewBillingSchedule = {
      organizationId,
      subscriptionId: subscription.id,
      scheduleNumber,
      startDate: scheduleStartDate.toISOString().split('T')[0],
      endDate: scheduleEndDate?.toISOString().split('T')[0],
      frequency,
      billingDay,
      paymentTermsDays,
      status: 'active',
      nextBillingDate: billingPeriods[0].billingDate.toISOString().split('T')[0],
      createdBy: this.context.userId,
    };

    // Create line data
    const linesData: Omit<NewBillingScheduleLine, 'billingScheduleId'>[] = billingPeriods.map(
      (period, index) => {
        // Calculate prorated amount if needed
        let lineAmount = periodAmount;
        if (period.isProrated && period.proratedDays && period.fullPeriodDays) {
          lineAmount = (periodAmount * period.proratedDays) / period.fullPeriodDays;
        }

        return {
          organizationId,
          sequenceNumber: index + 1,
          billingPeriodStart: period.periodStart.toISOString().split('T')[0],
          billingPeriodEnd: period.periodEnd.toISOString().split('T')[0],
          scheduledBillingDate: period.billingDate.toISOString().split('T')[0],
          dueDate: period.dueDate.toISOString().split('T')[0],
          expectedAmount: lineAmount.toFixed(2),
          isProrated: period.isProrated,
          proratedDays: period.proratedDays,
          fullPeriodDays: period.fullPeriodDays,
          status: 'scheduled' as const,
        };
      }
    );

    // Create schedule with lines
    const schedule = await this.billingScheduleRepository.createWithLines(scheduleData, linesData);

    return schedule;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async getScheduleById(scheduleId: string): Promise<BillingScheduleWithLines | null> {
    const organizationId = this.requireOrganizationContext();

    const schedule = await this.billingScheduleRepository.findByIdWithLines(scheduleId);
    if (!schedule || schedule.organizationId !== organizationId) {
      return null;
    }

    return schedule;
  }

  async getActiveScheduleBySubscription(subscriptionId: string): Promise<BillingScheduleWithLines | null> {
    const organizationId = this.requireOrganizationContext();

    // Verify subscription ownership
    const subscription = await this.subscriptionRepository.findByIdWithItems(subscriptionId);
    if (!subscription || subscription.organizationId !== organizationId) {
      throw new ServiceError('Subscription not found', 'NOT_FOUND', 404);
    }

    const schedule = await this.billingScheduleRepository.findActiveBySubscriptionId(subscriptionId);
    if (!schedule) return null;

    return await this.billingScheduleRepository.findByIdWithLines(schedule.id);
  }

  async listSchedules(input: BillingScheduleListInput = {}): Promise<PaginatedResult<BillingSchedule>> {
    const organizationId = this.requireOrganizationContext();
    const { skip, take, page, limit } = this.getPaginationParams(input);

    const result = await this.billingScheduleRepository.list({
      organizationId,
      subscriptionId: input.subscriptionId,
      status: input.status,
      limit: take,
      offset: skip,
    });

    return this.createPaginatedResult(result.data, result.total, page, limit);
  }

  // ============================================================================
  // Due Billing Operations
  // ============================================================================

  async getLinesDueToBill(asOfDate?: Date): Promise<BillingScheduleLine[]> {
    const organizationId = this.requireOrganizationContext();
    const date = asOfDate || new Date();

    return await this.billingScheduleRepository.findLinesDueToBill(organizationId, date);
  }

  async getOverdueLines(asOfDate?: Date): Promise<BillingScheduleLine[]> {
    const organizationId = this.requireOrganizationContext();
    const date = asOfDate || new Date();

    return await this.billingScheduleRepository.findOverdueLines(organizationId, date);
  }

  // ============================================================================
  // Invoice Integration
  // ============================================================================

  async markLineInvoiced(
    lineId: string,
    invoiceId: string,
    invoicedAmount: string
  ): Promise<BillingScheduleLine> {
    const organizationId = this.requireOrganizationContext();

    const line = await this.billingScheduleRepository.findLineById(lineId);
    if (!line || line.organizationId !== organizationId) {
      throw new ServiceError('Billing schedule line not found', 'NOT_FOUND', 404);
    }

    if (line.status !== 'scheduled') {
      throw new ServiceError(
        `Cannot invoice line with status '${line.status}'`,
        'INVALID_STATE',
        400
      );
    }

    const updatedLine = await this.billingScheduleRepository.markLineAsInvoiced(
      lineId,
      invoiceId,
      invoicedAmount
    );

    if (!updatedLine) {
      throw new ServiceError('Failed to update billing schedule line', 'UPDATE_FAILED', 500);
    }

    return updatedLine;
  }

  async markLinePaid(lineId: string): Promise<BillingScheduleLine> {
    const organizationId = this.requireOrganizationContext();

    const line = await this.billingScheduleRepository.findLineById(lineId);
    if (!line || line.organizationId !== organizationId) {
      throw new ServiceError('Billing schedule line not found', 'NOT_FOUND', 404);
    }

    if (line.status !== 'invoiced') {
      throw new ServiceError(
        `Cannot mark line as paid with status '${line.status}'`,
        'INVALID_STATE',
        400
      );
    }

    const updatedLine = await this.billingScheduleRepository.markLineAsPaid(lineId);

    if (!updatedLine) {
      throw new ServiceError('Failed to update billing schedule line', 'UPDATE_FAILED', 500);
    }

    return updatedLine;
  }

  // ============================================================================
  // Schedule Lifecycle
  // ============================================================================

  async pauseSchedule(scheduleId: string, reason?: string): Promise<BillingSchedule> {
    const organizationId = this.requireOrganizationContext();

    const schedule = await this.billingScheduleRepository.findById(scheduleId);
    if (!schedule || schedule.organizationId !== organizationId) {
      throw new ServiceError('Billing schedule not found', 'NOT_FOUND', 404);
    }

    if (schedule.status !== 'active') {
      throw new ServiceError(
        `Cannot pause schedule with status '${schedule.status}'`,
        'INVALID_STATE',
        400
      );
    }

    const updated = await this.billingScheduleRepository.update(scheduleId, {
      status: 'paused',
      notes: reason,
    });

    if (!updated) {
      throw new ServiceError('Failed to pause schedule', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  async resumeSchedule(scheduleId: string): Promise<BillingSchedule> {
    const organizationId = this.requireOrganizationContext();

    const schedule = await this.billingScheduleRepository.findById(scheduleId);
    if (!schedule || schedule.organizationId !== organizationId) {
      throw new ServiceError('Billing schedule not found', 'NOT_FOUND', 404);
    }

    if (schedule.status !== 'paused') {
      throw new ServiceError(
        `Cannot resume schedule with status '${schedule.status}'`,
        'INVALID_STATE',
        400
      );
    }

    const updated = await this.billingScheduleRepository.update(scheduleId, {
      status: 'active',
    });

    if (!updated) {
      throw new ServiceError('Failed to resume schedule', 'UPDATE_FAILED', 500);
    }

    return updated;
  }

  async cancelSchedule(scheduleId: string, reason?: string): Promise<BillingSchedule> {
    const organizationId = this.requireOrganizationContext();

    const schedule = await this.billingScheduleRepository.findById(scheduleId);
    if (!schedule || schedule.organizationId !== organizationId) {
      throw new ServiceError('Billing schedule not found', 'NOT_FOUND', 404);
    }

    if (schedule.status === 'cancelled' || schedule.status === 'completed') {
      throw new ServiceError(
        `Cannot cancel schedule with status '${schedule.status}'`,
        'INVALID_STATE',
        400
      );
    }

    const updated = await this.billingScheduleRepository.update(scheduleId, {
      status: 'cancelled',
      notes: reason,
    });

    if (!updated) {
      throw new ServiceError('Failed to cancel schedule', 'UPDATE_FAILED', 500);
    }

    // Cancel all pending lines
    const lines = await this.billingScheduleRepository.findLinesByScheduleId(scheduleId);
    for (const line of lines) {
      if (line.status === 'scheduled') {
        await this.billingScheduleRepository.markLineAsCancelled(line.id, reason);
      }
    }

    return updated;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private calculatePeriodAmount(subscription: SubscriptionWithItems, frequency: BillingFrequency): number {
    // Calculate total annual value from subscription items
    const items = subscription.items || [];
    const totalAnnual = items.reduce((sum, item) => {
      const qty = parseFloat(String(item.quantity)) || 1;
      const price = parseFloat(String(item.unitPrice)) || 0;
      const discount = parseFloat(String(item.discountPercentage)) || 0;
      return sum + (qty * price * (1 - discount));
    }, 0);

    // Convert to period amount based on frequency
    switch (frequency) {
      case 'monthly':
        return totalAnnual / 12;
      case 'quarterly':
        return totalAnnual / 4;
      case 'semi_annual':
        return totalAnnual / 2;
      case 'annual':
        return totalAnnual;
      case 'custom':
        // For custom, default to contract value divided by contract duration in months
        if (subscription.contractValue && subscription.startDate && subscription.endDate) {
          const start = new Date(subscription.startDate);
          const end = new Date(subscription.endDate);
          const months = this.monthsBetween(start, end);
          return parseFloat(subscription.contractValue) / Math.max(months, 1);
        }
        return totalAnnual / 12; // Default to monthly
      default:
        return totalAnnual / 12;
    }
  }

  private generateBillingPeriods(
    startDate: Date,
    endDate: Date | null,
    frequency: BillingFrequency,
    billingDay: number,
    paymentTermsDays: number
  ): BillingPeriod[] {
    const periods: BillingPeriod[] = [];
    const maxPeriods = 120; // Safety limit (10 years of monthly billing)

    // Determine months per period
    const monthsPerPeriod = this.getMonthsPerPeriod(frequency);

    // Normalize dates to local midnight to ensure consistent date arithmetic
    // This avoids issues where ISO strings parse as UTC midnight but setMonth/setDate operate in local time
    let currentPeriodStart = this.normalizeToLocalMidnight(startDate);
    const normalizedEndDate = endDate ? this.normalizeToLocalMidnight(endDate) : null;

    // Check for proration of the first period
    const firstPeriodStartDay = currentPeriodStart.getDate();
    let isFirstPeriodProrated = firstPeriodStartDay !== 1;

    let periodCount = 0;

    while (periodCount < maxPeriods) {
      // Check if we've passed the end date
      if (normalizedEndDate && currentPeriodStart > normalizedEndDate) {
        break;
      }

      // Calculate period end: go to the last day of the period
      let periodEnd = this.addMonths(currentPeriodStart, monthsPerPeriod);
      periodEnd.setDate(0); // Go to last day of previous month (end of period)

      // Adjust period end if it exceeds subscription end date
      if (normalizedEndDate && periodEnd > normalizedEndDate) {
        periodEnd = new Date(normalizedEndDate);
      }

      // Calculate billing date (billingDay of the period start month, or the period start if before that day)
      const billingDate = new Date(currentPeriodStart);
      billingDate.setDate(Math.min(billingDay, this.getDaysInMonth(billingDate)));

      // Calculate due date
      const dueDate = new Date(billingDate);
      dueDate.setDate(dueDate.getDate() + paymentTermsDays);

      // Calculate proration
      let isProrated = false;
      let proratedDays: number | undefined;
      let fullPeriodDays: number | undefined;

      if (periodCount === 0 && isFirstPeriodProrated) {
        isProrated = true;
        const fullPeriodEnd = new Date(currentPeriodStart);
        fullPeriodEnd.setDate(1);
        const fullEnd = this.addMonths(fullPeriodEnd, monthsPerPeriod);
        fullEnd.setDate(0);

        fullPeriodDays = this.daysBetween(fullPeriodEnd, fullEnd) + 1;
        proratedDays = this.daysBetween(currentPeriodStart, periodEnd) + 1;
      }

      // Check if last period is partial (subscription ends mid-period)
      if (normalizedEndDate) {
        const expectedPeriodEnd = this.addMonths(currentPeriodStart, monthsPerPeriod);
        expectedPeriodEnd.setDate(0);

        if (periodEnd < expectedPeriodEnd) {
          isProrated = true;
          const fullPeriodStart = new Date(currentPeriodStart);
          fullPeriodStart.setDate(1);
          const fullEnd = this.addMonths(fullPeriodStart, monthsPerPeriod);
          fullEnd.setDate(0);

          fullPeriodDays = this.daysBetween(fullPeriodStart, fullEnd) + 1;
          proratedDays = this.daysBetween(currentPeriodStart, periodEnd) + 1;
        }
      }

      periods.push({
        periodStart: new Date(currentPeriodStart),
        periodEnd: new Date(periodEnd),
        billingDate,
        dueDate,
        isProrated,
        proratedDays,
        fullPeriodDays,
      });

      // Move to next period
      currentPeriodStart = this.addMonths(currentPeriodStart, monthsPerPeriod);
      currentPeriodStart.setDate(1); // Start from first of month for subsequent periods
      isFirstPeriodProrated = false;
      periodCount++;
    }

    return periods;
  }

  private normalizeToLocalMidnight(date: Date): Date {
    // Parse the date as a local date by extracting UTC components
    // This ensures that '2024-01-01' parsed as UTC midnight becomes Jan 1 in local time
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  private getMonthsPerPeriod(frequency: BillingFrequency): number {
    switch (frequency) {
      case 'monthly':
        return 1;
      case 'quarterly':
        return 3;
      case 'semi_annual':
        return 6;
      case 'annual':
        return 12;
      case 'custom':
        return 1; // Default to monthly for custom
      default:
        return 1;
    }
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private daysBetween(start: Date, end: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay));
  }

  private monthsBetween(start: Date, end: Date): number {
    const years = end.getFullYear() - start.getFullYear();
    const months = end.getMonth() - start.getMonth();
    return years * 12 + months;
  }
}

// Factory function for creating service instance
export function createBillingScheduleService(
  organizationId?: string,
  userId?: string
): BillingScheduleService {
  return new BillingScheduleService({ organizationId, userId });
}
