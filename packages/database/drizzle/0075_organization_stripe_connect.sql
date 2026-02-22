-- 0075_organization_stripe_connect.sql
-- Adds Stripe Connect organization-level status fields for account onboarding and readiness.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stripe_connect_status') THEN
    CREATE TYPE stripe_connect_status AS ENUM (
      'not_connected',
      'pending',
      'active',
      'restricted'
    );
  END IF;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_connect_status stripe_connect_status NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS organizations_stripe_account_id_idx
  ON organizations(stripe_account_id);

CREATE INDEX IF NOT EXISTS organizations_stripe_connect_status_idx
  ON organizations(stripe_connect_status);
