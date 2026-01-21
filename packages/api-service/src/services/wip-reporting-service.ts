import { BaseService } from './base-service';
import { WipReportingRepository } from '@glapi/database';

export interface WipSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  subsidiaryId: string | null;
  // Budget
  totalBudgetAmount: string;
  budgetByType: {
    labor: string;
    material: string;
    equipment: string;
    subcontract: string;
    other: string;
  };
  // Costs
  totalCommittedAmount: string;
  totalActualCost: string;
  actualByType: {
    labor: string;
    material: string;
    equipment: string;
    subcontract: string;
    other: string;
  };
  // Billings
  totalBilledAmount: string;
  totalCollectedAmount: string;
  totalRetainageHeld: string;
  // WIP
  wipBalance: string;
  underbillings: string;
  overbillings: string;
  budgetVariance: string;
  // Dates
  projectStartDate: string | null;
  projectEndDate: string | null;
  refreshedAt: string;
}

export interface PercentCompleteSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  subsidiaryId: string | null;
  // Earned Value metrics
  budgetAtCompletion: string;
  actualCost: string;
  committedCost: string;
  earnedValue: string;
  // Estimates
  estimateToComplete: string;
  estimateAtCompletion: string;
  // Percent complete
  costPercentComplete: string;
  laborPercentComplete: string;
  materialPercentComplete: string;
  subcontractPercentComplete: string;
  // Variance
  remainingBudget: string;
  projectedVariance: string;
  varianceAtCompletion: string;
  // Performance
  costPerformanceIndex: string;
  // Snapshot
  lastSnapshotDate: string | null;
  snapshotPercentComplete: string | null;
  refreshedAt: string;
}

export interface RetainageAgingSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  retainagePercent: string;
  subsidiaryId: string | null;
  // Totals
  totalRetainageHeld: string;
  retainageReleased: string;
  retainageOutstanding: string;
  // Aging buckets
  current: string;
  days30: string;
  days60: string;
  days90: string;
  over90: string;
  // Release
  expectedReleaseDate: string | null;
  refreshedAt: string;
}

export interface WipSummaryFilters {
  projectId?: string;
  subsidiaryId?: string;
  status?: string;
  hasUnderbillings?: boolean;
  hasOverbillings?: boolean;
}

export interface PercentCompleteFilters {
  projectId?: string;
  subsidiaryId?: string;
  minPercentComplete?: number;
  maxPercentComplete?: number;
}

export interface RefreshResult {
  viewName: string;
  durationMs: number;
  rowCount: number;
}

export interface RefreshHistoryEntry {
  id: string;
  viewName: string;
  refreshType: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  rowCount: number | null;
  triggeredBy: string | null;
  errorMessage: string | null;
}

export class WipReportingService extends BaseService {
  private repository: WipReportingRepository;

  constructor(context = {}) {
    super(context);
    this.repository = new WipReportingRepository();
  }

  /**
   * Get WIP summary for all projects or filtered subset
   */
  async getWipSummary(filters: WipSummaryFilters = {}): Promise<WipSummary[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.repository.getWipSummary(organizationId, filters);

    return rows.map((row) => ({
      projectId: row.projectId,
      projectCode: row.projectCode,
      projectName: row.projectName,
      projectStatus: row.projectStatus,
      subsidiaryId: row.subsidiaryId,
      totalBudgetAmount: row.totalBudgetAmount,
      budgetByType: {
        labor: row.budgetLabor,
        material: row.budgetMaterial,
        equipment: row.budgetEquipment,
        subcontract: row.budgetSubcontract,
        other: row.budgetOther,
      },
      totalCommittedAmount: row.totalCommittedAmount,
      totalActualCost: row.totalActualCost,
      actualByType: {
        labor: row.actualLabor,
        material: row.actualMaterial,
        equipment: row.actualEquipment,
        subcontract: row.actualSubcontract,
        other: row.actualOther,
      },
      totalBilledAmount: row.totalBilledAmount,
      totalCollectedAmount: row.totalCollectedAmount,
      totalRetainageHeld: row.totalRetainageHeld,
      wipBalance: row.wipBalance,
      underbillings: row.underbillings,
      overbillings: row.overbillings,
      budgetVariance: row.budgetVariance,
      projectStartDate: row.projectStartDate,
      projectEndDate: row.projectEndDate,
      refreshedAt: row.refreshedAt.toISOString(),
    }));
  }

  /**
   * Get percent complete data for all projects or filtered subset
   */
  async getPercentComplete(filters: PercentCompleteFilters = {}): Promise<PercentCompleteSummary[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.repository.getPercentComplete(organizationId, filters);

    return rows.map((row) => ({
      projectId: row.projectId,
      projectCode: row.projectCode,
      projectName: row.projectName,
      projectStatus: row.projectStatus,
      subsidiaryId: row.subsidiaryId,
      budgetAtCompletion: row.budgetAtCompletion,
      actualCost: row.actualCost,
      committedCost: row.committedCost,
      earnedValue: row.earnedValue,
      estimateToComplete: row.estimateToComplete,
      estimateAtCompletion: row.estimateAtCompletion,
      costPercentComplete: row.costPercentComplete,
      laborPercentComplete: row.laborPercentComplete,
      materialPercentComplete: row.materialPercentComplete,
      subcontractPercentComplete: row.subcontractPercentComplete,
      remainingBudget: row.remainingBudget,
      projectedVariance: row.projectedVariance,
      varianceAtCompletion: row.varianceAtCompletion,
      costPerformanceIndex: row.costPerformanceIndex,
      lastSnapshotDate: row.lastSnapshotDate,
      snapshotPercentComplete: row.snapshotPercentComplete,
      refreshedAt: row.refreshedAt.toISOString(),
    }));
  }

  /**
   * Get retainage aging report
   */
  async getRetainageAging(
    filters: { projectId?: string; subsidiaryId?: string } = {}
  ): Promise<RetainageAgingSummary[]> {
    const organizationId = this.requireOrganizationContext();
    const rows = await this.repository.getRetainageAging(organizationId, filters);

    return rows.map((row) => ({
      projectId: row.projectId,
      projectCode: row.projectCode,
      projectName: row.projectName,
      retainagePercent: row.retainagePercent,
      subsidiaryId: row.subsidiaryId,
      totalRetainageHeld: row.totalRetainageHeld,
      retainageReleased: row.retainageReleased,
      retainageOutstanding: row.retainageOutstanding,
      current: row.retainageCurrent,
      days30: row.retainage30Days,
      days60: row.retainage60Days,
      days90: row.retainage90Days,
      over90: row.retainageOver90,
      expectedReleaseDate: row.expectedReleaseDate,
      refreshedAt: row.refreshedAt.toISOString(),
    }));
  }

  /**
   * Trigger a refresh of all WIP materialized views
   */
  async refreshViews(triggeredBy = 'api'): Promise<RefreshResult[]> {
    return this.repository.refreshViews(triggeredBy);
  }

  /**
   * Get refresh history for monitoring
   */
  async getRefreshHistory(viewName?: string, limit = 10): Promise<RefreshHistoryEntry[]> {
    const history = await this.repository.getRefreshHistory(viewName, limit);
    return history.map((entry) => ({
      id: entry.id,
      viewName: entry.viewName,
      refreshType: entry.refreshType,
      startedAt: entry.startedAt.toISOString(),
      completedAt: entry.completedAt?.toISOString() ?? null,
      durationMs: entry.durationMs,
      rowCount: entry.rowCount,
      triggeredBy: entry.triggeredBy,
      errorMessage: entry.errorMessage,
    }));
  }

  /**
   * Get the last refresh time for a specific view
   */
  async getLastRefreshTime(viewName: string): Promise<string | null> {
    const time = await this.repository.getLastRefreshTime(viewName);
    return time?.toISOString() ?? null;
  }

  /**
   * Get combined WIP dashboard data
   */
  async getWipDashboard(filters: WipSummaryFilters = {}): Promise<{
    summary: {
      totalProjects: number;
      totalBudget: number;
      totalActualCost: number;
      totalWipBalance: number;
      totalUnderbillings: number;
      totalOverbillings: number;
      totalRetainageHeld: number;
    };
    projectsWithUnderbillings: WipSummary[];
    projectsWithOverbillings: WipSummary[];
    lastRefreshed: string | null;
  }> {
    const wipData = await this.getWipSummary(filters);
    const lastRefresh = await this.getLastRefreshTime('project_wip_summary');

    const summary = {
      totalProjects: wipData.length,
      totalBudget: 0,
      totalActualCost: 0,
      totalWipBalance: 0,
      totalUnderbillings: 0,
      totalOverbillings: 0,
      totalRetainageHeld: 0,
    };

    for (const project of wipData) {
      summary.totalBudget += parseFloat(project.totalBudgetAmount);
      summary.totalActualCost += parseFloat(project.totalActualCost);
      summary.totalWipBalance += parseFloat(project.wipBalance);
      summary.totalUnderbillings += parseFloat(project.underbillings);
      summary.totalOverbillings += parseFloat(project.overbillings);
      summary.totalRetainageHeld += parseFloat(project.totalRetainageHeld);
    }

    return {
      summary,
      projectsWithUnderbillings: wipData.filter((p) => parseFloat(p.underbillings) > 0),
      projectsWithOverbillings: wipData.filter((p) => parseFloat(p.overbillings) > 0),
      lastRefreshed: lastRefresh,
    };
  }

  /**
   * Get combined percent complete dashboard data
   */
  async getPercentCompleteDashboard(filters: PercentCompleteFilters = {}): Promise<{
    summary: {
      totalProjects: number;
      averagePercentComplete: number;
      totalBudgetAtCompletion: number;
      totalActualCost: number;
      totalEstimateAtCompletion: number;
      totalProjectedVariance: number;
      averageCPI: number;
    };
    projectsBehindSchedule: PercentCompleteSummary[];
    projectsAtRisk: PercentCompleteSummary[];
    lastRefreshed: string | null;
  }> {
    const pctData = await this.getPercentComplete(filters);
    const lastRefresh = await this.getLastRefreshTime('project_percent_complete');

    const summary = {
      totalProjects: pctData.length,
      averagePercentComplete: 0,
      totalBudgetAtCompletion: 0,
      totalActualCost: 0,
      totalEstimateAtCompletion: 0,
      totalProjectedVariance: 0,
      averageCPI: 0,
    };

    let totalPct = 0;
    let totalCPI = 0;
    let cpiCount = 0;

    for (const project of pctData) {
      summary.totalBudgetAtCompletion += parseFloat(project.budgetAtCompletion);
      summary.totalActualCost += parseFloat(project.actualCost);
      summary.totalEstimateAtCompletion += parseFloat(project.estimateAtCompletion);
      summary.totalProjectedVariance += parseFloat(project.projectedVariance);
      totalPct += parseFloat(project.costPercentComplete);

      const cpi = parseFloat(project.costPerformanceIndex);
      if (cpi > 0) {
        totalCPI += cpi;
        cpiCount++;
      }
    }

    summary.averagePercentComplete = pctData.length > 0 ? totalPct / pctData.length : 0;
    summary.averageCPI = cpiCount > 0 ? totalCPI / cpiCount : 1;

    // Projects behind schedule (CPI < 0.9)
    const projectsBehindSchedule = pctData.filter(
      (p) => parseFloat(p.costPerformanceIndex) < 0.9 && parseFloat(p.costPerformanceIndex) > 0
    );

    // Projects at risk (projected variance < 0)
    const projectsAtRisk = pctData.filter((p) => parseFloat(p.projectedVariance) < 0);

    return {
      summary,
      projectsBehindSchedule,
      projectsAtRisk,
      lastRefreshed: lastRefresh,
    };
  }
}
