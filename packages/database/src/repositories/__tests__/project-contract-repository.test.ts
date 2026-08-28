import { describe, expect, it } from 'vitest';
import type { ProjectBillingRate } from '../../db/schema/project-contracts';
import { selectEffectiveBillingRate } from '../project-billing-rate-resolution';

function rate(
  id: string,
  rateScope: ProjectBillingRate['rateScope'],
  overrides: Partial<ProjectBillingRate> = {},
): ProjectBillingRate {
  return {
    id,
    organizationId: 'org-1',
    billingRuleId: 'rule-1',
    rateScope,
    entityId: null,
    roleKey: null,
    projectTaskId: null,
    itemId: null,
    projectCostCodeId: null,
    unitRate: '100.000000',
    effectiveStartDate: '2026-01-01',
    effectiveEndDate: null,
    priority: 100,
    metadata: null,
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('selectEffectiveBillingRate', () => {
  it('uses the ADR scope order before numeric priority', () => {
    const selected = selectEffectiveBillingRate(
      [
        rate('default', 'default', { unitRate: '90.000000', priority: 999 }),
        rate('role', 'role', { roleKey: 'consultant', unitRate: '125.000000' }),
        rate('person', 'person', { entityId: 'employee-1', unitRate: '150.000000' }),
      ],
      {
        serviceDate: '2026-02-01',
        entityId: 'employee-1',
        roleKey: 'consultant',
      },
    );

    expect(selected?.id).toBe('person');
    expect(selected?.unitRate).toBe('150.000000');
  });

  it('falls through to a matching task, item, cost-code, or default rate', () => {
    const rates = [
      rate('default', 'default'),
      rate('cost', 'cost_code', { projectCostCodeId: 'cost-1' }),
      rate('item', 'item', { itemId: 'item-1' }),
      rate('task', 'task', { projectTaskId: 'task-1' }),
    ];

    expect(
      selectEffectiveBillingRate(rates, {
        serviceDate: '2026-02-01',
        projectTaskId: 'task-1',
        itemId: 'item-1',
        projectCostCodeId: 'cost-1',
      })?.id,
    ).toBe('task');
    expect(
      selectEffectiveBillingRate(rates, {
        serviceDate: '2026-02-01',
        itemId: 'item-1',
        projectCostCodeId: 'cost-1',
      })?.id,
    ).toBe('item');
    expect(
      selectEffectiveBillingRate(rates, { serviceDate: '2026-02-01' })?.id,
    ).toBe('default');
  });

  it('excludes rates outside their effective date range or with a mismatched target', () => {
    const selected = selectEffectiveBillingRate(
      [
        rate('expired-person', 'person', {
          entityId: 'employee-1',
          effectiveEndDate: '2026-01-31',
        }),
        rate('other-person', 'person', { entityId: 'employee-2' }),
        rate('default', 'default', { unitRate: '95.000000' }),
      ],
      { serviceDate: '2026-02-01', entityId: 'employee-1' },
    );

    expect(selected?.id).toBe('default');
  });

  it('uses priority, newest effective date, then stable id within the same scope', () => {
    const context = { serviceDate: '2026-04-01', roleKey: 'consultant' };
    const selected = selectEffectiveBillingRate(
      [
        rate('z-rate', 'role', {
          roleKey: 'consultant',
          priority: 200,
          effectiveStartDate: '2026-01-01',
        }),
        rate('b-rate', 'role', {
          roleKey: 'consultant',
          priority: 200,
          effectiveStartDate: '2026-03-01',
        }),
        rate('a-rate', 'role', {
          roleKey: 'consultant',
          priority: 200,
          effectiveStartDate: '2026-03-01',
        }),
      ],
      context,
    );

    expect(selected?.id).toBe('a-rate');
  });

  it('returns null when no candidate applies', () => {
    expect(
      selectEffectiveBillingRate(
        [rate('future', 'default', { effectiveStartDate: '2027-01-01' })],
        { serviceDate: '2026-01-01' },
      ),
    ).toBeNull();
  });
});
