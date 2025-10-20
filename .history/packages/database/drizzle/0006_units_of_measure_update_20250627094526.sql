-- Rename conversion_factor column to base_conversion_factor
ALTER TABLE "units_of_measure" RENAME COLUMN "conversion_factor" TO "base_conversion_factor";

-- Add decimal_places column
ALTER TABLE "units_of_measure" ADD COLUMN "decimal_places" integer DEFAULT 2;