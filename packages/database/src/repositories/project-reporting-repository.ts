import { SQL, sql } from 'drizzle-orm';
import { BaseRepository } from './base-repository';

export interface JobCostSummaryRow {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  subsidiaryId: string | null;
  totalBudgetAmount: string | null;
  totalCommittedAmount: string | null;
  totalActualCost: string | null;
  totalWipClearing: string | null;
  percentComplete: string | null;
  lastPostedAt: string | null;
}

export interface JobCostSummaryFilters {
  projectId?: string;
  subsidiaryId?: string;
  search?: string;
}

export class ProjectReportingRepository extends BaseRepository {
  async getJobCostSummary(
    organizationId: string,
    filters: JobCostSummaryFilters = {}
  ): Promise<JobCostSummaryRow[]> {
    const conditions: SQL<unknown>[] = [sql`p.organization_id = ${organizationId}`];

    if (filters.projectId) {
      conditions.push(sql`p.id = ${filters.projectId}`);
    }
    if (filters.subsidiaryId) {
      conditions.push(sql`p.subsidiary_id = ${filters.subsidiaryId}`);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        sql`(p.name ILIKE ${term} OR p.project_code ILIKE ${term} OR p.description ILIKE ${term})`
      );
    }

    const whereClause =
      conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const query = sql<JobCostSummaryRow>`
      WITH budget AS (
        SELECT
          pbv.project_id,
          COALESCE(SUM(pbl.revised_budget_amount), 0) AS total_budget_amount,
          COALESCE(SUM(pbl.committed_amount), 0) AS total_committed_amount
        FROM project_budget_versions pbv
        INNER JOIN project_budget_lines pbl ON pbl.budget_version_id = pbv.id
        WHERE pbv.is_current = true
        GROUP BY pbv.project_id
      ),
      actual AS (
        SELECT
          gtl.project_id,
          COALESCE(SUM(gtl.base_debit_amount - gtl.base_credit_amount), 0) AS total_actual_cost,
          MAX(gt.posted_date) AS last_posted_at
        FROM gl_transaction_lines gtl
        INNER JOIN gl_transactions gt ON gt.id = gtl.transaction_id
        INNER JOIN project_cost_codes pcc
          ON pcc.cost_account_id = gtl.account_id
         AND pcc.project_id = gtl.project_id
        WHERE gtl.project_id IS NOT NULL
          AND gt.status = 'POSTED'
        GROUP BY gtl.project_id
      ),
      wip AS (
        SELECT
          gtl.project_id,
          COALESCE(SUM(gtl.base_credit_amount - gtl.base_debit_amount), 0) AS total_wip_clearing
        FROM gl_transaction_lines gtl
        INNER JOIN gl_transactions gt ON gt.id = gtl.transaction_id
        INNER JOIN project_cost_codes pcc
          ON pcc.wip_account_id = gtl.account_id
         AND pcc.project_id = gtl.project_id
        WHERE gtl.project_id IS NOT NULL
          AND gt.status = 'POSTED'
        GROUP BY gtl.project_id
      )
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        p.project_code AS "projectCode",
        p.subsidiary_id AS "subsidiaryId",
        COALESCE(budget.total_budget_amount, 0)::text AS "totalBudgetAmount",
        COALESCE(budget.total_committed_amount, 0)::text AS "totalCommittedAmount",
        COALESCE(actual.total_actual_cost, 0)::text AS "totalActualCost",
        COALESCE(wip.total_wip_clearing, 0)::text AS "totalWipClearing",
        COALESCE(actual.last_posted_at::text, NULL) AS "lastPostedAt",
        CASE
          WHEN COALESCE(budget.total_budget_amount, 0) = 0 THEN '0'
          ELSE ROUND(
            (COALESCE(actual.total_actual_cost, 0) / NULLIF(budget.total_budget_amount, 0)) * 100,
            2
          )::text
        END AS "percentComplete"
      FROM projects p
      LEFT JOIN budget ON budget.project_id = p.id
      LEFT JOIN actual ON actual.project_id = p.id
      LEFT JOIN wip ON wip.project_id = p.id
      ${whereClause}
      ORDER BY p.name ASC
    `;

    const rows = await this.db.execute(query);
    return rows;
  }
}
