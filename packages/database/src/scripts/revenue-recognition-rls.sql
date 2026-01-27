-- ============================================================================
-- Revenue Recognition Row Level Security Policies
-- ============================================================================
-- Tables with indirect organization access through foreign key chains:
-- performance_obligations -> contract_line_items -> contracts (org_id)
-- revenue_schedules -> performance_obligations -> contract_line_items -> contracts
-- revenue_journal_entries -> revenue_schedules chain
-- ssp_evidence -> performance_obligations chain
--
-- Tables with direct organization_id:
-- catch_up_adjustments
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check contract_line_item organization via contracts
CREATE OR REPLACE FUNCTION check_contract_line_item_organization(cli_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contract_line_items cli
    JOIN contracts c ON cli.contract_id = c.id
    WHERE cli.id = cli_id
    AND c.organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check performance_obligation organization via contract_line_items -> contracts
CREATE OR REPLACE FUNCTION check_performance_obligation_organization(po_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM performance_obligations po
    JOIN contract_line_items cli ON po.contract_line_item_id = cli.id
    JOIN contracts c ON cli.contract_id = c.id
    WHERE po.id = po_id
    AND c.organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check revenue_schedule organization via performance_obligations chain
CREATE OR REPLACE FUNCTION check_revenue_schedule_organization(rs_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM revenue_schedules rs
    JOIN performance_obligations po ON rs.performance_obligation_id = po.id
    JOIN contract_line_items cli ON po.contract_line_item_id = cli.id
    JOIN contracts c ON cli.contract_id = c.id
    WHERE rs.id = rs_id
    AND c.organization_id = get_current_organization_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CATCH UP ADJUSTMENTS (Direct org_id)
-- ============================================================================

ALTER TABLE catch_up_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE catch_up_adjustments FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_catch_up_adjustments" ON catch_up_adjustments
    FOR SELECT USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_catch_up_adjustments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_catch_up_adjustments" ON catch_up_adjustments
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_catch_up_adjustments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_catch_up_adjustments" ON catch_up_adjustments
    FOR UPDATE
    USING (organization_id = get_current_organization_id())
    WITH CHECK (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_catch_up_adjustments already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_catch_up_adjustments" ON catch_up_adjustments
    FOR DELETE USING (organization_id = get_current_organization_id());
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_catch_up_adjustments already exists, skipping.';
END $$;

-- ============================================================================
-- PERFORMANCE OBLIGATIONS (Indirect via contract_line_items -> contracts)
-- ============================================================================

ALTER TABLE performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_obligations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_performance_obligations" ON performance_obligations
    FOR SELECT USING (check_performance_obligation_organization(id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_performance_obligations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_performance_obligations" ON performance_obligations
    FOR INSERT WITH CHECK (check_contract_line_item_organization(contract_line_item_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_performance_obligations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_performance_obligations" ON performance_obligations
    FOR UPDATE
    USING (check_performance_obligation_organization(id))
    WITH CHECK (check_contract_line_item_organization(contract_line_item_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_performance_obligations already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_performance_obligations" ON performance_obligations
    FOR DELETE USING (check_performance_obligation_organization(id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_performance_obligations already exists, skipping.';
END $$;

-- ============================================================================
-- REVENUE SCHEDULES (Indirect via performance_obligations chain)
-- ============================================================================

ALTER TABLE revenue_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_schedules FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_revenue_schedules" ON revenue_schedules
    FOR SELECT USING (check_revenue_schedule_organization(id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_revenue_schedules already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_revenue_schedules" ON revenue_schedules
    FOR INSERT WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_revenue_schedules already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_revenue_schedules" ON revenue_schedules
    FOR UPDATE
    USING (check_revenue_schedule_organization(id))
    WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_revenue_schedules already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_revenue_schedules" ON revenue_schedules
    FOR DELETE USING (check_revenue_schedule_organization(id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_revenue_schedules already exists, skipping.';
END $$;

-- ============================================================================
-- REVENUE JOURNAL ENTRIES (Indirect via revenue_schedules chain)
-- ============================================================================

ALTER TABLE revenue_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_journal_entries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_revenue_journal_entries" ON revenue_journal_entries
    FOR SELECT USING (check_revenue_schedule_organization(revenue_schedule_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_revenue_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_revenue_journal_entries" ON revenue_journal_entries
    FOR INSERT WITH CHECK (check_revenue_schedule_organization(revenue_schedule_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_revenue_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_revenue_journal_entries" ON revenue_journal_entries
    FOR UPDATE
    USING (check_revenue_schedule_organization(revenue_schedule_id))
    WITH CHECK (check_revenue_schedule_organization(revenue_schedule_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_revenue_journal_entries already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_revenue_journal_entries" ON revenue_journal_entries
    FOR DELETE USING (check_revenue_schedule_organization(revenue_schedule_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_revenue_journal_entries already exists, skipping.';
END $$;

-- ============================================================================
-- REVENUE RECOGNITION PATTERNS (Indirect via performance_obligations chain)
-- ============================================================================

ALTER TABLE revenue_recognition_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_recognition_patterns FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_revenue_recognition_patterns" ON revenue_recognition_patterns
    FOR SELECT USING (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_revenue_recognition_patterns already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_revenue_recognition_patterns" ON revenue_recognition_patterns
    FOR INSERT WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_revenue_recognition_patterns already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_revenue_recognition_patterns" ON revenue_recognition_patterns
    FOR UPDATE
    USING (check_performance_obligation_organization(performance_obligation_id))
    WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_revenue_recognition_patterns already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_revenue_recognition_patterns" ON revenue_recognition_patterns
    FOR DELETE USING (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_revenue_recognition_patterns already exists, skipping.';
END $$;

-- ============================================================================
-- SSP EVIDENCE (Indirect via performance_obligations chain)
-- ============================================================================

ALTER TABLE ssp_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_evidence FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "org_isolation_select_ssp_evidence" ON ssp_evidence
    FOR SELECT USING (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_select_ssp_evidence already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_ssp_evidence" ON ssp_evidence
    FOR INSERT WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_insert_ssp_evidence already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_ssp_evidence" ON ssp_evidence
    FOR UPDATE
    USING (check_performance_obligation_organization(performance_obligation_id))
    WITH CHECK (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_update_ssp_evidence already exists, skipping.';
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_delete_ssp_evidence" ON ssp_evidence
    FOR DELETE USING (check_performance_obligation_organization(performance_obligation_id));
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy org_isolation_delete_ssp_evidence already exists, skipping.';
END $$;
