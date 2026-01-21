-- Migration: 0021_wip_materialized_views
-- Description: Create materialized views for WIP and percent complete reporting
-- Date: 2026-01-19

-- ============================================================================
-- project_wip_summary: Aggregates WIP data per project for controllers
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS project_wip_summary AS
SELECT
  p.id AS project_id,
  p.organization_id,
  p.subsidiary_id,
  p.project_code,
  p.name AS project_name,
  p.status AS project_status,
  p.retainage_percent,
  -- Budget totals from current version
  COALESCE(bv.total_budget_amount, 0) AS total_budget_amount,
  COALESCE(bv.total_labor_amount, 0) AS budget_labor,
  COALESCE(bv.total_material_amount, 0) AS budget_material,
  COALESCE(bv.total_equipment_amount, 0) AS budget_equipment,
  COALESCE(bv.total_subcontract_amount, 0) AS budget_subcontract,
  COALESCE(bv.total_other_amount, 0) AS budget_other,
  -- Aggregated costs from cost codes
  COALESCE(cc_agg.total_committed, 0) AS total_committed_amount,
  COALESCE(cc_agg.total_actual, 0) AS total_actual_cost,
  -- Billing totals from billing schedules
  COALESCE(bs_agg.total_billed, 0) AS total_billed_amount,
  COALESCE(bs_agg.total_collected, 0) AS total_collected_amount,
  COALESCE(bs_agg.total_retainage_held, 0) AS total_retainage_held,
  -- WIP Calculations
  COALESCE(cc_agg.total_actual, 0) - COALESCE(bs_agg.total_billed, 0) AS wip_balance,
  CASE
    WHEN COALESCE(cc_agg.total_actual, 0) > COALESCE(bs_agg.total_billed, 0)
    THEN COALESCE(cc_agg.total_actual, 0) - COALESCE(bs_agg.total_billed, 0)
    ELSE 0
  END AS underbillings,
  CASE
    WHEN COALESCE(bs_agg.total_billed, 0) > COALESCE(cc_agg.total_actual, 0)
    THEN COALESCE(bs_agg.total_billed, 0) - COALESCE(cc_agg.total_actual, 0)
    ELSE 0
  END AS overbillings,
  -- Cost breakdown by type
  COALESCE(cc_agg.actual_labor, 0) AS actual_labor,
  COALESCE(cc_agg.actual_material, 0) AS actual_material,
  COALESCE(cc_agg.actual_equipment, 0) AS actual_equipment,
  COALESCE(cc_agg.actual_subcontract, 0) AS actual_subcontract,
  COALESCE(cc_agg.actual_other, 0) AS actual_other,
  -- Variance
  COALESCE(bv.total_budget_amount, 0) - COALESCE(cc_agg.total_actual, 0) AS budget_variance,
  -- Timestamps
  p.created_at AS project_created_at,
  p.start_date AS project_start_date,
  p.end_date AS project_end_date,
  NOW() AS refreshed_at
FROM projects p
LEFT JOIN project_budget_versions bv
  ON bv.project_id = p.id AND bv.is_current = true
LEFT JOIN (
  SELECT
    project_id,
    SUM(committed_amount) AS total_committed,
    SUM(actual_amount) AS total_actual,
    SUM(CASE WHEN cost_type = 'LABOR' THEN actual_amount ELSE 0 END) AS actual_labor,
    SUM(CASE WHEN cost_type = 'MATERIAL' THEN actual_amount ELSE 0 END) AS actual_material,
    SUM(CASE WHEN cost_type = 'EQUIPMENT' THEN actual_amount ELSE 0 END) AS actual_equipment,
    SUM(CASE WHEN cost_type = 'SUBCONTRACT' THEN actual_amount ELSE 0 END) AS actual_subcontract,
    SUM(CASE WHEN cost_type = 'OTHER' THEN actual_amount ELSE 0 END) AS actual_other
  FROM project_cost_codes
  WHERE is_active = true
  GROUP BY project_id
) cc_agg ON cc_agg.project_id = p.id
LEFT JOIN (
  SELECT
    project_id,
    SUM(CASE WHEN status IN ('APPROVED', 'SENT', 'PAID') THEN scheduled_amount ELSE 0 END) AS total_billed,
    SUM(CASE WHEN status = 'PAID' THEN scheduled_amount ELSE 0 END) AS total_collected,
    SUM(retainage_amount) AS total_retainage_held
  FROM billing_schedules
  GROUP BY project_id
) bs_agg ON bs_agg.project_id = p.id
WHERE p.status NOT IN ('cancelled', 'closed');

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_wip_summary_project
  ON project_wip_summary (project_id);
CREATE INDEX IF NOT EXISTS idx_wip_summary_org
  ON project_wip_summary (organization_id);
CREATE INDEX IF NOT EXISTS idx_wip_summary_subsidiary
  ON project_wip_summary (subsidiary_id);

-- ============================================================================
-- project_percent_complete: Earned value and percent complete calculations
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS project_percent_complete AS
SELECT
  p.id AS project_id,
  p.organization_id,
  p.subsidiary_id,
  p.project_code,
  p.name AS project_name,
  p.status AS project_status,
  -- Budget and costs
  COALESCE(bv.total_budget_amount, 0) AS budget_at_completion,
  COALESCE(cc_agg.total_actual, 0) AS actual_cost,
  COALESCE(cc_agg.total_committed, 0) AS committed_cost,
  -- Estimate to complete (from budget lines)
  COALESCE(bl_agg.estimate_to_complete, 0) AS estimate_to_complete,
  -- Estimate at completion (actual + ETC)
  COALESCE(cc_agg.total_actual, 0) + COALESCE(bl_agg.estimate_to_complete, 0) AS estimate_at_completion,
  -- Percent complete calculations
  CASE
    WHEN COALESCE(bv.total_budget_amount, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(cc_agg.total_actual, 0) / bv.total_budget_amount) * 100, 2)
  END AS cost_percent_complete,
  -- Earned value (budget * percent complete)
  CASE
    WHEN COALESCE(bv.total_budget_amount, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(cc_agg.total_actual, 0) / bv.total_budget_amount) * bv.total_budget_amount, 2)
  END AS earned_value,
  -- Schedule variance (EV - Planned Value) - simplified as we don't have schedule data
  -- Using cost-based metrics only
  COALESCE(bv.total_budget_amount, 0) - COALESCE(cc_agg.total_actual, 0) AS remaining_budget,
  -- Cost variance (EV - AC)
  CASE
    WHEN COALESCE(bv.total_budget_amount, 0) = 0 THEN 0
    ELSE COALESCE(bv.total_budget_amount, 0) -
         (COALESCE(cc_agg.total_actual, 0) + COALESCE(bl_agg.estimate_to_complete, 0))
  END AS projected_variance,
  -- Cost Performance Index (CPI = EV / AC)
  CASE
    WHEN COALESCE(cc_agg.total_actual, 0) = 0 THEN 1
    WHEN COALESCE(bv.total_budget_amount, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(cc_agg.total_actual, 0) / bv.total_budget_amount) * bv.total_budget_amount /
      NULLIF(cc_agg.total_actual, 0),
      4
    )
  END AS cost_performance_index,
  -- Variance at completion (BAC - EAC)
  COALESCE(bv.total_budget_amount, 0) -
    (COALESCE(cc_agg.total_actual, 0) + COALESCE(bl_agg.estimate_to_complete, 0)) AS variance_at_completion,
  -- Percent by cost type
  CASE
    WHEN COALESCE(cc_agg.budget_labor, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(cc_agg.actual_labor, 0) / cc_agg.budget_labor) * 100, 2)
  END AS labor_percent_complete,
  CASE
    WHEN COALESCE(cc_agg.budget_material, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(cc_agg.actual_material, 0) / cc_agg.budget_material) * 100, 2)
  END AS material_percent_complete,
  CASE
    WHEN COALESCE(cc_agg.budget_subcontract, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(cc_agg.actual_subcontract, 0) / cc_agg.budget_subcontract) * 100, 2)
  END AS subcontract_percent_complete,
  -- Latest snapshot data
  snap.snapshot_date AS last_snapshot_date,
  snap.percent_complete AS snapshot_percent_complete,
  -- Refresh timestamp
  NOW() AS refreshed_at
FROM projects p
LEFT JOIN project_budget_versions bv
  ON bv.project_id = p.id AND bv.is_current = true
LEFT JOIN (
  SELECT
    project_id,
    SUM(committed_amount) AS total_committed,
    SUM(actual_amount) AS total_actual,
    SUM(budget_amount) AS total_budget,
    SUM(CASE WHEN cost_type = 'LABOR' THEN budget_amount ELSE 0 END) AS budget_labor,
    SUM(CASE WHEN cost_type = 'LABOR' THEN actual_amount ELSE 0 END) AS actual_labor,
    SUM(CASE WHEN cost_type = 'MATERIAL' THEN budget_amount ELSE 0 END) AS budget_material,
    SUM(CASE WHEN cost_type = 'MATERIAL' THEN actual_amount ELSE 0 END) AS actual_material,
    SUM(CASE WHEN cost_type = 'SUBCONTRACT' THEN budget_amount ELSE 0 END) AS budget_subcontract,
    SUM(CASE WHEN cost_type = 'SUBCONTRACT' THEN actual_amount ELSE 0 END) AS actual_subcontract
  FROM project_cost_codes
  WHERE is_active = true
  GROUP BY project_id
) cc_agg ON cc_agg.project_id = p.id
LEFT JOIN (
  SELECT
    pbl.budget_version_id,
    SUM(pbl.estimate_to_complete) AS estimate_to_complete
  FROM project_budget_lines pbl
  GROUP BY pbl.budget_version_id
) bl_agg ON bl_agg.budget_version_id = bv.id
LEFT JOIN LATERAL (
  SELECT snapshot_date, percent_complete
  FROM project_progress_snapshots pps
  WHERE pps.project_id = p.id
  ORDER BY snapshot_date DESC
  LIMIT 1
) snap ON true
WHERE p.status NOT IN ('cancelled', 'closed');

-- Indexes for percent complete view
CREATE UNIQUE INDEX IF NOT EXISTS idx_pct_complete_project
  ON project_percent_complete (project_id);
CREATE INDEX IF NOT EXISTS idx_pct_complete_org
  ON project_percent_complete (organization_id);
CREATE INDEX IF NOT EXISTS idx_pct_complete_subsidiary
  ON project_percent_complete (subsidiary_id);

-- ============================================================================
-- project_retainage_aging: Tracks retainage exposure and aging
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS project_retainage_aging AS
SELECT
  p.id AS project_id,
  p.organization_id,
  p.subsidiary_id,
  p.project_code,
  p.name AS project_name,
  p.retainage_percent,
  -- Total retainage held
  COALESCE(ret.total_retainage, 0) AS total_retainage_held,
  -- Aging buckets
  COALESCE(ret.retainage_current, 0) AS retainage_current,
  COALESCE(ret.retainage_30_days, 0) AS retainage_30_days,
  COALESCE(ret.retainage_60_days, 0) AS retainage_60_days,
  COALESCE(ret.retainage_90_days, 0) AS retainage_90_days,
  COALESCE(ret.retainage_over_90, 0) AS retainage_over_90,
  -- Release tracking
  COALESCE(ret.retainage_released, 0) AS retainage_released,
  COALESCE(ret.total_retainage, 0) - COALESCE(ret.retainage_released, 0) AS retainage_outstanding,
  -- Expected release date (project end date)
  p.end_date AS expected_release_date,
  -- Refresh timestamp
  NOW() AS refreshed_at
FROM projects p
LEFT JOIN (
  SELECT
    project_id,
    SUM(retainage_amount) AS total_retainage,
    SUM(CASE WHEN status = 'PAID' AND retainage_released = true THEN retainage_amount ELSE 0 END) AS retainage_released,
    SUM(CASE
      WHEN scheduled_date >= CURRENT_DATE - INTERVAL '30 days' THEN retainage_amount
      ELSE 0
    END) AS retainage_current,
    SUM(CASE
      WHEN scheduled_date < CURRENT_DATE - INTERVAL '30 days'
        AND scheduled_date >= CURRENT_DATE - INTERVAL '60 days' THEN retainage_amount
      ELSE 0
    END) AS retainage_30_days,
    SUM(CASE
      WHEN scheduled_date < CURRENT_DATE - INTERVAL '60 days'
        AND scheduled_date >= CURRENT_DATE - INTERVAL '90 days' THEN retainage_amount
      ELSE 0
    END) AS retainage_60_days,
    SUM(CASE
      WHEN scheduled_date < CURRENT_DATE - INTERVAL '90 days'
        AND scheduled_date >= CURRENT_DATE - INTERVAL '120 days' THEN retainage_amount
      ELSE 0
    END) AS retainage_90_days,
    SUM(CASE
      WHEN scheduled_date < CURRENT_DATE - INTERVAL '120 days' THEN retainage_amount
      ELSE 0
    END) AS retainage_over_90
  FROM billing_schedules
  WHERE retainage_amount > 0
  GROUP BY project_id
) ret ON ret.project_id = p.id
WHERE p.retainage_percent > 0;

-- Indexes for retainage aging
CREATE UNIQUE INDEX IF NOT EXISTS idx_retainage_aging_project
  ON project_retainage_aging (project_id);
CREATE INDEX IF NOT EXISTS idx_retainage_aging_org
  ON project_retainage_aging (organization_id);

-- ============================================================================
-- Function to refresh all WIP materialized views
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_wip_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_wip_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_percent_complete;
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_retainage_aging;
END;
$$;

-- ============================================================================
-- Tracking table for refresh history
-- ============================================================================
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  view_name TEXT NOT NULL,
  refresh_type TEXT NOT NULL DEFAULT 'CONCURRENT',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  row_count INTEGER,
  triggered_by TEXT,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_view
  ON materialized_view_refresh_log (view_name, started_at DESC);

-- ============================================================================
-- Function to refresh with logging
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_wip_views_with_logging(
  p_triggered_by TEXT DEFAULT 'manual'
)
RETURNS TABLE(view_name TEXT, duration_ms INTEGER, row_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
  v_duration INTEGER;
  v_count INTEGER;
  v_log_id UUID;
BEGIN
  -- Refresh project_wip_summary
  v_start := clock_timestamp();
  INSERT INTO materialized_view_refresh_log (view_name, triggered_by, started_at)
  VALUES ('project_wip_summary', p_triggered_by, v_start)
  RETURNING id INTO v_log_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY project_wip_summary;

  v_end := clock_timestamp();
  v_duration := EXTRACT(MILLISECONDS FROM (v_end - v_start))::INTEGER;
  SELECT COUNT(*) INTO v_count FROM project_wip_summary;

  UPDATE materialized_view_refresh_log
  SET completed_at = v_end, duration_ms = v_duration, row_count = v_count
  WHERE id = v_log_id;

  view_name := 'project_wip_summary';
  duration_ms := v_duration;
  row_count := v_count;
  RETURN NEXT;

  -- Refresh project_percent_complete
  v_start := clock_timestamp();
  INSERT INTO materialized_view_refresh_log (view_name, triggered_by, started_at)
  VALUES ('project_percent_complete', p_triggered_by, v_start)
  RETURNING id INTO v_log_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY project_percent_complete;

  v_end := clock_timestamp();
  v_duration := EXTRACT(MILLISECONDS FROM (v_end - v_start))::INTEGER;
  SELECT COUNT(*) INTO v_count FROM project_percent_complete;

  UPDATE materialized_view_refresh_log
  SET completed_at = v_end, duration_ms = v_duration, row_count = v_count
  WHERE id = v_log_id;

  view_name := 'project_percent_complete';
  duration_ms := v_duration;
  row_count := v_count;
  RETURN NEXT;

  -- Refresh project_retainage_aging
  v_start := clock_timestamp();
  INSERT INTO materialized_view_refresh_log (view_name, triggered_by, started_at)
  VALUES ('project_retainage_aging', p_triggered_by, v_start)
  RETURNING id INTO v_log_id;

  REFRESH MATERIALIZED VIEW CONCURRENTLY project_retainage_aging;

  v_end := clock_timestamp();
  v_duration := EXTRACT(MILLISECONDS FROM (v_end - v_start))::INTEGER;
  SELECT COUNT(*) INTO v_count FROM project_retainage_aging;

  UPDATE materialized_view_refresh_log
  SET completed_at = v_end, duration_ms = v_duration, row_count = v_count
  WHERE id = v_log_id;

  view_name := 'project_retainage_aging';
  duration_ms := v_duration;
  row_count := v_count;
  RETURN NEXT;
END;
$$;

-- Comment explaining usage
COMMENT ON FUNCTION refresh_wip_views_with_logging IS
'Refreshes all WIP materialized views concurrently and logs the results.
Call this function on a schedule (e.g., every 15 minutes) or after batch updates.
Example: SELECT * FROM refresh_wip_views_with_logging(''scheduled'');';
