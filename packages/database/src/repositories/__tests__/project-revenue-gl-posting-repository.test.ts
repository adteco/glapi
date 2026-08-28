import { describe, expect, it, vi } from 'vitest';

vi.mock('../base-repository', () => ({
  BaseRepository: class {
    protected db: unknown;
    constructor(db: unknown) {
      this.db = db;
    }
  },
}));

import { glTransactionLines, glTransactions } from '../../db/schema/gl-transactions';
import { revenueJournalEntries } from '../../db/schema/revenue-journal-entries';
import {
  ProjectRevenueGlPostingRepository,
  type PersistProjectRevenueGlPostingInput,
} from '../project-revenue-gl-posting-repository';

function posting(): PersistProjectRevenueGlPostingInput {
  return {
    organizationId: 'org-1',
    sourceEventType: 'project_revenue_recognition',
    sourceEventId: 'run-1',
    description: 'Project ASC 606 revenue recognition',
    recognitionRunId: 'run-1',
    accountingPeriodId: 'period-1',
    subsidiaryId: 'subsidiary-1',
    postingDate: '2026-01-31',
    currencyCode: 'USD',
    functionalCurrencyCode: 'USD',
    exchangeRate: '1.00000000',
    totalBaseAmount: '1000.0000',
    idempotencyKey: 'post-1',
    postedBy: 'user-1',
    lines: [
      {
        accountId: 'asset-account',
        debitAmount: '1000.00',
        creditAmount: '0.00',
        baseDebitAmount: '1000.0000',
        baseCreditAmount: '0.0000',
        description: 'Contract asset',
        projectId: 'project-1',
        customerId: 'customer-1',
        projectContractId: 'contract-1',
        projectContractVersionId: 'version-1',
        performanceObligationId: 'obligation-1',
        revenueScheduleId: 'schedule-1',
      },
      {
        accountId: 'revenue-account',
        debitAmount: '0.00',
        creditAmount: '1000.00',
        baseDebitAmount: '0.0000',
        baseCreditAmount: '1000.0000',
        description: 'Revenue',
        projectId: 'project-1',
        customerId: 'customer-1',
        projectContractId: 'contract-1',
        projectContractVersionId: 'version-1',
        performanceObligationId: 'obligation-1',
        revenueScheduleId: 'schedule-1',
      },
    ],
  };
}

function harness(existing = false) {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  const updates: Array<{ table: unknown; values: unknown }> = [];
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => (existing ? [{ id: 'gl-existing' }] : []),
        }),
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table, values });
        return {
          returning: async () => [{ id: 'gl-1' }],
        };
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    })),
  };
  const db = { transaction: (callback: (value: typeof tx) => unknown) => callback(tx) };
  return { db, tx, inserts, updates };
}

describe('ProjectRevenueGlPostingRepository', () => {
  it('atomically writes a posted header, balanced dimensioned lines, and subledger reference', async () => {
    const state = harness();
    const repository = new ProjectRevenueGlPostingRepository(state.db as never);

    await expect(repository.persist(posting())).resolves.toMatchObject({ replayed: false });

    expect(state.inserts.find((row) => row.table === glTransactions)?.values).toMatchObject({
      sourceEventType: 'project_revenue_recognition',
      sourceEventId: 'run-1',
      totalDebitAmount: '1000.0000',
      totalCreditAmount: '1000.0000',
      status: 'POSTED',
    });
    expect(state.inserts.find((row) => row.table === glTransactionLines)?.values).toEqual([
      expect.objectContaining({
        customerId: 'customer-1',
        projectContractId: 'contract-1',
        performanceObligationId: 'obligation-1',
        sourceEventId: 'run-1',
      }),
      expect.objectContaining({ accountId: 'revenue-account', sourceEventId: 'run-1' }),
    ]);
    expect(state.updates.find((row) => row.table === revenueJournalEntries)?.values).toEqual({
      status: 'posted',
      journalEntryReference: 'gl-1',
    });
  });

  it('returns the existing transaction on an exact source replay without new lines', async () => {
    const state = harness(true);
    const repository = new ProjectRevenueGlPostingRepository(state.db as never);

    await expect(repository.persist(posting())).resolves.toEqual({
      transaction: { id: 'gl-existing' },
      replayed: true,
    });
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });
});
