import {
  ProjectContractRepository,
  type ContextualDatabase,
  type NewProjectBillingRate,
  type NewProjectBillingRule,
  type NewProjectContractBillingMilestone,
  type NewProjectProgressCertification,
} from '@glapi/database';
import { ServiceError } from '../types';
import { BaseService } from './base-service';

type BillingRuleType = 'time_and_materials' | 'fixed_fee_milestone' | 'fixed_fee_progress';
type BillingGrouping = 'customer' | 'project' | 'customer_project';
type ProgressMeasure =
  | 'cost_to_cost'
  | 'labor_hours'
  | 'units_delivered'
  | 'elapsed_time'
  | 'manual_output';
type RateScope = 'default' | 'person' | 'role' | 'task' | 'item' | 'cost_code';

export interface ProjectBillingPolicyServiceOptions {
  db?: ContextualDatabase;
}

export interface CreateBillingRuleInput {
  projectContractVersionId: string;
  projectContractLineId?: string;
  name: string;
  ruleType: BillingRuleType;
  priority?: number;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  currencyCode?: string;
  grouping?: BillingGrouping;
  defaultRate?: string;
  fixedFeeAmount?: string;
  progressMeasure?: ProgressMeasure;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
  actorEntityId?: string;
}

export interface CreateBillingRateInput {
  billingRuleId: string;
  rateScope: RateScope;
  entityId?: string;
  roleKey?: string;
  projectTaskId?: string;
  itemId?: string;
  projectCostCodeId?: string;
  unitRate: string;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  actorEntityId?: string;
}

export interface ResolveBillingRateInput {
  billingRuleId: string;
  serviceDate: string;
  sourceOverrideRate?: string;
  entityId?: string;
  roleKey?: string;
  projectTaskId?: string;
  itemId?: string;
  projectCostCodeId?: string;
}

export interface CreateBillingMilestoneInput {
  billingRuleId: string;
  projectContractLineId?: string;
  projectMilestoneId?: string;
  sequenceNumber: number;
  name: string;
  description?: string;
  amount?: string;
  percentage?: string;
  targetDate?: string;
  acceptanceCondition: string;
  metadata?: Record<string, unknown>;
  actorEntityId?: string;
}

export interface SubmitProgressCertificationInput {
  billingRuleId: string;
  certificationDate: string;
  cumulativeProgressPercent: string;
  evidence?: Record<string, unknown>;
  notes?: string;
  actorEntityId: string;
}

function numeric(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ServiceError(`${field} must be a non-negative number`, 'INVALID_BILLING_POLICY', 400);
  }
  return parsed;
}

function round4(value: number): string {
  return (Math.round((value + Number.EPSILON) * 10_000) / 10_000).toFixed(4);
}

function assertDateRange(startDate: string, endDate?: string): void {
  if (endDate && endDate < startDate) {
    throw new ServiceError(
      'Effective end date cannot be before effective start date',
      'INVALID_BILLING_POLICY',
      400,
    );
  }
}

export class ProjectBillingPolicyService extends BaseService {
  private readonly repository: ProjectContractRepository;

  constructor(context = {}, options: ProjectBillingPolicyServiceOptions = {}) {
    super(context);
    this.repository = new ProjectContractRepository(options.db);
  }

  async createBillingRule(input: CreateBillingRuleInput) {
    const organizationId = this.requireOrganizationContext();
    assertDateRange(input.effectiveStartDate, input.effectiveEndDate);

    const version = await this.repository.findVersionById(
      input.projectContractVersionId,
      organizationId,
    );
    if (!version) {
      throw new ServiceError('Project contract version not found', 'PROJECT_CONTRACT_VERSION_NOT_FOUND', 404);
    }
    if (version.status !== 'draft') {
      throw new ServiceError(
        'Billing rules can only be changed on a draft contract version',
        'PROJECT_CONTRACT_VERSION_IMMUTABLE',
        409,
      );
    }

    const defaultRate = numeric(input.defaultRate, 'Default rate');
    const fixedFeeAmount = numeric(input.fixedFeeAmount, 'Fixed fee amount');

    if (input.ruleType === 'time_and_materials') {
      if (fixedFeeAmount !== undefined || input.progressMeasure !== undefined) {
        throw new ServiceError(
          'T&M rules cannot define a fixed fee or progress measure',
          'INVALID_BILLING_POLICY',
          400,
        );
      }
    } else {
      if (fixedFeeAmount === undefined) {
        throw new ServiceError(
          'Fixed-fee rules require fixedFeeAmount',
          'INVALID_BILLING_POLICY',
          400,
        );
      }
      if (defaultRate !== undefined) {
        throw new ServiceError(
          'Fixed-fee rules cannot define a default hourly rate',
          'INVALID_BILLING_POLICY',
          400,
        );
      }
      if (input.ruleType === 'fixed_fee_progress' && !input.progressMeasure) {
        throw new ServiceError(
          'Progress billing requires a progress measure',
          'INVALID_BILLING_POLICY',
          400,
        );
      }
      if (input.ruleType === 'fixed_fee_milestone' && input.progressMeasure) {
        throw new ServiceError(
          'Milestone billing cannot define a progress measure',
          'INVALID_BILLING_POLICY',
          400,
        );
      }
    }

    const data: NewProjectBillingRule = {
      organizationId,
      projectContractVersionId: input.projectContractVersionId,
      projectContractLineId: input.projectContractLineId,
      name: input.name,
      ruleType: input.ruleType,
      priority: input.priority ?? 100,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      currencyCode: (input.currencyCode ?? 'USD').toUpperCase(),
      grouping: input.grouping ?? version.billingGrouping,
      defaultRate: input.defaultRate,
      fixedFeeAmount: input.fixedFeeAmount,
      progressMeasure: input.progressMeasure,
      requiresApproval: input.requiresApproval ?? true,
      isActive: true,
      metadata: input.metadata,
      createdBy: input.actorEntityId,
      updatedBy: input.actorEntityId,
    };

    return this.repository.createBillingRule(data);
  }

  async createBillingRate(input: CreateBillingRateInput) {
    const organizationId = this.requireOrganizationContext();
    assertDateRange(input.effectiveStartDate, input.effectiveEndDate);
    numeric(input.unitRate, 'Unit rate');

    const rule = await this.repository.findBillingRuleById(input.billingRuleId, organizationId);
    if (!rule) {
      throw new ServiceError('Project billing rule not found', 'PROJECT_BILLING_RULE_NOT_FOUND', 404);
    }
    if (rule.ruleType !== 'time_and_materials') {
      throw new ServiceError(
        'Effective-dated rates are only valid for T&M rules',
        'INVALID_BILLING_POLICY',
        400,
      );
    }
    const version = await this.repository.findVersionById(
      rule.projectContractVersionId,
      organizationId,
    );
    if (!version || version.status !== 'draft') {
      throw new ServiceError(
        'Billing rates can only be changed on a draft contract version',
        'PROJECT_CONTRACT_VERSION_IMMUTABLE',
        409,
      );
    }
    if (
      input.effectiveStartDate < rule.effectiveStartDate ||
      (rule.effectiveEndDate !== null &&
        (input.effectiveEndDate === undefined || input.effectiveEndDate > rule.effectiveEndDate))
    ) {
      throw new ServiceError(
        'Billing rate effective dates must be within the billing rule dates',
        'INVALID_BILLING_POLICY',
        400,
      );
    }

    const targets = {
      entityId: input.entityId,
      roleKey: input.roleKey,
      projectTaskId: input.projectTaskId,
      itemId: input.itemId,
      projectCostCodeId: input.projectCostCodeId,
    };
    const expectedTarget: Record<RateScope, keyof typeof targets | null> = {
      default: null,
      person: 'entityId',
      role: 'roleKey',
      task: 'projectTaskId',
      item: 'itemId',
      cost_code: 'projectCostCodeId',
    };
    const requiredTarget = expectedTarget[input.rateScope];
    const populatedTargets = Object.values(targets).filter(Boolean).length;
    if (
      (requiredTarget === null && populatedTargets !== 0) ||
      (requiredTarget !== null && (!targets[requiredTarget] || populatedTargets !== 1))
    ) {
      throw new ServiceError(
        `Rate scope ${input.rateScope} requires exactly its matching target`,
        'INVALID_BILLING_RATE_SCOPE',
        400,
      );
    }

    const data: NewProjectBillingRate = {
      organizationId,
      billingRuleId: input.billingRuleId,
      rateScope: input.rateScope,
      ...targets,
      unitRate: input.unitRate,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      priority: input.priority ?? 100,
      metadata: input.metadata,
      createdBy: input.actorEntityId,
    };
    return this.repository.createBillingRate(data);
  }

  async resolveTimeAndMaterialsRate(input: ResolveBillingRateInput): Promise<{
    unitRate: string;
    source: 'source_override' | 'scoped_rate' | 'rule_default';
    billingRateId?: string;
  }> {
    const organizationId = this.requireOrganizationContext();
    const rule = await this.repository.findBillingRuleById(input.billingRuleId, organizationId);
    if (!rule || !rule.isActive) {
      throw new ServiceError('Active project billing rule not found', 'PROJECT_BILLING_RULE_NOT_FOUND', 404);
    }
    if (rule.ruleType !== 'time_and_materials') {
      throw new ServiceError('Rate resolution requires a T&M rule', 'INVALID_BILLING_POLICY', 400);
    }
    if (
      input.serviceDate < rule.effectiveStartDate ||
      (rule.effectiveEndDate !== null && input.serviceDate > rule.effectiveEndDate)
    ) {
      throw new ServiceError(
        'Billing rule is not effective on the service date',
        'BILLING_RULE_NOT_EFFECTIVE',
        400,
      );
    }

    if (input.sourceOverrideRate !== undefined) {
      numeric(input.sourceOverrideRate, 'Source override rate');
      return { unitRate: input.sourceOverrideRate, source: 'source_override' };
    }

    const rate = await this.repository.resolveEffectiveRate(
      input.billingRuleId,
      organizationId,
      input,
    );
    if (rate) {
      return { unitRate: rate.unitRate, source: 'scoped_rate', billingRateId: rate.id };
    }
    if (rule.defaultRate !== null) {
      return { unitRate: rule.defaultRate, source: 'rule_default' };
    }

    throw new ServiceError(
      'No effective billing rate was found for the source',
      'BILLING_RATE_NOT_FOUND',
      422,
    );
  }

  async createBillingMilestone(input: CreateBillingMilestoneInput) {
    const organizationId = this.requireOrganizationContext();
    const rule = await this.repository.findBillingRuleById(input.billingRuleId, organizationId);
    if (!rule) {
      throw new ServiceError('Project billing rule not found', 'PROJECT_BILLING_RULE_NOT_FOUND', 404);
    }
    if (rule.ruleType !== 'fixed_fee_milestone' || rule.fixedFeeAmount === null) {
      throw new ServiceError(
        'Billing milestones require a fixed-fee milestone rule',
        'INVALID_BILLING_POLICY',
        400,
      );
    }
    const version = await this.repository.findVersionById(
      rule.projectContractVersionId,
      organizationId,
    );
    if (!version || version.status !== 'draft') {
      throw new ServiceError(
        'Billing milestones can only be changed on a draft contract version',
        'PROJECT_CONTRACT_VERSION_IMMUTABLE',
        409,
      );
    }

    const amount = numeric(input.amount, 'Milestone amount');
    const percentage = numeric(input.percentage, 'Milestone percentage');
    if ((amount === undefined) === (percentage === undefined)) {
      throw new ServiceError(
        'Specify exactly one of milestone amount or percentage',
        'INVALID_BILLING_MILESTONE',
        400,
      );
    }
    if (percentage !== undefined && (percentage <= 0 || percentage > 100)) {
      throw new ServiceError(
        'Milestone percentage must be greater than 0 and at most 100',
        'INVALID_BILLING_MILESTONE',
        400,
      );
    }

    const existing = (await this.repository.listBillingMilestones(input.billingRuleId, organizationId)).filter(
      (milestone) => milestone.status !== 'cancelled',
    );
    const fixedFee = Number(rule.fixedFeeAmount);
    const existingAmount = existing.reduce((sum, milestone) => {
      if (milestone.amount !== null) return sum + Number(milestone.amount);
      return sum + fixedFee * (Number(milestone.percentage ?? 0) / 100);
    }, 0);
    const newAmount = amount ?? fixedFee * ((percentage ?? 0) / 100);
    if (existingAmount + newAmount > fixedFee + 0.0001) {
      throw new ServiceError(
        'Active milestone consideration cannot exceed the fixed fee',
        'BILLING_MILESTONES_EXCEED_CONTRACT',
        409,
      );
    }

    const data: NewProjectContractBillingMilestone = {
      organizationId,
      billingRuleId: input.billingRuleId,
      projectContractLineId: input.projectContractLineId,
      projectMilestoneId: input.projectMilestoneId,
      sequenceNumber: input.sequenceNumber,
      name: input.name,
      description: input.description,
      amount: input.amount,
      percentage: input.percentage,
      targetDate: input.targetDate,
      acceptanceCondition: input.acceptanceCondition,
      status: 'pending',
      metadata: input.metadata,
      createdBy: input.actorEntityId,
    };
    return this.repository.createBillingMilestone(data);
  }

  async approveBillingMilestone(id: string, actorEntityId: string) {
    const organizationId = this.requireOrganizationContext();
    const milestone = await this.repository.findBillingMilestoneById(id, organizationId);
    if (!milestone) {
      throw new ServiceError('Billing milestone not found', 'BILLING_MILESTONE_NOT_FOUND', 404);
    }
    if (milestone.status !== 'achieved') {
      throw new ServiceError(
        'Only achieved milestones can be approved',
        'INVALID_BILLING_MILESTONE_STATUS',
        409,
      );
    }
    const approved = await this.repository.approveBillingMilestone(id, organizationId, actorEntityId);
    if (!approved) {
      throw new ServiceError('Billing milestone changed concurrently', 'BILLING_MILESTONE_CONFLICT', 409);
    }
    return approved;
  }

  async markBillingMilestoneAchieved(id: string, actorEntityId: string) {
    const organizationId = this.requireOrganizationContext();
    const milestone = await this.repository.findBillingMilestoneById(id, organizationId);
    if (!milestone) {
      throw new ServiceError('Billing milestone not found', 'BILLING_MILESTONE_NOT_FOUND', 404);
    }
    if (milestone.status !== 'pending') {
      throw new ServiceError(
        'Only pending milestones can be marked achieved',
        'INVALID_BILLING_MILESTONE_STATUS',
        409,
      );
    }
    const achieved = await this.repository.markBillingMilestoneAchieved(
      id,
      organizationId,
      actorEntityId,
    );
    if (!achieved) {
      throw new ServiceError('Billing milestone changed concurrently', 'BILLING_MILESTONE_CONFLICT', 409);
    }
    return achieved;
  }

  async submitProgressCertification(input: SubmitProgressCertificationInput) {
    const organizationId = this.requireOrganizationContext();
    const rule = await this.repository.findBillingRuleById(input.billingRuleId, organizationId);
    if (!rule) {
      throw new ServiceError('Project billing rule not found', 'PROJECT_BILLING_RULE_NOT_FOUND', 404);
    }
    if (rule.ruleType !== 'fixed_fee_progress' || rule.fixedFeeAmount === null) {
      throw new ServiceError(
        'Progress certification requires a fixed-fee progress rule',
        'INVALID_BILLING_POLICY',
        400,
      );
    }

    const progress = numeric(input.cumulativeProgressPercent, 'Cumulative progress');
    if (progress === undefined || progress > 100) {
      throw new ServiceError(
        'Cumulative progress must be between 0 and 100',
        'INVALID_PROGRESS_CERTIFICATION',
        400,
      );
    }
    const latest = await this.repository.findLatestProgressCertification(
      input.billingRuleId,
      organizationId,
    );
    if (latest && input.certificationDate < latest.certificationDate) {
      throw new ServiceError(
        'Certification date cannot precede the latest certification',
        'INVALID_PROGRESS_CERTIFICATION',
        409,
      );
    }
    if (latest && progress < Number(latest.cumulativeProgressPercent)) {
      throw new ServiceError(
        'Cumulative billing progress cannot decrease; submit a new contract correction instead',
        'INVALID_PROGRESS_CERTIFICATION',
        409,
      );
    }

    const sameDate = latest?.certificationDate === input.certificationDate;
    const data: NewProjectProgressCertification = {
      organizationId,
      billingRuleId: input.billingRuleId,
      certificationDate: input.certificationDate,
      versionNumber: sameDate ? latest.versionNumber + 1 : 1,
      cumulativeProgressPercent: input.cumulativeProgressPercent,
      cumulativeBillableAmount: round4(Number(rule.fixedFeeAmount) * (progress / 100)),
      status: 'submitted',
      evidence: input.evidence,
      notes: input.notes,
      submittedAt: new Date(),
      submittedBy: input.actorEntityId,
    };
    return this.repository.createProgressCertification(data);
  }

  async approveProgressCertification(id: string, actorEntityId: string) {
    const organizationId = this.requireOrganizationContext();
    const approved = await this.repository.approveProgressCertification(
      id,
      organizationId,
      actorEntityId,
    );
    if (!approved) {
      throw new ServiceError(
        'Submitted progress certification not found or changed concurrently',
        'PROGRESS_CERTIFICATION_CONFLICT',
        409,
      );
    }
    return approved;
  }
}
