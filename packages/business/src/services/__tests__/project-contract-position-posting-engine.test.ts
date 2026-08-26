import { describe, expect, it } from 'vitest';
import {
  calculateProjectContractPositionPosting,
  calculateProjectContractRevenueAdjustment,
} from '../project-contract-position-posting-engine';

describe('calculateProjectContractPositionPosting', () => {
  it('posts G-002 revenue ahead of billing to a contract asset', () => {
    const result = calculateProjectContractPositionPosting(
      { cumulativeRecognized: '0.00', cumulativeBilled: '0.00' },
      { kind: 'revenue_recognition', amount: '1500.00' },
    );

    expect(result.lines).toEqual([
      { accountRole: 'contract_asset', debitAmount: '1500.00', creditAmount: '0.00' },
      { accountRole: 'revenue', debitAmount: '0.00', creditAmount: '1500.00' },
    ]);
    expect(result.next).toMatchObject({ contractAsset: '1500.00', contractLiability: '0.00' });
  });

  it('posts G-003 recognition against an advance-billing liability', () => {
    const result = calculateProjectContractPositionPosting(
      { cumulativeRecognized: '0.00', cumulativeBilled: '12000.00' },
      { kind: 'revenue_recognition', amount: '1000.00' },
    );

    expect(result.lines).toEqual([
      { accountRole: 'contract_liability', debitAmount: '1000.00', creditAmount: '0.00' },
      { accountRole: 'revenue', debitAmount: '0.00', creditAmount: '1000.00' },
    ]);
    expect(result.next.contractLiability).toBe('11000.00');
  });

  it('posts G-005 billing by consuming the asset before creating a liability', () => {
    const result = calculateProjectContractPositionPosting(
      { cumulativeRecognized: '50000.00', cumulativeBilled: '20000.00' },
      { kind: 'billing', amount: '40000.00' },
    );

    expect(result.lines).toEqual([
      { accountRole: 'accounts_receivable', debitAmount: '40000.00', creditAmount: '0.00' },
      { accountRole: 'contract_asset', debitAmount: '0.00', creditAmount: '30000.00' },
      { accountRole: 'contract_liability', debitAmount: '0.00', creditAmount: '10000.00' },
    ]);
    expect(result.next).toMatchObject({ contractAsset: '0.00', contractLiability: '10000.00' });
    expect(result.totalDebits).toBe(result.totalCredits);
  });

  it('crosses from liability to asset when recognition exceeds prior billing', () => {
    const result = calculateProjectContractPositionPosting(
      { cumulativeRecognized: '5000.00', cumulativeBilled: '8000.00' },
      { kind: 'revenue_recognition', amount: '5000.00' },
    );

    expect(result.lines).toEqual([
      { accountRole: 'contract_liability', debitAmount: '3000.00', creditAmount: '0.00' },
      { accountRole: 'contract_asset', debitAmount: '2000.00', creditAmount: '0.00' },
      { accountRole: 'revenue', debitAmount: '0.00', creditAmount: '5000.00' },
    ]);
    expect(result.next).toMatchObject({ contractAsset: '2000.00', contractLiability: '0.00' });
  });
});

describe('calculateProjectContractRevenueAdjustment', () => {
  it('posts the G006 negative catch-up against the existing contract asset', () => {
    expect(calculateProjectContractRevenueAdjustment({
      cumulativeRecognized: '25000.00',
      cumulativeBilled: '0.00',
    }, '-3000.00')).toMatchObject({
      next: {
        cumulativeRecognized: '22000.00',
        contractAsset: '22000.00',
        contractLiability: '0.00',
      },
      lines: [
        { accountRole: 'contract_asset', debitAmount: '0.00', creditAmount: '3000.00' },
        { accountRole: 'revenue', debitAmount: '3000.00', creditAmount: '0.00' },
      ],
      totalDebits: '3000.00',
      totalCredits: '3000.00',
    });
  });
});
