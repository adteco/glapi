import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@glapi/database', () => ({ ProjectRevenueGlPostingRepository: vi.fn() }));
vi.mock('@glapi/business', async () =>
  import('../../../../business/src/services/project-contract-position-posting-engine'),
);

import type {
  ProjectGlAccountCandidate,
  ProjectRevenueGlSourceRow,
} from '@glapi/database';
import {
  ProjectRevenueGlPostingService,
  type ProjectRevenueGlPostingRepositoryLike,
} from '../project-revenue-gl-posting-service';

function source(overrides: Partial<ProjectRevenueGlSourceRow> = {}): ProjectRevenueGlSourceRow {
  return {
    recognitionRunId: 'run-1',
    accountingPeriodId: 'period-1',
    recognitionDate: '2026-01-31',
    subsidiaryId: 'subsidiary-1',
    scheduleId: 'schedule-1',
    performanceObligationId: 'obligation-1',
    projectContractId: 'contract-1',
    projectContractVersionId: 'version-1',
    projectId: 'project-1',
    customerId: 'customer-1',
    itemId: 'item-1',
    currencyCode: 'USD',
    functionalCurrencyCode: 'USD',
    exchangeRate: '1.00000000',
    recognizedAmount: '1000.00',
    ...overrides,
  };
}

function account(accountRole: string, accountId: string): ProjectGlAccountCandidate {
  return {
    accountRole,
    accountId,
    subsidiaryId: null,
    itemId: null,
    priority: 100,
    isDefault: true,
  };
}

describe('ProjectRevenueGlPostingService', () => {
  let findRunSource: ReturnType<typeof vi.fn>;
  let findPriorContractState: ReturnType<typeof vi.fn>;
  let findAccountCandidates: ReturnType<typeof vi.fn>;
  let findBillingSource: ReturnType<typeof vi.fn>;
  let findPriorBillingContractState: ReturnType<typeof vi.fn>;
  let findOpenPeriod: ReturnType<typeof vi.fn>;
  let persist: ReturnType<typeof vi.fn>;
  let service: ProjectRevenueGlPostingService;

  beforeEach(() => {
    findRunSource = vi.fn().mockResolvedValue([source()]);
    findPriorContractState = vi.fn().mockResolvedValue({
      cumulativeRecognized: '0.00',
      cumulativeBilledMinor: 0,
    });
    findAccountCandidates = vi.fn().mockResolvedValue([
      account('revenue', 'account-revenue'),
      account('contract_asset', 'account-asset'),
      account('contract_liability', 'account-liability'),
    ]);
    findBillingSource = vi.fn().mockResolvedValue([]);
    findPriorBillingContractState = vi.fn().mockResolvedValue({
      cumulativeRecognized: '0.00',
      cumulativeBilledMinor: 0,
    });
    findOpenPeriod = vi.fn().mockResolvedValue({ id: 'period-1' });
    persist = vi.fn().mockResolvedValue({ transaction: { id: 'gl-1' }, replayed: false });
    service = new ProjectRevenueGlPostingService(
      { organizationId: 'org-1', userId: 'user-1' },
      {
        repository: {
          findRunSource,
          findPriorContractState,
          findAccountCandidates,
          findBillingSource,
          findPriorBillingContractState,
          findOpenPeriod,
          persist,
        } as ProjectRevenueGlPostingRepositoryLike,
      },
    );
  });

  it('posts G-002 revenue ahead of billing to contract asset and revenue', async () => {
    const result = await service.postRecognitionRun('run-1', 'post-1');

    expect(result).toMatchObject({
      glTransactionId: 'gl-1',
      totalDebitAmount: '1000.0000',
      totalCreditAmount: '1000.0000',
      contractPositions: [
        { projectContractId: 'contract-1', contractAsset: '1000.00', contractLiability: '0.00' },
      ],
    });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        recognitionRunId: 'run-1',
        lines: [
          expect.objectContaining({ accountId: 'account-asset', debitAmount: '1000.00' }),
          expect.objectContaining({ accountId: 'account-revenue', creditAmount: '1000.00' }),
        ],
      }),
    );
  });

  it('posts G-003 recognition by releasing an advance-billing liability', async () => {
    findPriorContractState.mockResolvedValue({
      cumulativeRecognized: '0.00',
      cumulativeBilledMinor: 1_200_000,
    });

    const result = await service.postRecognitionRun('run-1', 'post-1');

    expect(result.contractPositions[0]).toMatchObject({
      cumulativeRecognized: '1000.00',
      cumulativeBilled: '12000.00',
      contractAsset: '0.00',
      contractLiability: '11000.00',
    });
    expect(persist.mock.calls[0][0].lines).toEqual([
      expect.objectContaining({ accountId: 'account-liability', debitAmount: '1000.00' }),
      expect.objectContaining({ accountId: 'account-revenue', creditAmount: '1000.00' }),
    ]);
  });

  it('preserves functional-currency balance using the contract exchange rate', async () => {
    findRunSource.mockResolvedValue([
      source({ currencyCode: 'EUR', functionalCurrencyCode: 'USD', exchangeRate: '1.10000000' }),
    ]);

    const result = await service.postRecognitionRun('run-1', 'post-1');

    expect(result.totalDebitAmount).toBe('1100.0000');
    expect(result.totalCreditAmount).toBe('1100.0000');
    expect(persist.mock.calls[0][0]).toMatchObject({
      currencyCode: 'EUR',
      functionalCurrencyCode: 'USD',
      totalBaseAmount: '1100.0000',
    });
  });

  it('rejects posting when a required configured account is missing', async () => {
    findAccountCandidates.mockResolvedValue([account('revenue', 'account-revenue')]);

    await expect(service.postRecognitionRun('run-1', 'post-1')).rejects.toMatchObject({
      code: 'PROJECT_REVENUE_GL_MAPPING_MISSING',
      statusCode: 409,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('posts G-005 billing by clearing the contract asset before creating a liability', async () => {
    findBillingSource.mockResolvedValue([
      {
        invoiceId: 'invoice-1',
        invoiceDate: '2026-02-28',
        subsidiaryId: 'subsidiary-1',
        allocationId: 'allocation-1',
        projectContractId: 'contract-1',
        projectContractVersionId: 'version-1',
        projectId: 'project-1',
        customerId: 'customer-1',
        performanceObligationId: 'obligation-1',
        currencyCode: 'USD',
        functionalCurrencyCode: 'USD',
        exchangeRate: '1.00000000',
        billedAmountMinor: 4_000_000,
      },
    ]);
    findPriorBillingContractState.mockResolvedValue({
      cumulativeRecognized: '50000.00',
      cumulativeBilledMinor: 2_000_000,
    });
    findAccountCandidates.mockResolvedValue([
      account('ar', 'account-ar'),
      account('contract_asset', 'account-asset'),
      account('contract_liability', 'account-liability'),
    ]);

    const result = await service.postProjectInvoice('invoice-1', 'billing-post-1');

    expect(result.contractPositions[0]).toMatchObject({
      cumulativeRecognized: '50000.00',
      cumulativeBilled: '60000.00',
      contractAsset: '0.00',
      contractLiability: '10000.00',
    });
    expect(persist.mock.calls[0][0]).toMatchObject({
      sourceEventType: 'project_billing',
      sourceEventId: 'invoice-1',
      lines: [
        expect.objectContaining({ accountId: 'account-ar', debitAmount: '40000.00' }),
        expect.objectContaining({ accountId: 'account-asset', creditAmount: '30000.00' }),
        expect.objectContaining({ accountId: 'account-liability', creditAmount: '10000.00' }),
      ],
    });
  });

  it('rejects project invoice posting into a closed period', async () => {
    findBillingSource.mockResolvedValue([
      {
        invoiceId: 'invoice-1',
        invoiceDate: '2026-02-28',
        subsidiaryId: 'subsidiary-1',
        allocationId: 'allocation-1',
        projectContractId: 'contract-1',
        projectContractVersionId: 'version-1',
        projectId: 'project-1',
        customerId: 'customer-1',
        performanceObligationId: null,
        currencyCode: 'USD',
        functionalCurrencyCode: 'USD',
        exchangeRate: '1.00000000',
        billedAmountMinor: 10000,
      },
    ]);
    findOpenPeriod.mockResolvedValue(null);

    await expect(service.postProjectInvoice('invoice-1', 'billing-post-1')).rejects.toMatchObject({
      code: 'PROJECT_BILLING_GL_PERIOD_CLOSED',
      statusCode: 409,
    });
    expect(persist).not.toHaveBeenCalled();
  });
});
