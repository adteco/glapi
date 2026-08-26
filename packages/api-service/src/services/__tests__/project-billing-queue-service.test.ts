import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('@glapi/database', () => ({
  ProjectBillingQueueRepository: vi.fn(),
  ProjectContractRepository: vi.fn(),
  ProjectBillingDraftRepository: vi.fn(),
  ProjectBillingDraftConflictError: class ProjectBillingDraftConflictError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

import {
  ProjectBillingQueueService,
  type ProjectBillingQueueRepositoryLike,
  type ProjectBillingRateRepositoryLike,
} from '../project-billing-queue-service';
import type { RawProjectBillingCandidate } from '@glapi/database';

function candidate(
  overrides: Partial<RawProjectBillingCandidate> = {},
): RawProjectBillingCandidate {
  return {
    sourceType: 'TIME_ENTRY',
    sourceId: 'source-1',
    organizationId: 'org-1',
    customerId: 'customer-1',
    customerName: 'Acme',
    projectId: 'project-1',
    projectCode: 'P-001',
    projectName: 'Implementation',
    projectContractId: 'contract-1',
    projectContractVersionId: 'version-1',
    contractNumber: 'C-001',
    billingRuleId: 'rule-1',
    projectContractLineId: null,
    billingRuleName: 'Professional services',
    grouping: 'customer_project',
    currencyCode: 'USD',
    serviceDate: '2026-08-01',
    description: 'Architecture',
    quantity: '2.5000',
    sourceOverrideRate: null,
    sourceOverrideField: 'billingRate',
    fixedAmount: null,
    entityId: 'employee-1',
    projectTaskId: null,
    itemId: null,
    projectCostCodeId: 'cost-code-1',
    ruleDefaultRate: '100.000000',
    rulePriority: 100,
    ...overrides,
  };
}

describe('ProjectBillingQueueService', () => {
  let listEligibleCandidates: ReturnType<typeof vi.fn>;
  let resolveEffectiveRate: ReturnType<typeof vi.fn>;
  let createDrafts: ReturnType<typeof vi.fn>;
  let findRequest: ReturnType<typeof vi.fn>;
  let service: ProjectBillingQueueService;

  beforeEach(() => {
    listEligibleCandidates = vi.fn().mockResolvedValue([]);
    resolveEffectiveRate = vi.fn().mockResolvedValue(null);
    createDrafts = vi.fn().mockResolvedValue({
      replayed: false,
      idempotencyKey: 'billing-run-1',
      invoices: [],
    });
    findRequest = vi.fn().mockResolvedValue(null);
    service = new ProjectBillingQueueService(
      { organizationId: 'org-1' },
      {
        repository: {
          listEligibleCandidates,
        } as ProjectBillingQueueRepositoryLike,
        rateRepository: {
          resolveEffectiveRate,
        } as ProjectBillingRateRepositoryLike,
        draftRepository: { createDrafts, findRequest },
      },
    );
  });

  it('passes tenant and filters to the read model and paginates normalized candidates', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({ sourceId: 'source-1' }),
      candidate({ sourceId: 'source-2' }),
      candidate({ sourceId: 'source-3' }),
    ]);

    const result = await service.listCandidates(
      { page: 2, limit: 2 },
      { customerId: 'customer-1', asOfDate: '2026-08-15' },
    );

    expect(listEligibleCandidates).toHaveBeenCalledWith('org-1', {
      customerId: 'customer-1',
      asOfDate: '2026-08-15',
    });
    expect(result).toMatchObject({
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
    expect(result.data.map((row) => row.sourceId)).toEqual(['source-3']);
  });

  it('explains a scoped rate and calculates quantity times rate without float drift', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({ quantity: '3.3333' }),
    ]);
    resolveEffectiveRate.mockResolvedValue({
      id: 'rate-person-1',
      rateScope: 'person',
      unitRate: '150.125000',
    });

    const result = await service.listCandidates({}, { asOfDate: '2026-08-15' });

    expect(result.data[0]).toMatchObject({
      unitRate: '150.1250',
      amount: '500.4117',
      amountMinor: 50041,
      pricingStatus: 'ready',
      derivation: {
        kind: 'rate_card',
        rateId: 'rate-person-1',
        rateScope: 'person',
      },
    });
    expect(resolveEffectiveRate).toHaveBeenCalledWith(
      'rule-1',
      'org-1',
      expect.objectContaining({
        entityId: 'employee-1',
        projectCostCodeId: 'cost-code-1',
      }),
    );
  });

  it('uses source overrides before rate cards and preserves calculation lineage', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({ sourceOverrideRate: '175.2500', quantity: '2' }),
    ]);

    const result = await service.listCandidates({}, { asOfDate: '2026-08-15' });

    expect(resolveEffectiveRate).not.toHaveBeenCalled();
    expect(result.data[0]).toMatchObject({
      amount: '350.5000',
      derivation: { kind: 'source_override', sourceField: 'billingRate' },
    });
  });

  it('groups T&M and fixed-fee candidates into a draft preview with exact totals', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({
        sourceId: 'time-1',
        sourceOverrideRate: '100',
        quantity: '2.5',
      }),
      candidate({
        sourceType: 'PROJECT_MILESTONE',
        sourceId: 'milestone-1',
        serviceDate: '2026-08-10',
        quantity: '1',
        fixedAmount: '1250.25',
        sourceOverrideField: null,
        ruleDefaultRate: null,
        entityId: null,
        projectCostCodeId: null,
      }),
    ]);

    const result = await service.previewInvoiceDrafts({
      asOfDate: '2026-08-15',
    });

    expect(result).toMatchObject({
      draftCount: 1,
      candidateCount: 2,
      grandTotal: '1500.2500',
    });
    expect(result.drafts[0]).toMatchObject({
      lineCount: 2,
      subtotal: '1500.2500',
      subtotalMinor: 150025,
    });
    expect(result.drafts[0].lines[1].derivation).toEqual({
      kind: 'fixed_amount',
      billingRuleId: 'rule-1',
    });
  });

  it('blocks invoice previews when a candidate has no derivable rate', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({ ruleDefaultRate: null }),
    ]);

    await expect(
      service.previewInvoiceDrafts({ asOfDate: '2026-08-15' }),
    ).rejects.toMatchObject({
      code: 'PROJECT_BILLING_RATE_MISSING',
      statusCode: 409,
    });
  });

  it('creates drafts with a stable request hash and exact source lineage', async () => {
    listEligibleCandidates.mockResolvedValue([
      candidate({
        sourceId: '11111111-1111-4111-8111-111111111111',
        sourceOverrideRate: '125.25',
        quantity: '2',
      }),
    ]);

    await service.createInvoiceDrafts({
      idempotencyKey: 'billing-run-1',
      candidateIds: ['TIME_ENTRY:11111111-1111-4111-8111-111111111111'],
      invoiceDate: '2026-08-15',
      dueDate: '2026-09-14',
      asOfDate: '2026-08-15',
    });

    expect(createDrafts).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        idempotencyKey: 'billing-run-1',
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        groups: [
          expect.objectContaining({
            customerId: 'customer-1',
            projectContractIds: ['contract-1'],
            lines: [
              expect.objectContaining({
                sourceType: 'TIME_ENTRY',
                sourceId: '11111111-1111-4111-8111-111111111111',
                quantity: '2.0000',
                amountMinor: 25050,
                currencyCode: 'USD',
              }),
            ],
          }),
        ],
      }),
    );
  });

  it('rejects stale selections and invalid invoice dates before writing', async () => {
    listEligibleCandidates.mockResolvedValue([]);

    await expect(
      service.createInvoiceDrafts({
        idempotencyKey: 'billing-run-1',
        candidateIds: ['TIME_ENTRY:11111111-1111-4111-8111-111111111111'],
        invoiceDate: '2026-08-15',
        asOfDate: '2026-08-15',
      }),
    ).rejects.toMatchObject({ code: 'PROJECT_BILLING_CANDIDATE_NOT_FOUND' });

    await expect(
      service.createInvoiceDrafts({
        idempotencyKey: 'billing-run-2',
        candidateIds: ['TIME_ENTRY:11111111-1111-4111-8111-111111111111'],
        invoiceDate: '2026-08-15',
        dueDate: '2026-08-14',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PROJECT_INVOICE_DATE' });
    expect(createDrafts).not.toHaveBeenCalled();
  });

  it('returns an exact replay before rechecking sources that already left the queue', async () => {
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          candidateIds: ['TIME_ENTRY:11111111-1111-4111-8111-111111111111'],
          invoiceDate: '2026-08-15',
          dueDate: null,
          asOfDate: '2026-08-15',
          customerId: null,
          projectId: null,
          sourceTypes: null,
        }),
      )
      .digest('hex');
    findRequest.mockResolvedValue({
      requestHash,
      status: 'completed',
      response: {
        replayed: false,
        idempotencyKey: 'billing-run-1',
        invoices: [{ invoiceId: 'invoice-1' }],
      },
    });

    const result = await service.createInvoiceDrafts({
      idempotencyKey: 'billing-run-1',
      candidateIds: ['TIME_ENTRY:11111111-1111-4111-8111-111111111111'],
      invoiceDate: '2026-08-15',
      asOfDate: '2026-08-15',
    });

    expect(result).toMatchObject({
      replayed: true,
      invoices: [{ invoiceId: 'invoice-1' }],
    });
    expect(listEligibleCandidates).not.toHaveBeenCalled();
    expect(createDrafts).not.toHaveBeenCalled();
  });

  it('requires an organization context before querying candidates', async () => {
    const noTenantService = new ProjectBillingQueueService(
      {},
      {
        repository: {
          listEligibleCandidates,
        } as ProjectBillingQueueRepositoryLike,
        rateRepository: {
          resolveEffectiveRate,
        } as ProjectBillingRateRepositoryLike,
        draftRepository: { createDrafts, findRequest },
      },
    );

    await expect(noTenantService.listCandidates()).rejects.toMatchObject({
      code: 'MISSING_ORGANIZATION_CONTEXT',
    });
  });
});
