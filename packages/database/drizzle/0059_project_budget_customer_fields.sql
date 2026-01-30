-- Migration: Add budget and customer fields to projects
-- Created: 2026-01-30
-- Description: Add budget_revenue, budget_cost, and customer_id fields to projects table

-- Add customer_id foreign key to entities table
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_entities_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add budget fields
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "budget_revenue" numeric(18, 4);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "budget_cost" numeric(18, 4);

-- Add index for customer lookups
CREATE INDEX IF NOT EXISTS "idx_projects_customer" ON "projects" ("customer_id");
