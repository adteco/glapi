-- Event Store Foundation Migration (Fixed)
-- Fixes the type mismatch: organization_id is TEXT (Clerk org IDs like "org_xxx")
-- Cannot have FK to organizations.id which is UUID, so FK removed

-- Create event category enum
DO $$ BEGIN
    CREATE TYPE "event_category_enum" AS ENUM (
        'TRANSACTION',
        'APPROVAL',
        'PAYMENT',
        'ACCOUNTING',
        'SUBSCRIPTION',
        'PROJECT',
        'CONTRACT',
        'INVENTORY',
        'SYSTEM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create outbox status enum
DO $$ BEGIN
    CREATE TYPE "outbox_status_enum" AS ENUM (
        'PENDING',
        'PUBLISHED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create sequence for global ordering
CREATE SEQUENCE IF NOT EXISTS event_store_global_sequence_seq;

-- ============================================================================
-- EVENT STORE TABLE
-- Core immutable log of all business events
-- ============================================================================
CREATE TABLE IF NOT EXISTS "event_store" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_type" text NOT NULL,
    "event_category" "event_category_enum" NOT NULL,
    "aggregate_id" text NOT NULL,
    "aggregate_type" text NOT NULL,
    "event_version" bigint NOT NULL,
    "global_sequence" bigint NOT NULL UNIQUE DEFAULT nextval('event_store_global_sequence_seq'),
    "event_data" jsonb NOT NULL,
    "metadata" jsonb,
    "event_timestamp" timestamp(6) with time zone NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
    "user_id" text,
    "session_id" text,
    "correlation_id" uuid NOT NULL,
    "causation_id" uuid,
    "organization_id" text NOT NULL
);

-- Event store indexes
CREATE INDEX IF NOT EXISTS "event_store_aggregate_idx"
    ON "event_store" ("aggregate_type", "aggregate_id", "event_version");
CREATE INDEX IF NOT EXISTS "event_store_correlation_idx"
    ON "event_store" ("correlation_id");
CREATE INDEX IF NOT EXISTS "event_store_timestamp_idx"
    ON "event_store" ("event_timestamp");
CREATE INDEX IF NOT EXISTS "event_store_global_sequence_idx"
    ON "event_store" ("global_sequence");
CREATE INDEX IF NOT EXISTS "event_store_event_type_idx"
    ON "event_store" ("event_type", "event_timestamp");
CREATE INDEX IF NOT EXISTS "event_store_organization_idx"
    ON "event_store" ("organization_id", "event_timestamp");

-- ============================================================================
-- EVENT OUTBOX TABLE
-- Transactional outbox pattern for reliable event publishing
-- ============================================================================
CREATE TABLE IF NOT EXISTS "event_outbox" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_id" uuid REFERENCES "event_store"("id"),
    "topic" text NOT NULL,
    "partition_key" text,
    "payload" jsonb NOT NULL,
    "status" "outbox_status_enum" DEFAULT 'PENDING' NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
    "published_at" timestamp(6) with time zone,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "error_message" text,
    "organization_id" text NOT NULL
);

-- Event outbox indexes
CREATE INDEX IF NOT EXISTS "event_outbox_status_created_idx"
    ON "event_outbox" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "event_outbox_retry_idx"
    ON "event_outbox" ("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "event_outbox_topic_idx"
    ON "event_outbox" ("topic", "status");
CREATE INDEX IF NOT EXISTS "event_outbox_organization_idx"
    ON "event_outbox" ("organization_id", "status");

-- ============================================================================
-- EVENT PROJECTIONS TABLE
-- Read model state tracking for CQRS pattern
-- ============================================================================
CREATE TABLE IF NOT EXISTS "event_projections" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "projection_name" text NOT NULL,
    "aggregate_id" text NOT NULL,
    "aggregate_type" text NOT NULL,
    "last_event_version" bigint NOT NULL,
    "last_global_sequence" bigint NOT NULL,
    "projection_data" jsonb NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
    "organization_id" text NOT NULL
);

-- Event projections indexes
CREATE UNIQUE INDEX IF NOT EXISTS "event_projections_unique_idx"
    ON "event_projections" ("projection_name", "aggregate_id", "organization_id");
CREATE INDEX IF NOT EXISTS "event_projections_last_sequence_idx"
    ON "event_projections" ("last_global_sequence");
CREATE INDEX IF NOT EXISTS "event_projections_name_idx"
    ON "event_projections" ("projection_name", "organization_id");
CREATE INDEX IF NOT EXISTS "event_projections_aggregate_idx"
    ON "event_projections" ("aggregate_type", "aggregate_id");

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE "event_store" IS 'Immutable event log for event sourcing - stores all business events';
COMMENT ON TABLE "event_outbox" IS 'Transactional outbox for reliable event publishing with retry support';
COMMENT ON TABLE "event_projections" IS 'Read model projections built from event streams for CQRS pattern';

COMMENT ON COLUMN "event_store"."global_sequence" IS 'Monotonically increasing sequence for global event ordering';
COMMENT ON COLUMN "event_store"."event_version" IS 'Version within aggregate for optimistic concurrency control';
COMMENT ON COLUMN "event_store"."correlation_id" IS 'Groups related events across a single request/operation';
COMMENT ON COLUMN "event_store"."causation_id" IS 'References the parent event that caused this event';

COMMENT ON COLUMN "event_outbox"."partition_key" IS 'Used for ordered processing within a partition';
COMMENT ON COLUMN "event_outbox"."next_retry_at" IS 'Timestamp for exponential backoff retry scheduling';

COMMENT ON COLUMN "event_projections"."last_global_sequence" IS 'Checkpoint for resuming projection processing';

-- ============================================================================
-- RLS POLICIES for event tables
-- ============================================================================
ALTER TABLE "event_store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_projections" ENABLE ROW LEVEL SECURITY;

-- Event Store RLS (cast UUID to TEXT for comparison)
DO $$
BEGIN
  CREATE POLICY "org_isolation_select_event_store" ON event_store
    FOR SELECT USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_event_store" ON event_store
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event Outbox RLS
DO $$
BEGIN
  CREATE POLICY "org_isolation_select_event_outbox" ON event_outbox
    FOR SELECT USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_event_outbox" ON event_outbox
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_event_outbox" ON event_outbox
    FOR UPDATE USING (organization_id = get_current_organization_id()::text)
    WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event Projections RLS
DO $$
BEGIN
  CREATE POLICY "org_isolation_select_event_projections" ON event_projections
    FOR SELECT USING (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_insert_event_projections" ON event_projections
    FOR INSERT WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "org_isolation_update_event_projections" ON event_projections
    FOR UPDATE USING (organization_id = get_current_organization_id()::text)
    WITH CHECK (organization_id = get_current_organization_id()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
