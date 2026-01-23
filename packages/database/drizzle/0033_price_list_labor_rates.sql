-- Price List Labor Rates Migration
-- Adds labor/hourly billing rates to the price lists system

CREATE TABLE IF NOT EXISTS "price_list_labor_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "price_list_id" uuid NOT NULL REFERENCES "price_lists"("id") ON DELETE CASCADE,

  -- Rate targeting (all optional - more specific = higher priority)
  "employee_id" uuid REFERENCES "entities"("id") ON DELETE SET NULL,
  "labor_role" text,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "cost_code_id" uuid REFERENCES "project_cost_codes"("id") ON DELETE SET NULL,

  -- Rate details
  "labor_rate" decimal(15, 4) NOT NULL,
  "burden_rate" decimal(15, 4) NOT NULL DEFAULT '0',
  "billing_rate" decimal(15, 4) NOT NULL,

  -- Overtime multipliers
  "overtime_multiplier" decimal(4, 2) NOT NULL DEFAULT '1.5',
  "double_time_multiplier" decimal(4, 2) NOT NULL DEFAULT '2.0',

  -- Selection priority and date range
  "priority" integer NOT NULL DEFAULT 0,
  "effective_date" date NOT NULL,
  "expiration_date" date,
  "description" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_pllr_lookup" ON "price_list_labor_rates" ("price_list_id", "effective_date");
CREATE INDEX IF NOT EXISTS "idx_pllr_role" ON "price_list_labor_rates" ("price_list_id", "labor_role");
CREATE INDEX IF NOT EXISTS "idx_pllr_employee" ON "price_list_labor_rates" ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_pllr_project" ON "price_list_labor_rates" ("project_id");

-- Add comment explaining the table purpose
COMMENT ON TABLE "price_list_labor_rates" IS 'Stores labor/hourly billing rates for price lists, supporting rate cards with varying rates based on employee, role, project, and cost code';
COMMENT ON COLUMN "price_list_labor_rates"."labor_rate" IS 'The internal labor cost rate (what we pay)';
COMMENT ON COLUMN "price_list_labor_rates"."burden_rate" IS 'Additional burden/overhead costs (benefits, taxes, etc.)';
COMMENT ON COLUMN "price_list_labor_rates"."billing_rate" IS 'The rate charged to customers';
COMMENT ON COLUMN "price_list_labor_rates"."priority" IS 'Higher priority rates take precedence (0 is lowest). Used when multiple rates match.';
