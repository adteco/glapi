ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "default_ssp_amount" numeric(18,2),
  ADD COLUMN IF NOT EXISTS "revenue_behavior" text;
