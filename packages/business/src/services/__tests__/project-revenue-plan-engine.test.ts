import { describe, expect, it } from 'vitest';
import { generateProjectRevenuePlan } from '../project-revenue-plan-engine';

describe('generateProjectRevenuePlan', () => {
  it('matches G-003 advance billing with an independent twelve-month revenue schedule', () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: 'contract-fixed-001',
      projectContractVersionId: 'version-1',
      transactionPrice: '12000.00',
      currencyCode: 'USD',
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      lines: [
        {
          id: 'stand-ready-service',
          description: 'Stand-ready service',
          transactionPrice: '12000.00',
          sspAmount: '12000.00',
          revenueTiming: 'over_time',
          recognitionMethod: 'elapsed_time',
          serviceStartDate: '2026-01-01',
          serviceEndDate: '2026-12-31',
        },
      ],
    });

    expect(plan.totalAllocated).toBe('12000.00');
    expect(plan.obligations[0].schedules).toHaveLength(12);
    expect(plan.obligations[0].schedules.map((row) => row.scheduledAmount))
      .toEqual(Array(12).fill('1000.00'));
  });

  it('matches G-004 proportional SSP allocation and keeps billing milestones out of revenue timing', () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: 'contract-fixed-004',
      projectContractVersionId: 'version-1',
      transactionPrice: '108000.00',
      currencyCode: 'USD',
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      lines: [
        {
          id: 'implementation',
          description: 'Implementation',
          transactionPrice: '54000.00',
          sspAmount: '48000.00',
          revenueTiming: 'point_in_time',
          recognitionMethod: 'manual_output',
          serviceStartDate: '2026-01-01',
          serviceEndDate: '2026-02-15',
        },
        {
          id: 'support',
          description: 'Twelve months support',
          transactionPrice: '54000.00',
          sspAmount: '72000.00',
          revenueTiming: 'over_time',
          recognitionMethod: 'elapsed_time',
          serviceStartDate: '2026-01-01',
          serviceEndDate: '2026-12-31',
        },
      ],
    });

    expect(plan.obligations.map((obligation) => obligation.allocatedAmount))
      .toEqual(['43200.00', '64800.00']);
    expect(plan.obligations.map((obligation) => obligation.allocationPercentage))
      .toEqual(['40.000000', '60.000000']);
    expect(plan.obligations[0].schedules).toEqual([
      expect.objectContaining({ scheduleDate: '2026-02-15', scheduledAmount: '43200.00' }),
    ]);
    expect(plan.obligations[1].schedules[0].scheduledAmount).toBe('5400.00');
  });

  it('creates an evidence-driven open schedule for cost-to-cost progress', () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: 'contract-progress-001',
      projectContractVersionId: 'version-1',
      transactionPrice: '100000.00',
      currencyCode: 'USD',
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      lines: [
        {
          id: 'integrated-service',
          description: 'Integrated service',
          transactionPrice: '100000.00',
          revenueTiming: 'over_time',
          recognitionMethod: 'cost_to_cost',
        },
      ],
    });

    expect(plan.obligations[0].schedules).toEqual([
      expect.objectContaining({
        periodStartDate: '2026-01-01',
        periodEndDate: '2026-12-31',
        scheduledAmount: '100000.00',
        recognitionPattern: 'cost_to_cost',
        status: 'deferred',
      }),
    ]);
  });

  it('applies deterministic largest-remainder rounding to the stable line id', () => {
    const plan = generateProjectRevenuePlan({
      projectContractId: 'contract-rounding',
      projectContractVersionId: 'version-1',
      transactionPrice: '100.00',
      currencyCode: 'USD',
      contractStartDate: '2026-01-01',
      lines: ['a', 'b', 'c'].map((id) => ({
        id,
        description: id,
        transactionPrice: '33.33',
        sspAmount: '1.00',
        revenueTiming: 'point_in_time' as const,
        recognitionMethod: 'manual_output' as const,
      })),
    });

    expect(plan.obligations.map((obligation) => obligation.allocatedAmount))
      .toEqual(['33.34', '33.33', '33.33']);
    expect(plan.totalAllocated).toBe('100.00');
  });

  it('rejects a multi-obligation plan without SSP evidence', () => {
    expect(() => generateProjectRevenuePlan({
      projectContractId: 'contract-missing-ssp',
      projectContractVersionId: 'version-1',
      transactionPrice: '100.00',
      currencyCode: 'USD',
      contractStartDate: '2026-01-01',
      lines: ['a', 'b'].map((id) => ({
        id,
        description: id,
        transactionPrice: '50.00',
        revenueTiming: 'point_in_time' as const,
        recognitionMethod: 'manual_output' as const,
      })),
    })).toThrow(expect.objectContaining({ code: 'PROJECT_SSP_MISSING' }));
  });
});
