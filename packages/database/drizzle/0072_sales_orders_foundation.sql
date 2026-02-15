-- Sales Orders Foundation Migration
-- Adds missing sales order tables required by ASC-606 sales-order API flow.

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'sales_order_status'
  ) THEN
    CREATE TYPE public.sales_order_status AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'CLOSED',
      'CANCELLED',
      'ON_HOLD'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'approval_action_type'
  ) THEN
    CREATE TYPE public.approval_action_type AS ENUM (
      'SUBMIT',
      'APPROVE',
      'REJECT',
      'RETURN_FOR_REVISION',
      'ESCALATE',
      'DELEGATE'
    );
  END IF;
END $$;

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  subsidiary_id uuid NOT NULL REFERENCES public.subsidiaries(id),
  order_number varchar(50) NOT NULL,
  external_reference varchar(100),
  entity_id uuid NOT NULL REFERENCES public.entities(id),
  billing_address_id uuid,
  shipping_address_id uuid,
  order_date date NOT NULL,
  requested_delivery_date date,
  promised_delivery_date date,
  expiration_date date,
  status public.sales_order_status NOT NULL DEFAULT 'DRAFT',
  previous_status public.sales_order_status,
  currency_code varchar(3) NOT NULL DEFAULT 'USD',
  exchange_rate numeric(18,8) DEFAULT '1',
  subtotal numeric(18,4) NOT NULL DEFAULT '0',
  discount_amount numeric(18,4) DEFAULT '0',
  discount_percent numeric(5,2) DEFAULT '0',
  tax_amount numeric(18,4) DEFAULT '0',
  shipping_amount numeric(18,4) DEFAULT '0',
  total_amount numeric(18,4) NOT NULL DEFAULT '0',
  fulfilled_amount numeric(18,4) DEFAULT '0',
  invoiced_amount numeric(18,4) DEFAULT '0',
  remaining_amount numeric(18,4) DEFAULT '0',
  payment_terms varchar(50),
  shipping_method varchar(100),
  memo text,
  internal_notes text,
  metadata jsonb,
  requires_approval boolean DEFAULT false,
  approval_threshold numeric(18,4),
  current_approver_id uuid,
  approval_level integer DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text
);

CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  item_id uuid REFERENCES public.items(id),
  description text NOT NULL,
  sku varchar(100),
  quantity numeric(18,4) NOT NULL,
  unit_of_measure varchar(20),
  fulfilled_quantity numeric(18,4) DEFAULT '0',
  invoiced_quantity numeric(18,4) DEFAULT '0',
  cancelled_quantity numeric(18,4) DEFAULT '0',
  remaining_quantity numeric(18,4) DEFAULT '0',
  unit_price numeric(18,4) NOT NULL,
  discount_amount numeric(18,4) DEFAULT '0',
  discount_percent numeric(5,2) DEFAULT '0',
  tax_amount numeric(18,4) DEFAULT '0',
  tax_code varchar(50),
  line_total numeric(18,4) NOT NULL,
  requested_delivery_date date,
  promised_delivery_date date,
  department_id uuid,
  location_id uuid,
  class_id uuid,
  project_id uuid,
  revenue_account_id uuid,
  deferred_revenue_account_id uuid,
  linked_task_id uuid REFERENCES public.project_tasks(id),
  memo text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  action public.approval_action_type NOT NULL,
  from_status public.sales_order_status NOT NULL,
  to_status public.sales_order_status NOT NULL,
  actor_id uuid NOT NULL,
  delegated_from uuid,
  approval_level integer DEFAULT 0,
  comments text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_order_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  -- NOTE: We intentionally do NOT FK to an invoices header table here.
  -- This codebase currently represents "invoices" via transaction tables, and
  -- some deployments do not have a public.invoices table at all.
  invoice_id uuid NOT NULL,
  invoiced_amount numeric(18,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_orders_org ON public.sales_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_entity ON public.sales_orders(entity_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_subsidiary ON public.sales_orders(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON public.sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_order_number ON public.sales_orders(organization_id, order_number);

CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sales_order ON public.sales_order_lines(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sales_order_line ON public.sales_order_lines(sales_order_id, line_number);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_item ON public.sales_order_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_linked_task ON public.sales_order_lines(linked_task_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_approval_history_sales_order
  ON public.sales_order_approval_history(sales_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_order_invoices_sales_order
  ON public.sales_order_invoices(sales_order_id, created_at DESC);

-- =============================================================================
-- HELPERS + RLS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_sales_order_organization(p_sales_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = p_sales_order_id
      AND so.organization_id = public.get_current_organization_id()
  );
$$;

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sales_order_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_approval_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sales_order_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_invoices FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_orders'
      AND policyname = 'org_isolation_select_sales_orders'
  ) THEN
    CREATE POLICY org_isolation_select_sales_orders
      ON public.sales_orders FOR SELECT
      USING (organization_id = public.get_current_organization_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_orders'
      AND policyname = 'org_isolation_insert_sales_orders'
  ) THEN
    CREATE POLICY org_isolation_insert_sales_orders
      ON public.sales_orders FOR INSERT
      WITH CHECK (organization_id = public.get_current_organization_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_orders'
      AND policyname = 'org_isolation_update_sales_orders'
  ) THEN
    CREATE POLICY org_isolation_update_sales_orders
      ON public.sales_orders FOR UPDATE
      USING (organization_id = public.get_current_organization_id())
      WITH CHECK (organization_id = public.get_current_organization_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_orders'
      AND policyname = 'org_isolation_delete_sales_orders'
  ) THEN
    CREATE POLICY org_isolation_delete_sales_orders
      ON public.sales_orders FOR DELETE
      USING (organization_id = public.get_current_organization_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_lines'
      AND policyname = 'org_isolation_select_sales_order_lines'
  ) THEN
    CREATE POLICY org_isolation_select_sales_order_lines
      ON public.sales_order_lines FOR SELECT
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_lines'
      AND policyname = 'org_isolation_insert_sales_order_lines'
  ) THEN
    CREATE POLICY org_isolation_insert_sales_order_lines
      ON public.sales_order_lines FOR INSERT
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_lines'
      AND policyname = 'org_isolation_update_sales_order_lines'
  ) THEN
    CREATE POLICY org_isolation_update_sales_order_lines
      ON public.sales_order_lines FOR UPDATE
      USING (public.check_sales_order_organization(sales_order_id))
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_lines'
      AND policyname = 'org_isolation_delete_sales_order_lines'
  ) THEN
    CREATE POLICY org_isolation_delete_sales_order_lines
      ON public.sales_order_lines FOR DELETE
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_approval_history'
      AND policyname = 'org_isolation_select_sales_order_approval_history'
  ) THEN
    CREATE POLICY org_isolation_select_sales_order_approval_history
      ON public.sales_order_approval_history FOR SELECT
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_approval_history'
      AND policyname = 'org_isolation_insert_sales_order_approval_history'
  ) THEN
    CREATE POLICY org_isolation_insert_sales_order_approval_history
      ON public.sales_order_approval_history FOR INSERT
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_approval_history'
      AND policyname = 'org_isolation_update_sales_order_approval_history'
  ) THEN
    CREATE POLICY org_isolation_update_sales_order_approval_history
      ON public.sales_order_approval_history FOR UPDATE
      USING (public.check_sales_order_organization(sales_order_id))
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_approval_history'
      AND policyname = 'org_isolation_delete_sales_order_approval_history'
  ) THEN
    CREATE POLICY org_isolation_delete_sales_order_approval_history
      ON public.sales_order_approval_history FOR DELETE
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_invoices'
      AND policyname = 'org_isolation_select_sales_order_invoices'
  ) THEN
    CREATE POLICY org_isolation_select_sales_order_invoices
      ON public.sales_order_invoices FOR SELECT
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_invoices'
      AND policyname = 'org_isolation_insert_sales_order_invoices'
  ) THEN
    CREATE POLICY org_isolation_insert_sales_order_invoices
      ON public.sales_order_invoices FOR INSERT
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_invoices'
      AND policyname = 'org_isolation_update_sales_order_invoices'
  ) THEN
    CREATE POLICY org_isolation_update_sales_order_invoices
      ON public.sales_order_invoices FOR UPDATE
      USING (public.check_sales_order_organization(sales_order_id))
      WITH CHECK (public.check_sales_order_organization(sales_order_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales_order_invoices'
      AND policyname = 'org_isolation_delete_sales_order_invoices'
  ) THEN
    CREATE POLICY org_isolation_delete_sales_order_invoices
      ON public.sales_order_invoices FOR DELETE
      USING (public.check_sales_order_organization(sales_order_id));
  END IF;
END $$;

-- =============================================================================
-- PRIVILEGES
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO glapiuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_lines TO glapiuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_approval_history TO glapiuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_invoices TO glapiuser;
