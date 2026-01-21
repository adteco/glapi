-- Subscription Versioning for Amendment Tracking
-- Implements audit trail for subscription lifecycle changes

-- Enum for version type
DO $$ BEGIN
  CREATE TYPE subscription_version_type AS ENUM (
    'creation',
    'amendment',
    'status_change',
    'renewal',
    'cancellation',
    'reactivation',
    'price_change',
    'term_extension',
    'item_modification'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum for version source
DO $$ BEGIN
  CREATE TYPE subscription_version_source AS ENUM (
    'user',
    'system',
    'api',
    'workflow',
    'migration'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Subscription versions table
CREATE TABLE IF NOT EXISTS subscription_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),

  -- Version tracking
  version_number INTEGER NOT NULL,
  version_type subscription_version_type NOT NULL,
  version_source subscription_version_source NOT NULL DEFAULT 'user',

  -- State at this version
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,

  -- Full snapshot
  subscription_snapshot JSONB NOT NULL,
  items_snapshot JSONB,

  -- Change details
  changed_fields JSONB,
  change_summary TEXT,
  change_reason TEXT,

  -- Financial impact
  previous_contract_value DECIMAL(12, 2),
  new_contract_value DECIMAL(12, 2),
  contract_value_delta DECIMAL(12, 2),

  -- Effective dates
  effective_date DATE NOT NULL,

  -- Audit fields
  created_by UUID,
  created_by_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB,

  -- Unique constraint: one version number per subscription
  UNIQUE(subscription_id, version_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscription_versions_subscription_id
  ON subscription_versions(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_versions_organization_id
  ON subscription_versions(organization_id);

CREATE INDEX IF NOT EXISTS idx_subscription_versions_version_type
  ON subscription_versions(version_type);

CREATE INDEX IF NOT EXISTS idx_subscription_versions_created_at
  ON subscription_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_versions_effective_date
  ON subscription_versions(effective_date);

-- Add current_version field to subscriptions table if not exists
DO $$ BEGIN
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Comment on table
COMMENT ON TABLE subscription_versions IS 'Tracks all changes to subscriptions with full audit trail for ASC 606 compliance';
