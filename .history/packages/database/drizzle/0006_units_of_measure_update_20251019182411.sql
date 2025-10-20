DO $$
  BEGIN
    -- rename only if the old column is still present
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'units_of_measure'
        AND column_name  = 'conversion_factor'
    ) THEN
      ALTER TABLE "units_of_measure"
        RENAME COLUMN "conversion_factor" TO "base_conversion_factor";
    END IF;
  END $$;

  ALTER TABLE "units_of_measure"
    ADD COLUMN IF NOT EXISTS "decimal_places" integer DEFAULT 2;