-- Migration: Accounting Lists System
-- Created: 2026-01-23

-- Create enums
DO $$ BEGIN
    CREATE TYPE "public"."accounting_list_type" AS ENUM('payment_terms', 'payment_method', 'charge_type');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."due_date_type" AS ENUM('net_days', 'day_of_month', 'end_of_month');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."accounting_payment_method_type" AS ENUM('cash', 'check', 'credit_card', 'debit_card', 'ach', 'wire_transfer', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."charge_category" AS ENUM('service', 'product', 'shipping', 'tax', 'discount', 'fee', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create base table: accounting_lists
CREATE TABLE IF NOT EXISTS "accounting_lists" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
    "list_type" "accounting_list_type" NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique index for org + list type + code
CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounting_lists_org_type_code" ON "accounting_lists" ("organization_id", "list_type", "code");

-- Create index for filtering by organization and type
CREATE INDEX IF NOT EXISTS "idx_accounting_lists_org_type" ON "accounting_lists" ("organization_id", "list_type");

-- Create index for finding default
CREATE INDEX IF NOT EXISTS "idx_accounting_lists_default" ON "accounting_lists" ("organization_id", "list_type", "is_default");

-- Create extension table: payment_terms_details
CREATE TABLE IF NOT EXISTS "payment_terms_details" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "accounting_list_id" uuid NOT NULL REFERENCES "accounting_lists"("id") ON DELETE CASCADE UNIQUE,
    "due_date_type" "due_date_type" DEFAULT 'net_days' NOT NULL,
    "net_days" integer DEFAULT 30 NOT NULL,
    "day_of_month" integer,
    "discount_days" integer DEFAULT 0 NOT NULL,
    "discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_terms_details_accounting_list" ON "payment_terms_details" ("accounting_list_id");

-- Create extension table: payment_methods_details
CREATE TABLE IF NOT EXISTS "payment_methods_details" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "accounting_list_id" uuid NOT NULL REFERENCES "accounting_lists"("id") ON DELETE CASCADE UNIQUE,
    "method_type" "accounting_payment_method_type" NOT NULL,
    "deposit_account_id" uuid REFERENCES "accounts"("id"),
    "requires_approval" boolean DEFAULT false NOT NULL,
    "processing_fee_percent" numeric(5, 4),
    "processing_fee_fixed" numeric(10, 2),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_methods_details_accounting_list" ON "payment_methods_details" ("accounting_list_id");
CREATE INDEX IF NOT EXISTS "idx_payment_methods_details_method_type" ON "payment_methods_details" ("method_type");

-- Create extension table: charge_types_details
CREATE TABLE IF NOT EXISTS "charge_types_details" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "accounting_list_id" uuid NOT NULL REFERENCES "accounting_lists"("id") ON DELETE CASCADE UNIQUE,
    "charge_category" "charge_category" NOT NULL,
    "income_account_id" uuid REFERENCES "accounts"("id"),
    "expense_account_id" uuid REFERENCES "accounts"("id"),
    "is_taxable" boolean DEFAULT true NOT NULL,
    "default_tax_code_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_charge_types_details_accounting_list" ON "charge_types_details" ("accounting_list_id");
CREATE INDEX IF NOT EXISTS "idx_charge_types_details_category" ON "charge_types_details" ("charge_category");

-- Create assignment table: customer_accounting_lists
CREATE TABLE IF NOT EXISTS "customer_accounting_lists" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE CASCADE,
    "accounting_list_id" uuid NOT NULL REFERENCES "accounting_lists"("id") ON DELETE CASCADE,
    "priority" integer DEFAULT 1 NOT NULL,
    "effective_date" date,
    "expiration_date" date,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Each customer can only have one assignment to a specific accounting list
CREATE UNIQUE INDEX IF NOT EXISTS "idx_customer_accounting_lists_unique" ON "customer_accounting_lists" ("customer_id", "accounting_list_id");

-- Index for finding customer's accounting lists
CREATE INDEX IF NOT EXISTS "idx_customer_accounting_lists_customer" ON "customer_accounting_lists" ("customer_id");

-- Index for date-based lookups
CREATE INDEX IF NOT EXISTS "idx_customer_accounting_lists_dates" ON "customer_accounting_lists" ("effective_date", "expiration_date");
