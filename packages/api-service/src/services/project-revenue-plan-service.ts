import {
  ProjectRevenuePlanRepository,
  type ContextualDatabase,
  type ContractSSPAllocation,
  type PerformanceObligation,
  type PersistProjectRevenuePlanInput,
  type ProjectRevenuePlanSource,
  type RevenueSchedule,
} from '@glapi/database';
import {
  generateProjectRevenuePlan,
  ProjectRevenuePlanError,
  type ProjectRevenuePlan,
} from '@glapi/business';
import { ServiceError } from '../types';
import { BaseService } from './base-service';

export interface ProjectRevenuePlanRepositoryLike {
  findPlanSource(
    projectContractVersionId: string,
    organizationId: string,
  ): Promise<ProjectRevenuePlanSource | null>;
  findPersistedPlan(projectContractVersionId: string, organizationId: string): Promise<{
    obligations: PerformanceObligation[];
    allocations: ContractSSPAllocation[];
    schedules: RevenueSchedule[];
  } | null>;
  persistPlan(input: PersistProjectRevenuePlanInput): Promise<{ created: boolean }>;
}

export interface ProjectRevenuePlanServiceOptions {
  db?: ContextualDatabase;
  repository?: ProjectRevenuePlanRepositoryLike;
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fixed2(value: number): string {
  return value.toFixed(2);
}

export class ProjectRevenuePlanService extends BaseService {
  private readonly repository: ProjectRevenuePlanRepositoryLike;

  constructor(context = {}, options: ProjectRevenuePlanServiceOptions = {}) {
    super(context);
    this.repository = options.repository ?? new ProjectRevenuePlanRepository(options.db);
  }

  private calculate(source: ProjectRevenuePlanSource): ProjectRevenuePlan {
    try {
      return generateProjectRevenuePlan({
        projectContractId: source.projectContractId,
        projectContractVersionId: source.projectContractVersionId,
        transactionPrice: source.transactionPrice,
        currencyCode: source.currencyCode,
        contractStartDate: source.contractStartDate,
        contractEndDate: source.contractEndDate,
        lines: source.lines,
      });
    } catch (error) {
      if (error instanceof ProjectRevenuePlanError) {
        throw new ServiceError(error.message, error.code, 422);
      }
      throw error;
    }
  }

  private async requireSource(projectContractVersionId: string, organizationId: string) {
    const source = await this.repository.findPlanSource(projectContractVersionId, organizationId);
    if (!source) {
      throw new ServiceError(
        'An active project contract with the approved current version is required',
        'PROJECT_CONTRACT_VERSION_NOT_REVENUE_ELIGIBLE',
        409,
      );
    }
    return source;
  }

  private formatPersistedPlan(
    projectContractVersionId: string,
    persisted: NonNullable<Awaited<ReturnType<ProjectRevenuePlanRepositoryLike['findPersistedPlan']>>>,
  ) {
    const allocationByObligation = new Map(
      persisted.allocations.map((allocation) => [allocation.performanceObligationId, allocation]),
    );
    const schedulesByObligation = new Map<string, RevenueSchedule[]>();
    for (const schedule of persisted.schedules) {
      const rows = schedulesByObligation.get(schedule.performanceObligationId) ?? [];
      rows.push(schedule);
      schedulesByObligation.set(schedule.performanceObligationId, rows);
    }
    const obligations = persisted.obligations.map((obligation) => ({
      ...obligation,
      allocation: allocationByObligation.get(obligation.id) ?? null,
      schedules: schedulesByObligation.get(obligation.id) ?? [],
    }));
    const totalAllocated = persisted.obligations.reduce(
      (sum, obligation) => sum + numeric(obligation.allocatedAmount),
      0,
    );
    const totalScheduled = persisted.schedules
      .filter((schedule) => schedule.status !== 'superseded')
      .reduce((sum, schedule) => sum + numeric(schedule.scheduledAmount), 0);
    const totalRecognized = persisted.schedules.reduce(
      (sum, schedule) => sum + numeric(schedule.recognizedAmount),
      0,
    );
    const byPeriod = new Map<string, { scheduled: number; recognized: number }>();
    for (const schedule of persisted.schedules.filter((row) => row.status !== 'superseded')) {
      const period = String(schedule.periodEndDate ?? schedule.scheduleDate).slice(0, 7);
      const current = byPeriod.get(period) ?? { scheduled: 0, recognized: 0 };
      current.scheduled += numeric(schedule.scheduledAmount);
      current.recognized += numeric(schedule.recognizedAmount);
      byPeriod.set(period, current);
    }
    let cumulativeScheduled = 0;
    let cumulativeRecognized = 0;
    const waterfall = [...byPeriod.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([period, values]) => {
        cumulativeScheduled += values.scheduled;
        cumulativeRecognized += values.recognized;
        return {
          period,
          scheduled: fixed2(values.scheduled),
          recognized: fixed2(values.recognized),
          cumulativeScheduled: fixed2(cumulativeScheduled),
          cumulativeRecognized: fixed2(cumulativeRecognized),
          remainingAllocation: fixed2(totalAllocated - cumulativeRecognized),
        };
      });
    return {
      projectContractVersionId,
      summary: {
        totalAllocated: fixed2(totalAllocated),
        totalScheduled: fixed2(totalScheduled),
        totalRecognized: fixed2(totalRecognized),
        remainingAllocation: fixed2(totalAllocated - totalRecognized),
      },
      obligations,
      waterfall,
    };
  }

  async previewPlan(projectContractVersionId: string) {
    const organizationId = this.requireOrganizationContext();
    const source = await this.requireSource(projectContractVersionId, organizationId);
    return this.calculate(source);
  }

  async generatePlan(projectContractVersionId: string) {
    const organizationId = this.requireOrganizationContext();
    const existing = await this.repository.findPersistedPlan(
      projectContractVersionId,
      organizationId,
    );
    if (existing) {
      return {
        replayed: true,
        ...this.formatPersistedPlan(projectContractVersionId, existing),
      };
    }

    const source = await this.requireSource(projectContractVersionId, organizationId);
    const plan = this.calculate(source);
    const persistence = await this.repository.persistPlan({ organizationId, ...plan });
    const persisted = await this.repository.findPersistedPlan(
      projectContractVersionId,
      organizationId,
    );
    if (!persisted) {
      throw new ServiceError(
        'Project revenue plan was not readable after generation',
        'PROJECT_REVENUE_PLAN_PERSISTENCE_FAILED',
        500,
      );
    }
    return {
      replayed: !persistence.created,
      ...this.formatPersistedPlan(projectContractVersionId, persisted),
    };
  }

  async getPlan(projectContractVersionId: string) {
    const organizationId = this.requireOrganizationContext();
    const persisted = await this.repository.findPersistedPlan(
      projectContractVersionId,
      organizationId,
    );
    if (!persisted) {
      throw new ServiceError('Project revenue plan not found', 'PROJECT_REVENUE_PLAN_NOT_FOUND', 404);
    }
    return this.formatPersistedPlan(projectContractVersionId, persisted);
  }
}
