-- 0073_unify_606_ledger_obligations.sql
--
-- Goal: Unify ASC-606 subscription-based calculations with the existing contract-based
-- performance obligation tables by evolving the existing tables into a superset schema.
--
-- We intentionally mutate existing tables (no duplicates) while keeping legacy columns
-- for contract workflows.

-- =============================================================================
-- performance_obligations
-- =============================================================================

-- Allow subscription-based obligations (no contract_line_item_id).
DO $$
BEGIN
  ALTER TABLE public.performance_obligations
    ALTER COLUMN contract_line_item_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Column may already be nullable; ignore.
    NULL;
END $$;

ALTER TABLE public.performance_obligations
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.items(id),
  ADD COLUMN IF NOT EXISTS obligation_type text,
  ADD COLUMN IF NOT EXISTS satisfaction_method text,
  ADD COLUMN IF NOT EXISTS satisfaction_period_months integer,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(14,2);

-- Backfill org + item + allocated_amount for legacy contract obligations.
UPDATE public.performance_obligations po
SET
  organization_id = c.organization_id,
  item_id = cli.product_id,
  allocated_amount = COALESCE(po.allocated_amount, po.allocated_transaction_price)
FROM public.contract_line_items cli
JOIN public.contracts c ON c.id = cli.contract_id
WHERE po.contract_line_item_id = cli.id
  AND (
    po.organization_id IS NULL
    OR po.item_id IS NULL
    OR po.allocated_amount IS NULL
  );

UPDATE public.performance_obligations
SET allocated_amount = allocated_transaction_price
WHERE allocated_amount IS NULL
  AND allocated_transaction_price IS NOT NULL;

-- Set a reasonable default status for any rows missing it.
UPDATE public.performance_obligations
SET status = 'Pending'
WHERE status IS NULL;

-- Trigger to populate organization_id (and item_id) when the writer didn't provide it.
CREATE OR REPLACE FUNCTION public.set_performance_obligation_org_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF NEW.subscription_id IS NOT NULL THEN
      SELECT s.organization_id INTO NEW.organization_id
      FROM public.subscriptions s
      WHERE s.id = NEW.subscription_id;
    ELSIF NEW.contract_line_item_id IS NOT NULL THEN
      SELECT c.organization_id INTO NEW.organization_id
      FROM public.contract_line_items cli
      JOIN public.contracts c ON c.id = cli.contract_id
      WHERE cli.id = NEW.contract_line_item_id;
    END IF;
  END IF;

  IF NEW.item_id IS NULL AND NEW.contract_line_item_id IS NOT NULL THEN
    SELECT cli.product_id INTO NEW.item_id
    FROM public.contract_line_items cli
    WHERE cli.id = NEW.contract_line_item_id;
  END IF;

  IF NEW.allocated_amount IS NULL THEN
    NEW.allocated_amount := NEW.allocated_transaction_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_performance_obligation_org_id ON public.performance_obligations;
CREATE TRIGGER trg_set_performance_obligation_org_id
BEFORE INSERT OR UPDATE ON public.performance_obligations
FOR EACH ROW
EXECUTE FUNCTION public.set_performance_obligation_org_id();

-- Only enforce NOT NULL once we've backfilled everything we can.
DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.performance_obligations
  WHERE organization_id IS NULL;

  IF missing_count = 0 THEN
    ALTER TABLE public.performance_obligations
      ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_performance_obligations_org ON public.performance_obligations(organization_id);
CREATE INDEX IF NOT EXISTS idx_performance_obligations_org_subscription
  ON public.performance_obligations(organization_id, subscription_id);
CREATE INDEX IF NOT EXISTS idx_performance_obligations_subscription
  ON public.performance_obligations(subscription_id);

-- Replace check_performance_obligation_organization(uuid) to use the new org column.
-- Use CREATE OR REPLACE to avoid breaking dependent RLS policies on other tables.
CREATE OR REPLACE FUNCTION public.check_performance_obligation_organization(po_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.performance_obligations po
    WHERE po.id = po_id
      AND po.organization_id = public.get_current_organization_id()
  );
$$;

-- RLS: ensure full CRUD policies exist for both legacy + subscription obligations.
ALTER TABLE public.performance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_obligations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_select_performance_obligations ON public.performance_obligations;
DROP POLICY IF EXISTS org_isolation_insert_performance_obligations ON public.performance_obligations;
DROP POLICY IF EXISTS org_isolation_update_performance_obligations ON public.performance_obligations;
DROP POLICY IF EXISTS org_isolation_delete_performance_obligations ON public.performance_obligations;

CREATE POLICY org_isolation_select_performance_obligations
  ON public.performance_obligations FOR SELECT
  USING (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_insert_performance_obligations
  ON public.performance_obligations FOR INSERT
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_update_performance_obligations
  ON public.performance_obligations FOR UPDATE
  USING (organization_id = public.get_current_organization_id())
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_delete_performance_obligations
  ON public.performance_obligations FOR DELETE
  USING (organization_id = public.get_current_organization_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_obligations TO glapiuser;

-- =============================================================================
-- revenue_schedules
-- =============================================================================

ALTER TABLE public.revenue_schedules
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS period_start_date date,
  ADD COLUMN IF NOT EXISTS period_end_date date,
  ADD COLUMN IF NOT EXISTS recognition_pattern text,
  ADD COLUMN IF NOT EXISTS status text;

-- Backfill org + period dates for legacy rows.
UPDATE public.revenue_schedules rs
SET
  organization_id = po.organization_id,
  period_start_date = COALESCE(rs.period_start_date, rs.schedule_date),
  period_end_date = COALESCE(rs.period_end_date, rs.schedule_date),
  recognition_pattern = COALESCE(rs.recognition_pattern, 'straight_line'),
  status = COALESCE(
    rs.status,
    CASE
      WHEN rs.recognition_date IS NOT NULL OR COALESCE(rs.recognized_amount, 0) > 0 THEN 'recognized'
      ELSE 'scheduled'
    END
  )
FROM public.performance_obligations po
WHERE rs.performance_obligation_id = po.id
  AND (
    rs.organization_id IS NULL
    OR rs.period_start_date IS NULL
    OR rs.period_end_date IS NULL
    OR rs.recognition_pattern IS NULL
    OR rs.status IS NULL
  );

-- Trigger to populate org_id + legacy schedule_date when writers only provide the new period fields.
CREATE OR REPLACE FUNCTION public.set_revenue_schedule_org_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT po.organization_id INTO NEW.organization_id
    FROM public.performance_obligations po
    WHERE po.id = NEW.performance_obligation_id;
  END IF;

  IF NEW.period_start_date IS NULL THEN
    NEW.period_start_date := NEW.schedule_date;
  END IF;

  IF NEW.period_end_date IS NULL THEN
    NEW.period_end_date := NEW.schedule_date;
  END IF;

  -- Keep legacy schedule_date filled for compatibility.
  IF NEW.schedule_date IS NULL THEN
    NEW.schedule_date := NEW.period_start_date;
  END IF;

  IF NEW.recognition_pattern IS NULL THEN
    NEW.recognition_pattern := 'straight_line';
  END IF;

  IF NEW.status IS NULL THEN
    NEW.status := CASE
      WHEN NEW.recognition_date IS NOT NULL OR COALESCE(NEW.recognized_amount, 0) > 0 THEN 'recognized'
      ELSE 'scheduled'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_revenue_schedule_org_id ON public.revenue_schedules;
CREATE TRIGGER trg_set_revenue_schedule_org_id
BEFORE INSERT OR UPDATE ON public.revenue_schedules
FOR EACH ROW
EXECUTE FUNCTION public.set_revenue_schedule_org_id();

DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.revenue_schedules
  WHERE organization_id IS NULL;

  IF missing_count = 0 THEN
    ALTER TABLE public.revenue_schedules
      ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revenue_schedules_org ON public.revenue_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_schedules_org_po_date
  ON public.revenue_schedules(organization_id, performance_obligation_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_revenue_schedules_po_period
  ON public.revenue_schedules(performance_obligation_id, period_start_date);

-- Replace the join-heavy RLS policies with org_id-based policies.
ALTER TABLE public.revenue_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_select_revenue_schedules ON public.revenue_schedules;
DROP POLICY IF EXISTS org_isolation_insert_revenue_schedules ON public.revenue_schedules;
DROP POLICY IF EXISTS org_isolation_update_revenue_schedules ON public.revenue_schedules;
DROP POLICY IF EXISTS org_isolation_delete_revenue_schedules ON public.revenue_schedules;

CREATE POLICY org_isolation_select_revenue_schedules
  ON public.revenue_schedules FOR SELECT
  USING (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_insert_revenue_schedules
  ON public.revenue_schedules FOR INSERT
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_update_revenue_schedules
  ON public.revenue_schedules FOR UPDATE
  USING (organization_id = public.get_current_organization_id())
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_delete_revenue_schedules
  ON public.revenue_schedules FOR DELETE
  USING (organization_id = public.get_current_organization_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_schedules TO glapiuser;

-- =============================================================================
-- contract_ssp_allocations
-- =============================================================================

-- Allow subscription-based allocations (no contract_id / line_item_id).
DO $$
BEGIN
  ALTER TABLE public.contract_ssp_allocations
    ALTER COLUMN contract_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.contract_ssp_allocations
    ALTER COLUMN line_item_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.contract_ssp_allocations
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS performance_obligation_id uuid REFERENCES public.performance_obligations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ssp_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS allocation_percentage numeric(14,6),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill org_id for legacy rows.
UPDATE public.contract_ssp_allocations a
SET organization_id = c.organization_id
FROM public.contracts c
WHERE a.contract_id = c.id
  AND a.organization_id IS NULL;

-- Backfill created_at from allocation_date when present.
UPDATE public.contract_ssp_allocations
SET created_at = allocation_date
WHERE allocation_date IS NOT NULL
  AND created_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_contract_ssp_allocation_org_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF NEW.subscription_id IS NOT NULL THEN
      SELECT s.organization_id INTO NEW.organization_id
      FROM public.subscriptions s
      WHERE s.id = NEW.subscription_id;
    ELSIF NEW.contract_id IS NOT NULL THEN
      SELECT c.organization_id INTO NEW.organization_id
      FROM public.contracts c
      WHERE c.id = NEW.contract_id;
    END IF;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_ssp_allocation_org_id ON public.contract_ssp_allocations;
CREATE TRIGGER trg_set_contract_ssp_allocation_org_id
BEFORE INSERT OR UPDATE ON public.contract_ssp_allocations
FOR EACH ROW
EXECUTE FUNCTION public.set_contract_ssp_allocation_org_id();

DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.contract_ssp_allocations
  WHERE organization_id IS NULL;

  IF missing_count = 0 THEN
    ALTER TABLE public.contract_ssp_allocations
      ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contract_ssp_allocations_org ON public.contract_ssp_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_ssp_allocations_org_subscription
  ON public.contract_ssp_allocations(organization_id, subscription_id);

ALTER TABLE public.contract_ssp_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_ssp_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_select_contract_ssp_allocations ON public.contract_ssp_allocations;
DROP POLICY IF EXISTS org_isolation_insert_contract_ssp_allocations ON public.contract_ssp_allocations;
DROP POLICY IF EXISTS org_isolation_update_contract_ssp_allocations ON public.contract_ssp_allocations;
DROP POLICY IF EXISTS org_isolation_delete_contract_ssp_allocations ON public.contract_ssp_allocations;

CREATE POLICY org_isolation_select_contract_ssp_allocations
  ON public.contract_ssp_allocations FOR SELECT
  USING (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_insert_contract_ssp_allocations
  ON public.contract_ssp_allocations FOR INSERT
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_update_contract_ssp_allocations
  ON public.contract_ssp_allocations FOR UPDATE
  USING (organization_id = public.get_current_organization_id())
  WITH CHECK (organization_id = public.get_current_organization_id());

CREATE POLICY org_isolation_delete_contract_ssp_allocations
  ON public.contract_ssp_allocations FOR DELETE
  USING (organization_id = public.get_current_organization_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_ssp_allocations TO glapiuser;
