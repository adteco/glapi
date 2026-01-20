import { BaseService } from './base-service';
import {
  JobCostSummary,
  JobCostSummaryFilters,
  ProjectProgressSnapshot,
  BudgetVarianceReport,
  BudgetVarianceFilters,
  BudgetLineVariance,
  CostTypeVarianceSummary,
} from '../types';
import { ServiceError } from '../types/common.types';
import {
  ProjectReportingRepository,
  ProjectProgressSnapshotRepository,
  ProjectBudgetRepository,
} from '@glapi/database';

export class ProjectReportingService extends BaseService {
  private reportingRepository: ProjectReportingRepository;
  private snapshotsRepository: ProjectProgressSnapshotRepository;
  private budgetRepository: ProjectBudgetRepository;

  constructor(context = {}) {
    super(context);
    this.reportingRepository = new ProjectReportingRepository();
    this.snapshotsRepository = new ProjectProgressSnapshotRepository();
    this.budgetRepository = new ProjectBudgetRepository();
  }

  async listJobCostSummary(filters: JobCostSummaryFilters = {}): Promise<JobCostSummary[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.reportingRepository.getJobCostSummary(organizationId, filters);

    return rows.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      projectCode: row.projectCode,
      subsidiaryId: row.subsidiaryId,
      totalBudgetAmount: row.totalBudgetAmount ?? '0',
      totalCommittedAmount: row.totalCommittedAmount ?? '0',
      totalActualCost: row.totalActualCost ?? '0',
      totalWipClearing: row.totalWipClearing ?? '0',
      percentComplete: row.percentComplete ?? '0',
      lastPostedAt: row.lastPostedAt,
    }));
  }

  async listProgressHistory(projectId: string, limit = 12): Promise<ProjectProgressSnapshot[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.snapshotsRepository.listByProject(projectId, organizationId, limit);
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      snapshotDate: row.snapshotDate ?? row.createdAt.toISOString(),
      totalBudgetAmount: row.totalBudgetAmount ?? '0',
      totalCommittedAmount: row.totalCommittedAmount ?? '0',
      totalActualCost: row.totalActualCost ?? '0',
      totalWipClearing: row.totalWipClearing ?? '0',
      percentComplete: row.percentComplete ?? '0',
      sourceGlTransactionId: row.sourceGlTransactionId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Get detailed budget variance report for a project
   * Shows budget vs actual at the cost code level with variance analysis
   */
  async getBudgetVarianceReport(filters: BudgetVarianceFilters): Promise<BudgetVarianceReport> {
    const organizationId = this.requireOrganizationContext();
    const projectIds = await this.budgetRepository.getAccessibleProjectIds(organizationId);

    if (!projectIds.includes(filters.projectId)) {
      throw new ServiceError('Project not found or not accessible', 'PROJECT_NOT_FOUND', 404);
    }

    // Get current budget version or specified version
    let budgetVersion;
    if (filters.budgetVersionId) {
      budgetVersion = await this.budgetRepository.findVersionById(filters.budgetVersionId, projectIds);
    } else {
      budgetVersion = await this.budgetRepository.getCurrentVersion(filters.projectId, projectIds);
    }

    if (!budgetVersion) {
      throw new ServiceError('No budget version found for project', 'BUDGET_VERSION_NOT_FOUND', 404);
    }

    // Get budget lines with cost code details
    const linesWithCostCodes = await this.budgetRepository.findLinesWithCostCodes(budgetVersion.id);

    // Get project job cost summary for actual costs
    const jobCostSummary = await this.reportingRepository.getJobCostSummary(organizationId, {
      projectId: filters.projectId,
    });
    const projectSummary = jobCostSummary[0];

    // Transform lines to variance report format
    const byLine: BudgetLineVariance[] = linesWithCostCodes
      .filter((item) => !filters.costType || item.costCode.costType === filters.costType)
      .map((item) => {
        const revised = parseFloat(item.line.revisedBudgetAmount);
        const actual = parseFloat(item.line.actualAmount);
        const variance = revised - actual;
        const variancePercent = revised !== 0 ? (variance / revised) * 100 : 0;

        return {
          budgetLineId: item.line.id,
          costCodeId: item.costCode.id,
          costCode: item.costCode.costCode,
          costCodeName: item.costCode.name,
          costType: item.costCode.costType,
          originalBudgetAmount: item.line.originalBudgetAmount,
          revisedBudgetAmount: item.line.revisedBudgetAmount,
          committedAmount: item.line.committedAmount,
          actualAmount: item.line.actualAmount,
          encumberedAmount: item.line.encumberedAmount,
          varianceAmount: variance.toFixed(2),
          variancePercent: variancePercent.toFixed(2),
          estimateToComplete: item.line.estimateToComplete,
          estimateAtCompletion: item.line.estimateAtCompletion,
        };
      });

    // Get variance summary by cost type
    const varianceSummary = await this.budgetRepository.getVarianceSummary(budgetVersion.id);
    const byCostType: CostTypeVarianceSummary[] = varianceSummary.map((row) => {
      const budget = parseFloat(String(row.totalBudget || '0'));
      const variance = parseFloat(String(row.totalVariance || '0'));
      const variancePercent = budget !== 0 ? (variance / budget) * 100 : 0;

      return {
        costType: String(row.costType || 'OTHER'),
        totalBudget: String(row.totalBudget || '0'),
        totalActual: String(row.totalActual || '0'),
        totalCommitted: String(row.totalCommitted || '0'),
        totalVariance: String(row.totalVariance || '0'),
        variancePercent: variancePercent.toFixed(2),
      };
    });

    // Calculate summary totals
    const totalBudget = parseFloat(budgetVersion.totalBudgetAmount);
    const totalActual = parseFloat(projectSummary?.totalActualCost || '0');
    const totalCommitted = parseFloat(projectSummary?.totalCommittedAmount || '0');
    const totalVariance = totalBudget - totalActual;
    const variancePercent = totalBudget !== 0 ? (totalVariance / totalBudget) * 100 : 0;
    const percentComplete = totalBudget !== 0 ? (totalActual / totalBudget) * 100 : 0;

    return {
      projectId: filters.projectId,
      projectName: projectSummary?.projectName || '',
      projectCode: projectSummary?.projectCode || null,
      budgetVersionId: budgetVersion.id,
      budgetVersionName: budgetVersion.versionName,
      asOfDate: new Date().toISOString().split('T')[0],
      summary: {
        totalBudgetAmount: totalBudget.toFixed(2),
        totalCommittedAmount: totalCommitted.toFixed(2),
        totalActualAmount: totalActual.toFixed(2),
        totalVarianceAmount: totalVariance.toFixed(2),
        variancePercent: variancePercent.toFixed(2),
        percentComplete: percentComplete.toFixed(2),
      },
      byLine,
      byCostType,
    };
  }
}
