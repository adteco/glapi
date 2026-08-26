import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@glapi/database', () => ({ db: {} }));
vi.mock('@glapi/api-service', () => {
  class MockServiceError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number,
    ) {
      super(message);
    }
    toApiError() {
      return { code: this.code, message: this.message };
    }
  }
  return {
    ProjectBillingQueueService: vi.fn(),
    ProjectContractModificationService: vi.fn(),
    ProjectRevenueGlPostingService: vi.fn(),
    ProjectRevenuePlanService: vi.fn(),
    ProjectRevenueRecognitionReversalService: vi.fn(),
    ProjectRevenueRecognitionRunService: vi.fn(),
    ServiceError: MockServiceError,
  };
});

import { ServiceError } from '@glapi/api-service';
import {
  registerProjectAccountingRoutes,
  type ProjectAccountingServices,
} from '../project-accounting-routes';

function serviceHarness() {
  const methods = {
    listCandidates: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    previewInvoiceDrafts: vi.fn().mockResolvedValue({ draftCount: 0 }),
    createInvoiceDrafts: vi.fn().mockResolvedValue({ invoices: [], replayed: false }),
    previewPlan: vi.fn().mockResolvedValue({ obligations: [] }),
    generatePlan: vi.fn().mockResolvedValue({ replayed: false }),
    getPlan: vi.fn().mockResolvedValue({ obligations: [] }),
    previewRun: vi.fn().mockResolvedValue({ dryRun: true }),
    executeRun: vi.fn().mockResolvedValue({ run: { id: 'run-1' } }),
    postRecognitionRun: vi.fn().mockResolvedValue({ glTransactionId: 'gl-1' }),
    postProjectInvoice: vi.fn().mockResolvedValue({ glTransactionId: 'gl-2' }),
    previewModification: vi.fn().mockResolvedValue({ dryRun: true }),
    applyModification: vi.fn().mockResolvedValue({ modification: { id: 'mod-1' } }),
    reverseRun: vi.fn().mockResolvedValue({ reversal: { id: 'rev-1' } }),
  };
  const contexts: Array<{ organizationId: string; userId?: string }> = [];
  const factory = <T extends object>(value: T) => (context: { organizationId: string; userId?: string }) => {
    contexts.push(context);
    return value;
  };
  const services: ProjectAccountingServices = {
    billing: factory({
      listCandidates: methods.listCandidates,
      previewInvoiceDrafts: methods.previewInvoiceDrafts,
      createInvoiceDrafts: methods.createInvoiceDrafts,
    }),
    plans: factory({
      previewPlan: methods.previewPlan,
      generatePlan: methods.generatePlan,
      getPlan: methods.getPlan,
    }),
    recognition: factory({ previewRun: methods.previewRun, executeRun: methods.executeRun }),
    posting: factory({
      postRecognitionRun: methods.postRecognitionRun,
      postProjectInvoice: methods.postProjectInvoice,
    }),
    modifications: factory({
      previewModification: methods.previewModification,
      applyModification: methods.applyModification,
    }),
    reversals: factory({ reverseRun: methods.reverseRun }),
  };
  return { contexts, methods, services };
}

async function serverWith(harness: ReturnType<typeof serviceHarness>) {
  const server = Fastify();
  await server.register(registerProjectAccountingRoutes, {
    resolveUser: async () => ({ organizationId: 'org-1', entityId: 'user-1' }),
    services: harness.services,
  });
  return server;
}

describe('project accounting Fastify routes', () => {
  it('passes tenant context and candidate filters to the billing queue', async () => {
    const harness = serviceHarness();
    const server = await serverWith(harness);
    const response = await server.inject({
      method: 'GET',
      url: '/v1/project-billing/candidates?page=2&limit=10&sourceTypes=TIME_ENTRY,PROJECT_TASK',
    });

    expect(response.statusCode).toBe(200);
    expect(harness.contexts[0]).toEqual({ organizationId: 'org-1', userId: 'user-1' });
    expect(harness.methods.listCandidates).toHaveBeenCalledWith(
      { page: 2, limit: 10 },
      { sourceTypes: ['TIME_ENTRY', 'PROJECT_TASK'] },
    );
  });

  it('uses Idempotency-Key for financial mutations', async () => {
    const harness = serviceHarness();
    const server = await serverWith(harness);
    const response = await server.inject({
      method: 'POST',
      url: '/v1/project-billing/drafts',
      headers: { 'idempotency-key': 'billing-key-1' },
      payload: { candidateIds: ['TIME_ENTRY:entry-1'], invoiceDate: '2026-08-31' },
    });

    expect(response.statusCode).toBe(200);
    expect(harness.methods.createInvoiceDrafts).toHaveBeenCalledWith({
      candidateIds: ['TIME_ENTRY:entry-1'],
      invoiceDate: '2026-08-31',
      idempotencyKey: 'billing-key-1',
    });
  });

  it('exposes modification and reversal commands on the production REST path', async () => {
    const harness = serviceHarness();
    const server = await serverWith(harness);
    const modification = await server.inject({
      method: 'POST',
      url: '/v1/project-revenue/modifications',
      headers: { 'idempotency-key': 'mod-key-1' },
      payload: {
        priorVersionId: 'version-1', revisedVersionId: 'version-2',
        method: 'cumulative_catch_up', effectiveDate: '2026-08-31',
        progressPercentage: '20', reason: 'Scope change',
      },
    });
    const reversal = await server.inject({
      method: 'POST',
      url: '/v1/project-revenue/recognition-reversals',
      headers: { 'idempotency-key': 'rev-key-1' },
      payload: {
        subsidiaryId: 'subsidiary-1', originalRunId: 'run-1',
        accountingPeriodId: 'period-2', reversalDate: '2026-09-05', reason: 'Invalid evidence',
      },
    });

    expect(modification.statusCode).toBe(200);
    expect(reversal.statusCode).toBe(200);
    expect(harness.methods.applyModification).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'cumulative_catch_up' }),
      'mod-key-1',
    );
    expect(harness.methods.reverseRun).toHaveBeenCalledWith(
      expect.objectContaining({ originalRunId: 'run-1' }),
      'rev-key-1',
    );
  });

  it('preserves the service error contract', async () => {
    const harness = serviceHarness();
    harness.methods.executeRun.mockRejectedValue(
      new ServiceError('Period is closed', 'REVENUE_RECOGNITION_PERIOD_CLOSED', 409),
    );
    const server = await serverWith(harness);
    const response = await server.inject({
      method: 'POST',
      url: '/v1/project-revenue/recognition-runs',
      headers: { 'idempotency-key': 'run-key-1' },
      payload: {
        subsidiaryId: 'subsidiary-1', accountingPeriodId: 'period-1',
        recognitionDate: '2026-08-31',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'REVENUE_RECOGNITION_PERIOD_CLOSED', message: 'Period is closed' },
    });
  });
});
