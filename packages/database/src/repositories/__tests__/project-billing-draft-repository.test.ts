import { describe, expect, it, vi } from 'vitest';

vi.mock('../base-repository', () => ({
  BaseRepository: class {
    protected db: unknown;

    constructor(db: unknown) {
      this.db = db;
    }
  },
}));

import {
  ProjectBillingDraftRepository,
  type CreateProjectBillingDraftsInput,
} from '../project-billing-draft-repository';
import { invoiceLineItems } from '../../db/schema/invoice-line-items';
import { invoiceSourceAllocations } from '../../db/schema/invoice-source-allocations';
import { invoices } from '../../db/schema/invoices';
import { projectBillingRequests } from '../../db/schema/project-billing-requests';
import { timeEntries } from '../../db/schema/time-entries';

function request(): CreateProjectBillingDraftsInput {
  return {
    organizationId: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: 'billing-run-1',
    requestHash: 'a'.repeat(64),
    invoiceDate: '2026-08-15',
    groups: [
      {
        groupKey: 'customer-1:project-1:USD',
        customerId: '22222222-2222-4222-8222-222222222222',
        projectId: '33333333-3333-4333-8333-333333333333',
        projectIds: ['33333333-3333-4333-8333-333333333333'],
        projectContractIds: ['44444444-4444-4444-8444-444444444444'],
        projectContractVersionIds: ['55555555-5555-4555-8555-555555555555'],
        currencyCode: 'USD',
        lines: [
          {
            candidateId: 'TIME_ENTRY:66666666-6666-4666-8666-666666666666',
            sourceType: 'TIME_ENTRY',
            sourceId: '66666666-6666-4666-8666-666666666666',
            description: 'Consulting',
            quantity: '2.5000',
            unitRate: '100.0000',
            amountMinor: 25000,
            currencyCode: 'USD',
            sourceHours: '2.5000',
            billingRuleId: '77777777-7777-4777-8777-777777777777',
          },
        ],
      },
    ],
  };
}

function createHarness(
  options: {
    receipt?: unknown;
    existing?: unknown;
    allocationError?: unknown;
  } = {},
) {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updated: Array<{ table: unknown; values: unknown }> = [];
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  const receipt =
    options.receipt === undefined
      ? { id: '88888888-8888-4888-8888-888888888888' }
      : options.receipt;

  const tx = {
    execute,
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        const returningRows =
          table === projectBillingRequests
            ? receipt
              ? [receipt]
              : []
            : table === invoices
              ? [{ id: 'invoice-1', invoiceNumber: 'PB-1' }]
              : table === invoiceLineItems
                ? [{ id: 'line-1' }]
                : [];
        return {
          onConflictDoNothing: () => ({ returning: async () => returningRows }),
          returning: async () => returningRows,
          then: (
            resolve: (value: unknown) => unknown,
            reject: (reason: unknown) => unknown,
          ) =>
            (table === invoiceSourceAllocations && options.allocationError
              ? Promise.reject(options.allocationError)
              : Promise.resolve(undefined)
            ).then(resolve, reject),
        };
      },
    })),
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: () => ({
          for: async () =>
            table === timeEntries
              ? [{ id: '66666666-6666-4666-8666-666666666666' }]
              : [],
          limit: async () => (options.existing ? [options.existing] : []),
        }),
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updated.push({ table, values });
          return [];
        },
      }),
    })),
  };
  const db = {
    transaction: (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
  };
  return { db, tx, inserted, updated, execute };
}

describe('ProjectBillingDraftRepository', () => {
  it('writes invoice, line, exact allocation, source marker, and receipt in one transaction', async () => {
    const harness = createHarness();
    const repository = new ProjectBillingDraftRepository(harness.db as never);

    const result = await repository.createDrafts(request());

    expect(result).toMatchObject({
      replayed: false,
      invoices: [{ totalAmount: '250.00' }],
    });
    expect(harness.execute).toHaveBeenCalledTimes(1);
    expect(
      harness.inserted.find((entry) => entry.table === invoiceSourceAllocations)
        ?.values,
    ).toMatchObject({
      sourceType: 'TIME_ENTRY',
      sourceId: '66666666-6666-4666-8666-666666666666',
      sourceHours: '2.5000',
      sourceAmountMinor: 25000,
      currencyCode: 'USD',
      allocationStatus: 'active',
    });
    expect(harness.updated.some((entry) => entry.table === timeEntries)).toBe(
      true,
    );
    expect(
      harness.updated.find((entry) => entry.table === projectBillingRequests)
        ?.values,
    ).toMatchObject({ status: 'completed', response: expect.any(Object) });
  });

  it('returns a completed exact replay without touching billing sources', async () => {
    const response = {
      replayed: false,
      idempotencyKey: 'billing-run-1',
      invoices: [],
    };
    const harness = createHarness({
      receipt: null,
      existing: { requestHash: 'a'.repeat(64), status: 'completed', response },
    });
    const repository = new ProjectBillingDraftRepository(harness.db as never);

    await expect(repository.createDrafts(request())).resolves.toEqual({
      ...response,
      replayed: true,
    });
    expect(harness.execute).not.toHaveBeenCalled();
    expect(harness.inserted.some((entry) => entry.table === invoices)).toBe(
      false,
    );
  });

  it('rejects idempotency key reuse with a different request hash', async () => {
    const harness = createHarness({
      receipt: null,
      existing: {
        requestHash: 'b'.repeat(64),
        status: 'completed',
        response: {},
      },
    });
    const repository = new ProjectBillingDraftRepository(harness.db as never);

    await expect(repository.createDrafts(request())).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(harness.inserted.some((entry) => entry.table === invoices)).toBe(
      false,
    );
  });

  it('maps an active-allocation uniqueness race to a billing conflict', async () => {
    const harness = createHarness({
      allocationError: {
        code: '23505',
        constraint: 'ux_invoice_source_allocations_active_source',
      },
    });
    const repository = new ProjectBillingDraftRepository(harness.db as never);

    await expect(repository.createDrafts(request())).rejects.toMatchObject({
      code: 'BILLING_SOURCE_CONFLICT',
    });
  });
});
