-- Add missing status tracking columns to accounting_periods table
-- These columns support the period lifecycle: OPEN -> SOFT_CLOSED -> CLOSED -> LOCKED

-- Add soft close tracking columns
ALTER TABLE "accounting_periods" ADD COLUMN "soft_closed_by" uuid;
ALTER TABLE "accounting_periods" ADD COLUMN "soft_closed_date" timestamp with time zone;

-- Add lock tracking columns
ALTER TABLE "accounting_periods" ADD COLUMN "locked_by" uuid;
ALTER TABLE "accounting_periods" ADD COLUMN "locked_date" timestamp with time zone;

-- Add audit tracking columns
ALTER TABLE "accounting_periods" ADD COLUMN "created_by" uuid;
ALTER TABLE "accounting_periods" ADD COLUMN "modified_by" uuid;
ALTER TABLE "accounting_periods" ADD COLUMN "modified_date" timestamp with time zone;
