CREATE TYPE "subscription_version_type" AS ENUM (
  'creation',
  'activation',
  'amendment',
  'modification',
  'suspension',
  'resumption',
  'cancellation',
  'renewal'
);

CREATE TYPE "subscription_version_source" AS ENUM (
  'system',
  'user',
  'integration',
  'import'
);

CREATE TABLE "subscription_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES organizations(id),
  "subscription_id" uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "version_type" subscription_version_type NOT NULL,
  "version_source" subscription_version_source NOT NULL DEFAULT 'system',
  "change_summary" text,
  "change_reason" text,
  "effective_date" timestamptz NOT NULL DEFAULT now(),
  "modification_id" text REFERENCES contract_modifications(id),
  "metadata" jsonb,
  "subscription_snapshot" jsonb NOT NULL,
  "items_snapshot" jsonb NOT NULL,
  "created_by" uuid REFERENCES users(id),
  "previous_version_id" uuid REFERENCES subscription_versions(id),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscription_versions_subscription_version_number_idx
  ON subscription_versions (subscription_id, version_number);

CREATE INDEX subscription_versions_subscription_idx
  ON subscription_versions (subscription_id);

CREATE INDEX subscription_versions_modification_idx
  ON subscription_versions (modification_id);
