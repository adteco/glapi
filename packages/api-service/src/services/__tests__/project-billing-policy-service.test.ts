import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findVersionById: vi.fn(),
  createBillingRule: vi.fn(),
  findBillingRuleById: vi.fn(),
  createBillingRate: vi.fn(),
  resolveEffectiveRate: vi.fn(),
  listBillingMilestones: vi.fn(),
  createBillingMilestone: vi.fn(),
  findBillingMilestoneById: vi.fn(),
  approveBillingMilestone: vi.fn(),
  markBillingMilestoneAchieved: vi.fn(),
  findLatestProgressCertification: vi.fn(),
  createProgressCertification: vi.fn(),
  approveProgressCertification: vi.fn(),
}));

vi.mock('@glapi/database', () => ({
  ProjectContractRepository: vi.fn().mockImplementation(() => mocks),
}));

import { ProjectBillingPolicyService } from '../project-billing-policy-service';

const draftVersion = {
  id: 'version-1',
  organizationId: 'org-1',
  status: 'draft',
  billingGrouping: 'customer_project',
};

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    organizationId: 'org-1',
    projectContractVersionId: 'version-1',
    projectContractLineId: null,
    name: 'Default rule',
    ruleType: 'time_and_materials',
    priority: 100,
    effectiveStartDate: '2026-01-01',
    effectiveEndDate: null,
    currencyCode: 'USD',
    grouping: 'customer_project',
    defaultRate: '100.000000',
    fixedFeeAmount: null,
    progressMeasure: null,
    requiresApproval: true,
    isActive: true,
    metadata: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ProjectBillingPolicyService', () => {
  let service: ProjectBillingPolicyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectBillingPolicyService({ organizationId: 'org-1' });
    mocks.findVersionById.mockResolvedValue(draftVersion);
    mocks.listBillingMilestones.mockResolvedValue([]);
    mocks.findLatestProgressCertification.mockResolvedValue(null);
  });

  describe('createBillingRule', () => {
    it('persists a normalized T&M rule on a draft contract version', async () => {
      mocks.createBillingRule.mockImplementation(async (data) => ({ id: 'rule-1', ...data }));

      const created = await service.createBillingRule({
        projectContractVersionId: 'version-1',
        name: 'Consulting rates',
        ruleType: 'time_and_materials',
        effectiveStartDate: '2026-01-01',
        currencyCode: 'usd',
        defaultRate: '125.50',
      });

      expect(mocks.createBillingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          currencyCode: 'USD',
          grouping: 'customer_project',
          defaultRate: '125.50',
        }),
      );
      expect(created.id).toBe('rule-1');
    });

    it('rejects changes to an approved contract version', async () => {
      mocks.findVersionById.mockResolvedValue({ ...draftVersion, status: 'approved' });

      await expect(
        service.createBillingRule({
          projectContractVersionId: 'version-1',
          name: 'Late edit',
          ruleType: 'time_and_materials',
          effectiveStartDate: '2026-01-01',
        }),
      ).rejects.toMatchObject({ code: 'PROJECT_CONTRACT_VERSION_IMMUTABLE' });
    });

    it('requires fixed fee and progress measure for progress billing', async () => {
      await expect(
        service.createBillingRule({
          projectContractVersionId: 'version-1',
          name: 'Progress',
          ruleType: 'fixed_fee_progress',
          effectiveStartDate: '2026-01-01',
          fixedFeeAmount: '100000',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_BILLING_POLICY' });
    });
  });

  describe('rate resolution', () => {
    it('uses a validated source override before scoped/default rates', async () => {
      mocks.findBillingRuleById.mockResolvedValue(rule());

      await expect(
        service.resolveTimeAndMaterialsRate({
          billingRuleId: 'rule-1',
          serviceDate: '2026-02-01',
          sourceOverrideRate: '175.00',
        }),
      ).resolves.toEqual({ unitRate: '175.00', source: 'source_override' });
      expect(mocks.resolveEffectiveRate).not.toHaveBeenCalled();
    });

    it('returns a scoped effective rate with lineage', async () => {
      mocks.findBillingRuleById.mockResolvedValue(rule());
      mocks.resolveEffectiveRate.mockResolvedValue({ id: 'rate-person', unitRate: '150.000000' });

      await expect(
        service.resolveTimeAndMaterialsRate({
          billingRuleId: 'rule-1',
          serviceDate: '2026-02-01',
          entityId: 'employee-1',
        }),
      ).resolves.toEqual({
        unitRate: '150.000000',
        source: 'scoped_rate',
        billingRateId: 'rate-person',
      });
    });

    it('falls back to the rule default and rejects missing rates', async () => {
      mocks.resolveEffectiveRate.mockResolvedValue(null);
      mocks.findBillingRuleById.mockResolvedValue(rule());
      await expect(
        service.resolveTimeAndMaterialsRate({
          billingRuleId: 'rule-1',
          serviceDate: '2026-02-01',
        }),
      ).resolves.toMatchObject({ unitRate: '100.000000', source: 'rule_default' });

      mocks.findBillingRuleById.mockResolvedValue(rule({ defaultRate: null }));
      await expect(
        service.resolveTimeAndMaterialsRate({
          billingRuleId: 'rule-1',
          serviceDate: '2026-02-01',
        }),
      ).rejects.toMatchObject({ code: 'BILLING_RATE_NOT_FOUND' });
    });
  });

  describe('milestones and progress', () => {
    it('prevents milestone amounts from exceeding the fixed fee', async () => {
      mocks.findBillingRuleById.mockResolvedValue(
        rule({ ruleType: 'fixed_fee_milestone', fixedFeeAmount: '100000.0000', defaultRate: null }),
      );
      mocks.listBillingMilestones.mockResolvedValue([
        { amount: '60000.0000', percentage: null, status: 'approved' },
      ]);

      await expect(
        service.createBillingMilestone({
          billingRuleId: 'rule-1',
          sequenceNumber: 2,
          name: 'Final acceptance',
          amount: '50000',
          acceptanceCondition: 'Customer signs acceptance',
        }),
      ).rejects.toMatchObject({ code: 'BILLING_MILESTONES_EXCEED_CONTRACT' });
    });

    it('computes cumulative progress billing and versions same-day corrections', async () => {
      mocks.findBillingRuleById.mockResolvedValue(
        rule({
          ruleType: 'fixed_fee_progress',
          fixedFeeAmount: '100000.0000',
          defaultRate: null,
          progressMeasure: 'cost_to_cost',
        }),
      );
      mocks.findLatestProgressCertification.mockResolvedValue({
        certificationDate: '2026-02-28',
        versionNumber: 1,
        cumulativeProgressPercent: '50.0000',
      });
      mocks.createProgressCertification.mockImplementation(async (data) => ({ id: 'cert-2', ...data }));

      const certification = await service.submitProgressCertification({
        billingRuleId: 'rule-1',
        certificationDate: '2026-02-28',
        cumulativeProgressPercent: '60',
        actorEntityId: 'employee-approver',
      });

      expect(certification).toMatchObject({
        versionNumber: 2,
        cumulativeBillableAmount: '60000.0000',
        status: 'submitted',
      });
    });

    it('prevents cumulative progress from decreasing', async () => {
      mocks.findBillingRuleById.mockResolvedValue(
        rule({
          ruleType: 'fixed_fee_progress',
          fixedFeeAmount: '100000.0000',
          defaultRate: null,
          progressMeasure: 'cost_to_cost',
        }),
      );
      mocks.findLatestProgressCertification.mockResolvedValue({
        certificationDate: '2026-01-31',
        versionNumber: 1,
        cumulativeProgressPercent: '25.0000',
      });

      await expect(
        service.submitProgressCertification({
          billingRuleId: 'rule-1',
          certificationDate: '2026-02-28',
          cumulativeProgressPercent: '20',
          actorEntityId: 'employee-approver',
        }),
      ).rejects.toMatchObject({ code: 'INVALID_PROGRESS_CERTIFICATION' });
    });
  });
});
