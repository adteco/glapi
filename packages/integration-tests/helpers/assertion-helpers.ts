import { expect } from 'vitest';

export class AssertionHelpers {
  /**
   * Assert that a date is within a range
   */
  static assertDateInRange(
    actual: Date | string,
    expectedStart: Date | string,
    expectedEnd: Date | string,
    message?: string
  ): void {
    const actualDate = typeof actual === 'string' ? new Date(actual) : actual;
    const startDate = typeof expectedStart === 'string' ? new Date(expectedStart) : expectedStart;
    const endDate = typeof expectedEnd === 'string' ? new Date(expectedEnd) : expectedEnd;
    
    expect(actualDate.getTime(), message).toBeGreaterThanOrEqual(startDate.getTime());
    expect(actualDate.getTime(), message).toBeLessThanOrEqual(endDate.getTime());
  }

  /**
   * Assert monetary values are equal within a tolerance
   */
  static assertMoneyEqual(
    actual: number | string,
    expected: number | string,
    tolerance = 0.01,
    message?: string
  ): void {
    const actualValue = typeof actual === 'string' ? parseFloat(actual) : actual;
    const expectedValue = typeof expected === 'string' ? parseFloat(expected) : expected;
    
    expect(actualValue, message).toBeCloseTo(expectedValue, 2);
  }

  /**
   * Assert that an array contains expected items based on a property
   */
  static assertArrayContainsBy<T>(
    array: T[],
    property: keyof T,
    expectedValues: any[],
    message?: string
  ): void {
    const actualValues = array.map(item => item[property]);
    
    for (const expected of expectedValues) {
      expect(actualValues, message).toContain(expected);
    }
  }

  /**
   * Assert revenue schedule is valid
   */
  static assertValidRevenueSchedule(schedule: any): void {
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();
    expect(schedule.organizationId).toBeDefined();
    expect(schedule.performanceObligationId).toBeDefined();
    expect(schedule.periodStartDate).toBeDefined();
    expect(schedule.periodEndDate).toBeDefined();
    expect(schedule.scheduledAmount).toBeDefined();
    expect(parseFloat(schedule.scheduledAmount)).toBeGreaterThanOrEqual(0);
    expect(schedule.status).toMatch(/^(scheduled|recognized|deferred|cancelled)$/);
    
    // Period end should be after period start
    const startDate = new Date(schedule.periodStartDate);
    const endDate = new Date(schedule.periodEndDate);
    expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
  }

  /**
   * Assert performance obligation is valid
   */
  static assertValidPerformanceObligation(obligation: any): void {
    expect(obligation).toBeDefined();
    expect(obligation.id).toBeDefined();
    expect(obligation.subscriptionId).toBeDefined();
    expect(obligation.obligationType).toBeDefined();
    expect(obligation.obligationName).toBeDefined();
    expect(obligation.satisfactionMethod).toMatch(/^(point_in_time|over_time|milestone)$/);
    expect(obligation.transactionPrice).toBeDefined();
    expect(parseFloat(obligation.transactionPrice)).toBeGreaterThan(0);
    expect(obligation.status).toMatch(/^(pending|in_progress|satisfied|cancelled)$/);
  }

  /**
   * Assert journal entry is valid
   */
  static assertValidJournalEntry(entry: any): void {
    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.organizationId).toBeDefined();
    expect(entry.entryDate).toBeDefined();
    expect(entry.entryType).toMatch(/^(revenue_recognition|adjustment|reversal)$/);
    
    // Debit and credit amounts should be defined and equal
    if (entry.deferredRevenueAmount && entry.recognizedRevenueAmount) {
      const debit = parseFloat(entry.deferredRevenueAmount);
      const credit = parseFloat(entry.recognizedRevenueAmount);
      expect(Math.abs(debit)).toBeCloseTo(Math.abs(credit), 2);
    }
  }

  /**
   * Assert subscription is valid
   */
  static assertValidSubscription(subscription: any): void {
    expect(subscription).toBeDefined();
    expect(subscription.id).toBeDefined();
    expect(subscription.organizationId).toBeDefined();
    expect(subscription.entityId).toBeDefined();
    expect(subscription.subscriptionNumber).toBeDefined();
    expect(subscription.status).toMatch(/^(draft|active|suspended|cancelled|expired)$/);
    expect(subscription.startDate).toBeDefined();
    expect(subscription.endDate).toBeDefined();
    expect(subscription.contractValue).toBeDefined();
    expect(parseFloat(subscription.contractValue)).toBeGreaterThanOrEqual(0);
    
    // End date should be after start date
    const startDate = new Date(subscription.startDate);
    const endDate = new Date(subscription.endDate);
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  }

  /**
   * Assert invoice is valid
   */
  static assertValidInvoice(invoice: any): void {
    expect(invoice).toBeDefined();
    expect(invoice.id).toBeDefined();
    expect(invoice.organizationId).toBeDefined();
    expect(invoice.entityId).toBeDefined();
    expect(invoice.invoiceNumber).toBeDefined();
    expect(invoice.invoiceDate).toBeDefined();
    expect(invoice.dueDate).toBeDefined();
    expect(invoice.status).toMatch(/^(draft|sent|paid|partial|overdue|cancelled)$/);
    expect(invoice.totalAmount).toBeDefined();
    expect(parseFloat(invoice.totalAmount)).toBeGreaterThanOrEqual(0);
    
    // Due date should be after invoice date
    const invoiceDate = new Date(invoice.invoiceDate);
    const dueDate = new Date(invoice.dueDate);
    expect(dueDate.getTime()).toBeGreaterThanOrEqual(invoiceDate.getTime());
  }

  /**
   * Assert payment is valid
   */
  static assertValidPayment(payment: any): void {
    expect(payment).toBeDefined();
    expect(payment.id).toBeDefined();
    expect(payment.organizationId).toBeDefined();
    expect(payment.invoiceId).toBeDefined();
    expect(payment.paymentDate).toBeDefined();
    expect(payment.amount).toBeDefined();
    expect(parseFloat(payment.amount)).toBeGreaterThan(0);
    expect(payment.paymentMethod).toBeDefined();
    expect(payment.status).toMatch(/^(pending|completed|failed|refunded)$/);
  }

  /**
   * Assert ARR calculation is valid
   */
  static assertValidARRCalculation(arr: any): void {
    expect(arr).toBeDefined();
    expect(arr.totalARR).toBeDefined();
    expect(arr.totalARR).toBeGreaterThanOrEqual(0);
    expect(arr.newARR).toBeDefined();
    expect(arr.newARR).toBeGreaterThanOrEqual(0);
    expect(arr.expansionARR).toBeDefined();
    expect(arr.expansionARR).toBeGreaterThanOrEqual(0);
    expect(arr.contractionARR).toBeDefined();
    expect(arr.contractionARR).toBeGreaterThanOrEqual(0);
    expect(arr.churnARR).toBeDefined();
    expect(arr.churnARR).toBeGreaterThanOrEqual(0);
    expect(arr.netARRGrowth).toBeDefined();
    
    // Net growth should equal new + expansion - contraction - churn
    const expectedNetGrowth = arr.newARR + arr.expansionARR - arr.contractionARR - arr.churnARR;
    expect(arr.netARRGrowth).toBeCloseTo(expectedNetGrowth, 2);
  }

  /**
   * Assert MRR calculation is valid
   */
  static assertValidMRRCalculation(mrr: any): void {
    expect(mrr).toBeDefined();
    expect(mrr.totalMRR).toBeDefined();
    expect(mrr.totalMRR).toBeGreaterThanOrEqual(0);
    expect(mrr.newMRR).toBeDefined();
    expect(mrr.newMRR).toBeGreaterThanOrEqual(0);
    expect(mrr.expansionMRR).toBeDefined();
    expect(mrr.expansionMRR).toBeGreaterThanOrEqual(0);
    expect(mrr.contractionMRR).toBeDefined();
    expect(mrr.contractionMRR).toBeGreaterThanOrEqual(0);
    expect(mrr.churnMRR).toBeDefined();
    expect(mrr.churnMRR).toBeGreaterThanOrEqual(0);
    expect(mrr.netMRRGrowth).toBeDefined();
    
    // Net growth should equal new + expansion - contraction - churn
    const expectedNetGrowth = mrr.newMRR + mrr.expansionMRR - mrr.contractionMRR - mrr.churnMRR;
    expect(mrr.netMRRGrowth).toBeCloseTo(expectedNetGrowth, 2);
    
    if (mrr.mrrCohorts) {
      expect(Array.isArray(mrr.mrrCohorts)).toBe(true);
    }
  }

  /**
   * Assert deferred balance report is valid
   */
  static assertValidDeferredBalance(deferred: any): void {
    expect(deferred).toBeDefined();
    expect(deferred.totalDeferred).toBeDefined();
    expect(deferred.totalDeferred).toBeGreaterThanOrEqual(0);
    expect(deferred.currentPortion).toBeDefined();
    expect(deferred.currentPortion).toBeGreaterThanOrEqual(0);
    expect(deferred.longTermPortion).toBeDefined();
    expect(deferred.longTermPortion).toBeGreaterThanOrEqual(0);
    
    // Current + long-term should equal total
    const expectedTotal = deferred.currentPortion + deferred.longTermPortion;
    expect(deferred.totalDeferred).toBeCloseTo(expectedTotal, 2);
    
    if (deferred.agingBuckets) {
      expect(Array.isArray(deferred.agingBuckets)).toBe(true);
      
      // Sum of aging buckets should equal total
      const agingSum = deferred.agingBuckets.reduce(
        (sum: number, bucket: any) => sum + bucket.amount,
        0
      );
      expect(agingSum).toBeCloseTo(deferred.totalDeferred, 2);
    }
  }

  /**
   * Assert revenue waterfall is valid
   */
  static assertValidRevenueWaterfall(waterfall: any): void {
    expect(waterfall).toBeDefined();
    expect(waterfall.period).toBeDefined();
    expect(waterfall.period.startDate).toBeDefined();
    expect(waterfall.period.endDate).toBeDefined();
    expect(waterfall.totalRecognizedRevenue).toBeDefined();
    expect(waterfall.totalRecognizedRevenue).toBeGreaterThanOrEqual(0);
    
    if (waterfall.waterfall) {
      expect(Array.isArray(waterfall.waterfall)).toBe(true);
      
      // Should have expected components
      const componentTypes = waterfall.waterfall.map((c: any) => c.type);
      expect(componentTypes).toContain('opening');
      expect(componentTypes).toContain('closing');
      
      // Waterfall should balance
      const opening = waterfall.waterfall.find((c: any) => c.type === 'opening')?.amount || 0;
      const additions = waterfall.waterfall
        .filter((c: any) => c.type === 'addition')
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const subtractions = waterfall.waterfall
        .filter((c: any) => c.type === 'subtraction')
        .reduce((sum: number, c: any) => sum + Math.abs(c.amount), 0);
      const adjustments = waterfall.waterfall
        .filter((c: any) => c.type === 'adjustment')
        .reduce((sum: number, c: any) => sum + c.amount, 0);
      const closing = waterfall.waterfall.find((c: any) => c.type === 'closing')?.amount || 0;
      
      const expectedClosing = opening + additions - subtractions + adjustments;
      expect(closing).toBeCloseTo(expectedClosing, 2);
    }
  }
}

export const assertHelpers = AssertionHelpers;