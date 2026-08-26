import { describe, expect, it } from 'vitest';
import { calculateProjectContractModification } from '../project-contract-modification-engine';

describe('calculateProjectContractModification', () => {
  it('matches G-006 cumulative catch-up after a non-distinct scope change', () => {
    const result = calculateProjectContractModification({
      method: 'cumulative_catch_up',
      priorAllocatedAmount: '100000.00',
      revisedAllocatedAmount: '110000.00',
      priorRecognizedAmount: '25000.00',
      progressPercentage: '20.000000',
    });

    expect(result).toMatchObject({
      revisedCumulativeRevenue: '22000.00',
      catchUpAdjustment: '-3000.00',
      remainingAllocation: '88000.00',
      supersedeUnrecognizedSchedules: true,
    });
  });

  it('applies a prospective change only to the remaining allocation', () => {
    const result = calculateProjectContractModification({
      method: 'prospective',
      priorAllocatedAmount: '100000.00',
      revisedAllocatedAmount: '120000.00',
      priorRecognizedAmount: '25000.00',
    });

    expect(result).toMatchObject({
      revisedCumulativeRevenue: '25000.00',
      catchUpAdjustment: '0.00',
      remainingAllocation: '95000.00',
    });
  });

  it('keeps a separate contract from superseding the original schedules', () => {
    expect(
      calculateProjectContractModification({
        method: 'separate_contract',
        priorAllocatedAmount: '100000.00',
        revisedAllocatedAmount: '100000.00',
        priorRecognizedAmount: '25000.00',
      }).supersedeUnrecognizedSchedules,
    ).toBe(false);
  });
});
