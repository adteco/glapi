import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface WipSummaryRow {
  projectId: string;
  organizationId: string;
  subsidiaryId: string | null;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  retainagePercent: string;
  totalBudgetAmount: string;
  budgetLabor: string;
  budgetMaterial: string;
  budgetEquipment: string;
  budgetSubcontract: string;
  budgetOther: string;
  totalCommittedAmount: string;
  totalActualCost: string;
  totalBilledAmount: string;
  totalCollectedAmount: string;
  totalRetainageHeld: string;
  wipBalance: string;
  underbillings: string;
  overbillings: string;
  actualLabor: string;
  actualMaterial: string;
  actualEquipment: string;
  actualSubcontract: string;
  actualOther: string;
  budgetVariance: string;
  projectCreatedAt: Date;
  projectStartDate: string | null;
  projectEndDate: string | null;
  refreshedAt: Date;
}

export interface PercentCompleteRow {
  projectId: string;
  organizationId: string;
  subsidiaryId: string | null;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  budgetAtCompletion: string;
  actualCost: string;
  committedCost: string;
  estimateToComplete: string;
  estimateAtCompletion: string;
  costPercentComplete: string;
  earnedValue: string;
  remainingBudget: string;
  projectedVariance: string;
  costPerformanceIndex: string;
  varianceAtCompletion: string;
  laborPercentComplete: string;
  materialPercentComplete: string;
  subcontractPercentComplete: string;
  lastSnapshotDate: string | null;
  snapshotPercentComplete: string | null;
  refreshedAt: Date;
}

export interface RetainageAgingRow {
  projectId: string;
  organizationId: string;
  subsidiaryId: string | null;
  projectCode: string;
  projectName: string;
  retainagePercent: string;
  totalRetainageHeld: string;
  retainageCurrent: string;
  retainage30Days: string;
  retainage60Days: string;
  retainage90Days: string;
  retainageOver90: string;
  retainageReleased: string;
  retainageOutstanding: string;
  expectedReleaseDate: string | null;
  refreshedAt: Date;
}

export interface RefreshLogRow {
  viewName: string;
  durationMs: number;
  rowCount: number;
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

export class WipReportingRepository {
  /**
   * Get WIP summary for projects
   */
  async getWipSummary(
    organizationId: string,
    filters: WipSummaryFilters = {}
  ): Promise<WipSummaryRow[]> {
    let query = sql`
      SELECT
        project_id,
        organization_id,
        subsidiary_id,
        project_code,
        project_name,
        project_status,
        retainage_percent,
        total_budget_amount,
        budget_labor,
        budget_material,
        budget_equipment,
        budget_subcontract,
        budget_other,
        total_committed_amount,
        total_actual_cost,
        total_billed_amount,
        total_collected_amount,
        total_retainage_held,
        wip_balance,
        underbillings,
        overbillings,
        actual_labor,
        actual_material,
        actual_equipment,
        actual_subcontract,
        actual_other,
        budget_variance,
        project_created_at,
        project_start_date,
        project_end_date,
        refreshed_at
      FROM project_wip_summary
      WHERE organization_id = ${organizationId}
    `;

    if (filters.projectId) {
      query = sql`${query} AND project_id = ${filters.projectId}`;
    }
    if (filters.subsidiaryId) {
      query = sql`${query} AND subsidiary_id = ${filters.subsidiaryId}`;
    }
    if (filters.status) {
      query = sql`${query} AND project_status = ${filters.status}`;
    }
    if (filters.hasUnderbillings) {
      query = sql`${query} AND underbillings > 0`;
    }
    if (filters.hasOverbillings) {
      query = sql`${query} AND overbillings > 0`;
    }

    query = sql`${query} ORDER BY project_name`;

    const rows = await db.execute(query);
    return rows.rows.map((row) => this.mapWipSummaryRow(row));
  }

  /**
   * Get percent complete data for projects
   */
  async getPercentComplete(
    organizationId: string,
    filters: PercentCompleteFilters = {}
  ): Promise<PercentCompleteRow[]> {
    let query = sql`
      SELECT
        project_id,
        organization_id,
        subsidiary_id,
        project_code,
        project_name,
        project_status,
        budget_at_completion,
        actual_cost,
        committed_cost,
        estimate_to_complete,
        estimate_at_completion,
        cost_percent_complete,
        earned_value,
        remaining_budget,
        projected_variance,
        cost_performance_index,
        variance_at_completion,
        labor_percent_complete,
        material_percent_complete,
        subcontract_percent_complete,
        last_snapshot_date,
        snapshot_percent_complete,
        refreshed_at
      FROM project_percent_complete
      WHERE organization_id = ${organizationId}
    `;

    if (filters.projectId) {
      query = sql`${query} AND project_id = ${filters.projectId}`;
    }
    if (filters.subsidiaryId) {
      query = sql`${query} AND subsidiary_id = ${filters.subsidiaryId}`;
    }
    if (filters.minPercentComplete !== undefined) {
      query = sql`${query} AND cost_percent_complete >= ${filters.minPercentComplete}`;
    }
    if (filters.maxPercentComplete !== undefined) {
      query = sql`${query} AND cost_percent_complete <= ${filters.maxPercentComplete}`;
    }

    query = sql`${query} ORDER BY project_name`;

    const rows = await db.execute(query);
    return rows.rows.map((row) => this.mapPercentCompleteRow(row));
  }

  /**
   * Get retainage aging data
   */
  async getRetainageAging(
    organizationId: string,
    filters: { projectId?: string; subsidiaryId?: string } = {}
  ): Promise<RetainageAgingRow[]> {
    let query = sql`
      SELECT
        project_id,
        organization_id,
        subsidiary_id,
        project_code,
        project_name,
        retainage_percent,
        total_retainage_held,
        retainage_current,
        retainage_30_days,
        retainage_60_days,
        retainage_90_days,
        retainage_over_90,
        retainage_released,
        retainage_outstanding,
        expected_release_date,
        refreshed_at
      FROM project_retainage_aging
      WHERE organization_id = ${organizationId}
    `;

    if (filters.projectId) {
      query = sql`${query} AND project_id = ${filters.projectId}`;
    }
    if (filters.subsidiaryId) {
      query = sql`${query} AND subsidiary_id = ${filters.subsidiaryId}`;
    }

    query = sql`${query} ORDER BY retainage_outstanding DESC`;

    const rows = await db.execute(query);
    return rows.rows.map((row) => this.mapRetainageAgingRow(row));
  }

  /**
   * Refresh all WIP materialized views with logging
   */
  async refreshViews(triggeredBy = 'api'): Promise<RefreshLogRow[]> {
    const result = await db.execute(
      sql`SELECT * FROM refresh_wip_views_with_logging(${triggeredBy})`
    );
    return result.rows.map((row) => ({
      viewName: String(row.view_name),
      durationMs: Number(row.duration_ms),
      rowCount: Number(row.row_count),
    }));
  }

  /**
   * Get refresh history
   */
  async getRefreshHistory(
    viewName?: string,
    limit = 10
  ): Promise<
    {
      id: string;
      viewName: string;
      refreshType: string;
      startedAt: Date;
      completedAt: Date | null;
      durationMs: number | null;
      rowCount: number | null;
      triggeredBy: string | null;
      errorMessage: string | null;
    }[]
  > {
    let query = sql`
      SELECT id, view_name, refresh_type, started_at, completed_at,
             duration_ms, row_count, triggered_by, error_message
      FROM materialized_view_refresh_log
    `;

    if (viewName) {
      query = sql`${query} WHERE view_name = ${viewName}`;
    }

    query = sql`${query} ORDER BY started_at DESC LIMIT ${limit}`;

    const rows = await db.execute(query);
    return rows.rows.map((row) => ({
      id: String(row.id),
      viewName: String(row.view_name),
      refreshType: String(row.refresh_type),
      startedAt: new Date(String(row.started_at)),
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
      durationMs: row.duration_ms ? Number(row.duration_ms) : null,
      rowCount: row.row_count ? Number(row.row_count) : null,
      triggeredBy: row.triggered_by ? String(row.triggered_by) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
    }));
  }

  /**
   * Get the last refresh time for a view
   */
  async getLastRefreshTime(viewName: string): Promise<Date | null> {
    const result = await db.execute(sql`
      SELECT MAX(completed_at) as last_refresh
      FROM materialized_view_refresh_log
      WHERE view_name = ${viewName} AND completed_at IS NOT NULL
    `);
    if (result.rows.length === 0 || !result.rows[0].last_refresh) {
      return null;
    }
    return new Date(String(result.rows[0].last_refresh));
  }

  private mapWipSummaryRow(row: Record<string, unknown>): WipSummaryRow {
    return {
      projectId: String(row.project_id),
      organizationId: String(row.organization_id),
      subsidiaryId: row.subsidiary_id ? String(row.subsidiary_id) : null,
      projectCode: String(row.project_code),
      projectName: String(row.project_name),
      projectStatus: String(row.project_status),
      retainagePercent: String(row.retainage_percent ?? '0'),
      totalBudgetAmount: String(row.total_budget_amount ?? '0'),
      budgetLabor: String(row.budget_labor ?? '0'),
      budgetMaterial: String(row.budget_material ?? '0'),
      budgetEquipment: String(row.budget_equipment ?? '0'),
      budgetSubcontract: String(row.budget_subcontract ?? '0'),
      budgetOther: String(row.budget_other ?? '0'),
      totalCommittedAmount: String(row.total_committed_amount ?? '0'),
      totalActualCost: String(row.total_actual_cost ?? '0'),
      totalBilledAmount: String(row.total_billed_amount ?? '0'),
      totalCollectedAmount: String(row.total_collected_amount ?? '0'),
      totalRetainageHeld: String(row.total_retainage_held ?? '0'),
      wipBalance: String(row.wip_balance ?? '0'),
      underbillings: String(row.underbillings ?? '0'),
      overbillings: String(row.overbillings ?? '0'),
      actualLabor: String(row.actual_labor ?? '0'),
      actualMaterial: String(row.actual_material ?? '0'),
      actualEquipment: String(row.actual_equipment ?? '0'),
      actualSubcontract: String(row.actual_subcontract ?? '0'),
      actualOther: String(row.actual_other ?? '0'),
      budgetVariance: String(row.budget_variance ?? '0'),
      projectCreatedAt: new Date(String(row.project_created_at)),
      projectStartDate: row.project_start_date ? String(row.project_start_date) : null,
      projectEndDate: row.project_end_date ? String(row.project_end_date) : null,
      refreshedAt: new Date(String(row.refreshed_at)),
    };
  }

  private mapPercentCompleteRow(row: Record<string, unknown>): PercentCompleteRow {
    return {
      projectId: String(row.project_id),
      organizationId: String(row.organization_id),
      subsidiaryId: row.subsidiary_id ? String(row.subsidiary_id) : null,
      projectCode: String(row.project_code),
      projectName: String(row.project_name),
      projectStatus: String(row.project_status),
      budgetAtCompletion: String(row.budget_at_completion ?? '0'),
      actualCost: String(row.actual_cost ?? '0'),
      committedCost: String(row.committed_cost ?? '0'),
      estimateToComplete: String(row.estimate_to_complete ?? '0'),
      estimateAtCompletion: String(row.estimate_at_completion ?? '0'),
      costPercentComplete: String(row.cost_percent_complete ?? '0'),
      earnedValue: String(row.earned_value ?? '0'),
      remainingBudget: String(row.remaining_budget ?? '0'),
      projectedVariance: String(row.projected_variance ?? '0'),
      costPerformanceIndex: String(row.cost_performance_index ?? '1'),
      varianceAtCompletion: String(row.variance_at_completion ?? '0'),
      laborPercentComplete: String(row.labor_percent_complete ?? '0'),
      materialPercentComplete: String(row.material_percent_complete ?? '0'),
      subcontractPercentComplete: String(row.subcontract_percent_complete ?? '0'),
      lastSnapshotDate: row.last_snapshot_date ? String(row.last_snapshot_date) : null,
      snapshotPercentComplete: row.snapshot_percent_complete
        ? String(row.snapshot_percent_complete)
        : null,
      refreshedAt: new Date(String(row.refreshed_at)),
    };
  }

  private mapRetainageAgingRow(row: Record<string, unknown>): RetainageAgingRow {
    return {
      projectId: String(row.project_id),
      organizationId: String(row.organization_id),
      subsidiaryId: row.subsidiary_id ? String(row.subsidiary_id) : null,
      projectCode: String(row.project_code),
      projectName: String(row.project_name),
      retainagePercent: String(row.retainage_percent ?? '0'),
      totalRetainageHeld: String(row.total_retainage_held ?? '0'),
      retainageCurrent: String(row.retainage_current ?? '0'),
      retainage30Days: String(row.retainage_30_days ?? '0'),
      retainage60Days: String(row.retainage_60_days ?? '0'),
      retainage90Days: String(row.retainage_90_days ?? '0'),
      retainageOver90: String(row.retainage_over_90 ?? '0'),
      retainageReleased: String(row.retainage_released ?? '0'),
      retainageOutstanding: String(row.retainage_outstanding ?? '0'),
      expectedReleaseDate: row.expected_release_date ? String(row.expected_release_date) : null,
      refreshedAt: new Date(String(row.refreshed_at)),
    };
  }
}
