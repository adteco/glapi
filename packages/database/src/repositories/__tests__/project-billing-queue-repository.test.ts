import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../base-repository', () => ({
  BaseRepository: class {
    protected db: unknown;

    constructor(db: unknown) {
      this.db = db;
    }
  },
}));

import { ProjectBillingQueueRepository } from '../project-billing-queue-repository';

describe('ProjectBillingQueueRepository', () => {
  it('tenant-scopes every source and excludes active invoice allocations', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new ProjectBillingQueueRepository({ execute } as never);

    await repository.listEligibleCandidates('11111111-1111-4111-8111-111111111111', {
      asOfDate: '2026-08-15',
      customerId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
    });

    const rendered = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(rendered.sql.match(/WHERE (te|pt|bm|cert)\.organization_id = \$/g)).toHaveLength(4);
    expect(rendered.sql.match(/NOT EXISTS \(/g)).toHaveLength(4);
    expect(rendered.sql.match(/allocation_status = 'active'/g)).toHaveLength(4);
    expect(rendered.sql.match(/pc\.customer_id = \$/g)).toHaveLength(4);
    expect(rendered.sql.match(/pc\.project_id = \$/g)).toHaveLength(4);
    expect(rendered.params.filter((param) => param === '11111111-1111-4111-8111-111111111111')).toHaveLength(4);
  });

  it('applies source type selection after the normalized union', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { sourceType: 'TIME_ENTRY', sourceId: 'time-1' },
        { sourceType: 'PROJECT_MILESTONE', sourceId: 'milestone-1' },
      ],
    });
    const repository = new ProjectBillingQueueRepository({ execute } as never);

    const rows = await repository.listEligibleCandidates(
      '11111111-1111-4111-8111-111111111111',
      { asOfDate: '2026-08-15', sourceTypes: ['PROJECT_MILESTONE'] },
    );

    expect(rows).toEqual([{ sourceType: 'PROJECT_MILESTONE', sourceId: 'milestone-1' }]);
  });
});
