import { sql } from 'drizzle-orm';
import type { ContextualDatabase } from '../context';
import { BaseRepository } from './base-repository';

export type ProjectBillingCandidateSourceType =
  | 'TIME_ENTRY'
  | 'PROJECT_TASK'
  | 'PROJECT_MILESTONE'
  | 'PROJECT_PROGRESS';

export interface RawProjectBillingCandidate {
  sourceType: ProjectBillingCandidateSourceType;
  sourceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectContractId: string;
  projectContractVersionId: string;
  contractNumber: string;
  billingRuleId: string;
  projectContractLineId: string | null;
  billingRuleName: string;
  grouping: 'customer' | 'project' | 'customer_project';
  currencyCode: string;
  serviceDate: string;
  description: string;
  quantity: string;
  sourceOverrideRate: string | null;
  sourceOverrideField: 'billingRate' | 'flatFeeAmount' | null;
  fixedAmount: string | null;
  entityId: string | null;
  projectTaskId: string | null;
  itemId: string | null;
  projectCostCodeId: string | null;
  ruleDefaultRate: string | null;
  rulePriority: number;
}

export interface ProjectBillingCandidateFilters {
  customerId?: string;
  projectId?: string;
  sourceTypes?: ProjectBillingCandidateSourceType[];
  asOfDate: string;
}

/**
 * Read model for the project billing queue. Every branch scopes organization_id
 * explicitly even when RLS is enabled, so callers cannot broaden tenant access.
 */
export class ProjectBillingQueueRepository extends BaseRepository {
  constructor(db?: ContextualDatabase) {
    super(db);
  }

  async listEligibleCandidates(
    organizationId: string,
    filters: ProjectBillingCandidateFilters,
  ): Promise<RawProjectBillingCandidate[]> {
    const customerFilter = filters.customerId
      ? sql`AND pc.customer_id = ${filters.customerId}::uuid`
      : sql``;
    const projectFilter = filters.projectId
      ? sql`AND pc.project_id = ${filters.projectId}::uuid`
      : sql``;

    const result = await this.db.execute(sql`
      WITH eligible AS (
        SELECT
          'TIME_ENTRY'::text AS "sourceType",
          te.id AS "sourceId",
          te.organization_id AS "organizationId",
          pc.customer_id AS "customerId",
          COALESCE(customer.display_name, customer.name) AS "customerName",
          p.id AS "projectId",
          p.project_code AS "projectCode",
          p.name AS "projectName",
          pc.id AS "projectContractId",
          pcv.id AS "projectContractVersionId",
          pc.contract_number AS "contractNumber",
          br.id AS "billingRuleId",
          br.project_contract_line_id AS "projectContractLineId",
          br.name AS "billingRuleName",
          br.grouping::text AS grouping,
          br.currency_code::text AS "currencyCode",
          te.entry_date::text AS "serviceDate",
          COALESCE(te.description, 'Billable time') AS description,
          te.hours::text AS quantity,
          te.billing_rate::text AS "sourceOverrideRate",
          'billingRate'::text AS "sourceOverrideField",
          NULL::text AS "fixedAmount",
          te.employee_id AS "entityId",
          NULL::uuid AS "projectTaskId",
          NULL::uuid AS "itemId",
          te.cost_code_id AS "projectCostCodeId",
          br.default_rate::text AS "ruleDefaultRate",
          br.priority AS "rulePriority"
        FROM time_entries te
        JOIN projects p
          ON p.id = te.project_id
         AND p.organization_id = te.organization_id
        JOIN project_contracts pc
          ON pc.project_id = p.id
         AND pc.organization_id = te.organization_id
         AND pc.status = 'active'
        JOIN project_contract_versions pcv
          ON pcv.id = pc.current_version_id
         AND pcv.organization_id = te.organization_id
         AND pcv.status = 'approved'
        JOIN LATERAL (
          SELECT rule.*
          FROM project_billing_rules rule
          WHERE rule.organization_id = te.organization_id
            AND rule.project_contract_version_id = pcv.id
            AND rule.rule_type = 'time_and_materials'
            AND rule.is_active = true
            AND rule.effective_start_date <= te.entry_date
            AND (rule.effective_end_date IS NULL OR rule.effective_end_date >= te.entry_date)
          ORDER BY rule.priority DESC, rule.id
          LIMIT 1
        ) br ON true
        JOIN entities customer
          ON customer.id = pc.customer_id
         AND customer.organization_id = te.organization_id
        WHERE te.organization_id = ${organizationId}::uuid
          AND te.status = 'APPROVED'
          AND te.is_billable = true
          AND te.invoiced_at IS NULL
          AND te.entry_date <= ${filters.asOfDate}::date
          ${customerFilter}
          ${projectFilter}
          AND NOT EXISTS (
            SELECT 1
            FROM invoice_source_allocations isa
            WHERE isa.organization_id = te.organization_id
              AND isa.source_type = 'TIME_ENTRY'
              AND isa.source_id = te.id
              AND isa.allocation_status = 'active'
          )

        UNION ALL

        SELECT
          'PROJECT_TASK'::text,
          pt.id,
          pt.organization_id,
          pc.customer_id,
          COALESCE(customer.display_name, customer.name),
          p.id,
          p.project_code,
          p.name,
          pc.id,
          pcv.id,
          pc.contract_number,
          br.id,
          br.project_contract_line_id,
          br.name,
          br.grouping::text,
          br.currency_code::text,
          pt.completed_at::date::text,
          COALESCE(pt.description, pt.task_name),
          CASE WHEN pt.billing_type = 'flat_fee' THEN '1' ELSE COALESCE(pt.actual_hours, '0')::text END,
          CASE WHEN pt.billing_type = 'flat_fee' THEN pt.flat_fee_amount::text ELSE pt.billing_rate::text END,
          CASE WHEN pt.billing_type = 'flat_fee' THEN 'flatFeeAmount' ELSE 'billingRate' END,
          NULL::text,
          pt.assignee_id,
          pt.id,
          pt.service_item_id,
          NULL::uuid,
          br.default_rate::text,
          br.priority
        FROM project_tasks pt
        JOIN projects p
          ON p.id = pt.project_id
         AND p.organization_id = pt.organization_id
        JOIN project_contracts pc
          ON pc.project_id = p.id
         AND pc.organization_id = pt.organization_id
         AND pc.status = 'active'
        JOIN project_contract_versions pcv
          ON pcv.id = pc.current_version_id
         AND pcv.organization_id = pt.organization_id
         AND pcv.status = 'approved'
        JOIN LATERAL (
          SELECT rule.*
          FROM project_billing_rules rule
          WHERE rule.organization_id = pt.organization_id
            AND rule.project_contract_version_id = pcv.id
            AND rule.rule_type = 'time_and_materials'
            AND rule.is_active = true
            AND rule.effective_start_date <= pt.completed_at::date
            AND (rule.effective_end_date IS NULL OR rule.effective_end_date >= pt.completed_at::date)
          ORDER BY rule.priority DESC, rule.id
          LIMIT 1
        ) br ON true
        JOIN entities customer
          ON customer.id = pc.customer_id
         AND customer.organization_id = pt.organization_id
        WHERE pt.organization_id = ${organizationId}::uuid
          AND pt.status = 'COMPLETED'
          AND pt.is_billable = true
          AND pt.invoiced_at IS NULL
          AND pt.completed_at IS NOT NULL
          AND pt.completed_at::date <= ${filters.asOfDate}::date
          ${customerFilter}
          ${projectFilter}
          AND NOT EXISTS (
            SELECT 1 FROM invoice_source_allocations isa
            WHERE isa.organization_id = pt.organization_id
              AND isa.source_type = 'PROJECT_TASK'
              AND isa.source_id = pt.id
              AND isa.allocation_status = 'active'
          )

        UNION ALL

        SELECT
          'PROJECT_MILESTONE'::text,
          bm.id,
          bm.organization_id,
          pc.customer_id,
          COALESCE(customer.display_name, customer.name),
          p.id,
          p.project_code,
          p.name,
          pc.id,
          pcv.id,
          pc.contract_number,
          br.id,
          COALESCE(bm.project_contract_line_id, br.project_contract_line_id),
          br.name,
          br.grouping::text,
          br.currency_code::text,
          COALESCE(bm.approved_at::date, bm.target_date, bm.achieved_at::date)::text,
          COALESCE(bm.description, bm.name),
          '1',
          NULL::text,
          NULL::text,
          COALESCE(bm.amount, br.fixed_fee_amount * bm.percentage / 100)::text,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          NULL::text,
          br.priority
        FROM project_contract_billing_milestones bm
        JOIN project_billing_rules br
          ON br.id = bm.billing_rule_id
         AND br.organization_id = bm.organization_id
         AND br.rule_type = 'fixed_fee_milestone'
         AND br.is_active = true
        JOIN project_contract_versions pcv
          ON pcv.id = br.project_contract_version_id
         AND pcv.organization_id = bm.organization_id
         AND pcv.status = 'approved'
        JOIN project_contracts pc
          ON pc.current_version_id = pcv.id
         AND pc.organization_id = bm.organization_id
         AND pc.status = 'active'
        JOIN projects p
          ON p.id = pc.project_id
         AND p.organization_id = bm.organization_id
        JOIN entities customer
          ON customer.id = pc.customer_id
         AND customer.organization_id = bm.organization_id
        WHERE bm.organization_id = ${organizationId}::uuid
          AND bm.status = 'approved'
          AND bm.invoiced_at IS NULL
          AND COALESCE(bm.approved_at::date, bm.target_date, bm.achieved_at::date) <= ${filters.asOfDate}::date
          ${customerFilter}
          ${projectFilter}
          AND NOT EXISTS (
            SELECT 1 FROM invoice_source_allocations isa
            WHERE isa.organization_id = bm.organization_id
              AND isa.source_type = 'PROJECT_MILESTONE'
              AND isa.source_id = bm.id
              AND isa.allocation_status = 'active'
          )

        UNION ALL

        SELECT
          'PROJECT_PROGRESS'::text,
          cert.id,
          cert.organization_id,
          pc.customer_id,
          COALESCE(customer.display_name, customer.name),
          p.id,
          p.project_code,
          p.name,
          pc.id,
          pcv.id,
          pc.contract_number,
          br.id,
          br.project_contract_line_id,
          br.name,
          br.grouping::text,
          br.currency_code::text,
          cert.certification_date::text,
          CONCAT(br.name, ' - ', cert.cumulative_progress_percent, '% certified'),
          '1',
          NULL::text,
          NULL::text,
          GREATEST(
            cert.cumulative_billable_amount - COALESCE((
              SELECT MAX(prior.cumulative_billable_amount)
              FROM project_progress_certifications prior
              WHERE prior.organization_id = cert.organization_id
                AND prior.billing_rule_id = cert.billing_rule_id
                AND (prior.status = 'invoiced' OR prior.invoiced_at IS NOT NULL)
                AND prior.certification_date <= cert.certification_date
            ), 0),
            0
          )::text,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          NULL::uuid,
          NULL::text,
          br.priority
        FROM project_progress_certifications cert
        JOIN project_billing_rules br
          ON br.id = cert.billing_rule_id
         AND br.organization_id = cert.organization_id
         AND br.rule_type = 'fixed_fee_progress'
         AND br.is_active = true
        JOIN project_contract_versions pcv
          ON pcv.id = br.project_contract_version_id
         AND pcv.organization_id = cert.organization_id
         AND pcv.status = 'approved'
        JOIN project_contracts pc
          ON pc.current_version_id = pcv.id
         AND pc.organization_id = cert.organization_id
         AND pc.status = 'active'
        JOIN projects p
          ON p.id = pc.project_id
         AND p.organization_id = cert.organization_id
        JOIN entities customer
          ON customer.id = pc.customer_id
         AND customer.organization_id = cert.organization_id
        WHERE cert.organization_id = ${organizationId}::uuid
          AND cert.status = 'approved'
          AND cert.invoiced_at IS NULL
          AND cert.certification_date <= ${filters.asOfDate}::date
          ${customerFilter}
          ${projectFilter}
          AND NOT EXISTS (
            SELECT 1 FROM invoice_source_allocations isa
            WHERE isa.organization_id = cert.organization_id
              AND isa.source_type = 'PROJECT_PROGRESS'
              AND isa.source_id = cert.id
              AND isa.allocation_status = 'active'
          )
      )
      SELECT *
      FROM eligible
      WHERE ("fixedAmount" IS NULL OR "fixedAmount"::numeric > 0)
      ORDER BY "serviceDate", "sourceType", "sourceId"
    `);

    const rows = result.rows as unknown as RawProjectBillingCandidate[];
    if (!filters.sourceTypes?.length) return rows;
    const allowed = new Set(filters.sourceTypes);
    return rows.filter((row) => allowed.has(row.sourceType));
  }
}
