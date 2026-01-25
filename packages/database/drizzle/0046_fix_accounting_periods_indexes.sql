-- Fix accounting_periods indexes to allow multiple subsidiaries/fiscal years
-- The original migration created these as UNIQUE, which prevents creating
-- overlapping periods across subsidiaries or organizations.
--
-- This migration drops the unique indexes and recreates them as non-unique
-- to match the TypeScript schema in src/db/schema/accounting-periods.ts.

DO $$
BEGIN
  -- Drop existing unique indexes if they exist
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_periods_status'
  ) THEN
    DROP INDEX IF EXISTS "idx_periods_status";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_periods_date_range'
  ) THEN
    DROP INDEX IF EXISTS "idx_periods_date_range";
  END IF;

  -- Recreate as non-unique indexes (for query performance only)
  CREATE INDEX IF NOT EXISTS "idx_periods_status"
    ON "accounting_periods" USING btree ("status", "start_date");

  CREATE INDEX IF NOT EXISTS "idx_periods_date_range"
    ON "accounting_periods" USING btree ("start_date", "end_date");
END $$;
