-- Migration: Stripe billing fields
-- Created: 2026-01-24
-- Description: Add Stripe customer and default payment method fields to organizations

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_default_payment_method_id" varchar(255);

CREATE INDEX IF NOT EXISTS "organizations_stripe_customer_id_idx"
  ON "organizations" ("stripe_customer_id");
