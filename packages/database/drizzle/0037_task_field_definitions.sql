-- Migration: Task Field Definitions
-- Created: 2026-01-23
-- Description: Schema for custom task field definitions per organization

-- Create task field type enum
DO $$ BEGIN
    CREATE TYPE "public"."task_field_type" AS ENUM(
        'text',
        'textarea',
        'number',
        'currency',
        'date',
        'datetime',
        'boolean',
        'select',
        'multiselect',
        'user',
        'url',
        'email',
        'phone'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create task_field_definitions table
CREATE TABLE IF NOT EXISTS "task_field_definitions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
    "field_key" varchar(100) NOT NULL,
    "field_label" varchar(255) NOT NULL,
    "field_type" "task_field_type" NOT NULL,
    "field_options" jsonb DEFAULT '{}',
    "entity_type" varchar(50),
    "is_required" boolean DEFAULT false NOT NULL,
    "default_value" jsonb,
    "placeholder" varchar(255),
    "help_text" text,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" uuid REFERENCES "entities"("id"),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Unique constraint for (organization_id, field_key) when entity_type IS NULL
-- This ensures field_key is unique within an org for global fields
CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_field_definitions_org_key_entity"
    ON "task_field_definitions" ("organization_id", "field_key")
    WHERE "entity_type" IS NULL;

-- Unique constraint for (organization_id, field_key, entity_type) when entity_type IS NOT NULL
-- This ensures field_key is unique within an org for each entity type
CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_field_definitions_org_key_entity_not_null"
    ON "task_field_definitions" ("organization_id", "field_key", "entity_type")
    WHERE "entity_type" IS NOT NULL;

-- Index on organization_id for filtering
CREATE INDEX IF NOT EXISTS "idx_task_field_definitions_org"
    ON "task_field_definitions" ("organization_id");

-- Index on (organization_id, entity_type) for filtering by entity type
CREATE INDEX IF NOT EXISTS "idx_task_field_definitions_org_entity_type"
    ON "task_field_definitions" ("organization_id", "entity_type");

-- Index on (organization_id, is_active) for filtering active fields
CREATE INDEX IF NOT EXISTS "idx_task_field_definitions_org_active"
    ON "task_field_definitions" ("organization_id", "is_active");

-- Index for ordering
CREATE INDEX IF NOT EXISTS "idx_task_field_definitions_display_order"
    ON "task_field_definitions" ("organization_id", "display_order");
