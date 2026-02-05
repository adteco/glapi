-- Fix Project Tasks RLS Policies
-- The check_project_organization() function was using get_current_organization_id()
-- which can cause issues with INSERT operations. This updates it to use
-- current_setting() directly.
--
-- Note: project_tasks uses INDIRECT RLS via the projects table (check_project_organization function)
-- It does NOT have its own organization_id column.

-- =============================================================================
-- UPDATE HELPER FUNCTION
-- =============================================================================
-- This function is used by: project_tasks, project_participants, project_cost_codes,
-- and project_budget_versions for indirect RLS checks

CREATE OR REPLACE FUNCTION public.check_project_organization(project_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  org_id_text TEXT;
BEGIN
  org_id_text := current_setting('app.current_organization_id', true);
  IF org_id_text IS NULL OR org_id_text = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_id
    AND organization_id::text = org_id_text
  );
END;
$function$;

-- =============================================================================
-- RECREATE PROJECT_TASKS POLICIES (if they don't exist)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'org_isolation_select_project_tasks'
  ) THEN
    CREATE POLICY "org_isolation_select_project_tasks" ON project_tasks
      FOR SELECT USING (check_project_organization(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'org_isolation_insert_project_tasks'
  ) THEN
    CREATE POLICY "org_isolation_insert_project_tasks" ON project_tasks
      FOR INSERT WITH CHECK (check_project_organization(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'org_isolation_update_project_tasks'
  ) THEN
    CREATE POLICY "org_isolation_update_project_tasks" ON project_tasks
      FOR UPDATE
      USING (check_project_organization(project_id))
      WITH CHECK (check_project_organization(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'org_isolation_delete_project_tasks'
  ) THEN
    CREATE POLICY "org_isolation_delete_project_tasks" ON project_tasks
      FOR DELETE USING (check_project_organization(project_id));
  END IF;
END $$;
