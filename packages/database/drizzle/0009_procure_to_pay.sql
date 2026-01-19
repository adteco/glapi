-- Procure-to-Pay (P2P) Migration
-- glapi-1y4: Implements Purchase Orders, Receipts, Vendor Bills, and Bill Payments
-- This enables full P2P lifecycle with 3-way match validation

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Add PROCUREMENT to event_category_enum
DO $$ BEGIN
    ALTER TYPE "event_category_enum" ADD VALUE IF NOT EXISTS 'PROCUREMENT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Purchase Order Status
DO $$ BEGIN
    CREATE TYPE "purchase_order_status" AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'BILLED',
        'CLOSED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Receipt Status
DO $$ BEGIN
    CREATE TYPE "receipt_status" AS ENUM (
        'DRAFT',
        'POSTED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- PO Approval Action Type
DO $$ BEGIN
    CREATE TYPE "po_approval_action_type" AS ENUM (
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'RETURNED',
        'ESCALATED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vendor Bill Status
DO $$ BEGIN
    CREATE TYPE "vendor_bill_status" AS ENUM (
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'PARTIALLY_PAID',
        'PAID',
        'VOIDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bill Payment Status
DO $$ BEGIN
    CREATE TYPE "bill_payment_status" AS ENUM (
        'DRAFT',
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'VOIDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vendor Payment Method
DO $$ BEGIN
    CREATE TYPE "vendor_payment_method" AS ENUM (
        'CHECK',
        'ACH',
        'WIRE',
        'CREDIT_CARD',
        'VIRTUAL_CARD',
        'CASH',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Three-Way Match Status
DO $$ BEGIN
    CREATE TYPE "three_way_match_status" AS ENUM (
        'NOT_REQUIRED',
        'PENDING',
        'MATCHED',
        'EXCEPTION',
        'OVERRIDE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bill Approval Action Type
DO $$ BEGIN
    CREATE TYPE "bill_approval_action_type" AS ENUM (
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'RETURNED',
        'ESCALATED',
        'VOIDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PURCHASE ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
    "po_number" varchar(50) NOT NULL,
    "vendor_id" uuid NOT NULL REFERENCES "entities"("id"),
    "vendor_name" varchar(255),
    "order_date" date NOT NULL,
    "expected_delivery_date" date,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "subtotal" decimal(15, 2) NOT NULL DEFAULT 0,
    "tax_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "shipping_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "total_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "received_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "billed_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "ship_to_location_id" uuid REFERENCES "locations"("id"),
    "shipping_address" text,
    "shipping_method" varchar(100),
    "payment_terms" varchar(100),
    "memo" text,
    "internal_notes" text,
    "current_approver_id" uuid,
    "approved_at" timestamp with time zone,
    "approved_by" uuid,
    "currency_code" varchar(3) DEFAULT 'USD',
    "exchange_rate" decimal(15, 6) DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "closed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" text
);

-- Purchase Orders indexes
CREATE INDEX IF NOT EXISTS "po_organization_idx" ON "purchase_orders" ("organization_id");
CREATE INDEX IF NOT EXISTS "po_subsidiary_idx" ON "purchase_orders" ("subsidiary_id");
CREATE INDEX IF NOT EXISTS "po_vendor_idx" ON "purchase_orders" ("vendor_id");
CREATE INDEX IF NOT EXISTS "po_status_idx" ON "purchase_orders" ("status");
CREATE INDEX IF NOT EXISTS "po_order_date_idx" ON "purchase_orders" ("order_date");
CREATE INDEX IF NOT EXISTS "po_po_number_idx" ON "purchase_orders" ("po_number");

-- ============================================================================
-- PURCHASE ORDER LINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
    "line_number" integer NOT NULL,
    "item_id" uuid REFERENCES "items"("id"),
    "item_name" varchar(255) NOT NULL,
    "item_description" text,
    "quantity" decimal(15, 4) NOT NULL,
    "unit_of_measure" varchar(50),
    "unit_price" decimal(15, 4) NOT NULL,
    "amount" decimal(15, 2) NOT NULL,
    "tax_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "quantity_received" decimal(15, 4) NOT NULL DEFAULT 0,
    "quantity_billed" decimal(15, 4) NOT NULL DEFAULT 0,
    "account_id" uuid REFERENCES "accounts"("id"),
    "department_id" uuid REFERENCES "departments"("id"),
    "location_id" uuid REFERENCES "locations"("id"),
    "class_id" uuid REFERENCES "classes"("id"),
    "project_id" uuid REFERENCES "projects"("id"),
    "expected_delivery_date" date,
    "memo" text,
    "is_closed" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Purchase Order Lines indexes
CREATE INDEX IF NOT EXISTS "po_line_po_idx" ON "purchase_order_lines" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "po_line_item_idx" ON "purchase_order_lines" ("item_id");
CREATE INDEX IF NOT EXISTS "po_line_number_idx" ON "purchase_order_lines" ("purchase_order_id", "line_number");

-- ============================================================================
-- PURCHASE ORDER RECEIPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_order_receipts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
    "receipt_number" varchar(50) NOT NULL,
    "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id"),
    "vendor_id" uuid NOT NULL REFERENCES "entities"("id"),
    "receipt_date" date NOT NULL,
    "status" "receipt_status" NOT NULL DEFAULT 'DRAFT',
    "location_id" uuid REFERENCES "locations"("id"),
    "memo" text,
    "shipping_ref" varchar(100),
    "carrier_name" varchar(100),
    "total_received_value" decimal(15, 2) NOT NULL DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "posted_at" timestamp with time zone,
    "posted_by" uuid,
    "cancelled_at" timestamp with time zone
);

-- Purchase Order Receipts indexes
CREATE INDEX IF NOT EXISTS "receipt_organization_idx" ON "purchase_order_receipts" ("organization_id");
CREATE INDEX IF NOT EXISTS "receipt_po_idx" ON "purchase_order_receipts" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "receipt_vendor_idx" ON "purchase_order_receipts" ("vendor_id");
CREATE INDEX IF NOT EXISTS "receipt_date_idx" ON "purchase_order_receipts" ("receipt_date");
CREATE INDEX IF NOT EXISTS "receipt_status_idx" ON "purchase_order_receipts" ("status");

-- ============================================================================
-- PURCHASE ORDER RECEIPT LINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_order_receipt_lines" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "receipt_id" uuid NOT NULL REFERENCES "purchase_order_receipts"("id") ON DELETE CASCADE,
    "purchase_order_line_id" uuid NOT NULL REFERENCES "purchase_order_lines"("id"),
    "line_number" integer NOT NULL,
    "item_id" uuid REFERENCES "items"("id"),
    "item_name" varchar(255) NOT NULL,
    "quantity_received" decimal(15, 4) NOT NULL,
    "unit_of_measure" varchar(50),
    "unit_cost" decimal(15, 4) NOT NULL,
    "received_value" decimal(15, 2) NOT NULL,
    "quantity_accepted" decimal(15, 4),
    "quantity_rejected" decimal(15, 4),
    "rejection_reason" text,
    "bin_location" varchar(100),
    "lot_number" varchar(100),
    "serial_numbers" text,
    "memo" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Purchase Order Receipt Lines indexes
CREATE INDEX IF NOT EXISTS "receipt_line_receipt_idx" ON "purchase_order_receipt_lines" ("receipt_id");
CREATE INDEX IF NOT EXISTS "receipt_line_po_line_idx" ON "purchase_order_receipt_lines" ("purchase_order_line_id");
CREATE INDEX IF NOT EXISTS "receipt_line_item_idx" ON "purchase_order_receipt_lines" ("item_id");

-- ============================================================================
-- PURCHASE ORDER APPROVAL HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_order_approval_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
    "action" "po_approval_action_type" NOT NULL,
    "performed_by" uuid NOT NULL,
    "performed_by_name" varchar(255),
    "from_status" "purchase_order_status",
    "to_status" "purchase_order_status" NOT NULL,
    "comments" text,
    "performed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Purchase Order Approval History indexes
CREATE INDEX IF NOT EXISTS "po_approval_po_idx" ON "purchase_order_approval_history" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "po_approval_performed_by_idx" ON "purchase_order_approval_history" ("performed_by");
CREATE INDEX IF NOT EXISTS "po_approval_action_idx" ON "purchase_order_approval_history" ("action");

-- ============================================================================
-- VENDOR BILLS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "vendor_bills" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
    "bill_number" varchar(50) NOT NULL,
    "vendor_invoice_number" varchar(100),
    "vendor_id" uuid NOT NULL REFERENCES "entities"("id"),
    "vendor_name" varchar(255),
    "purchase_order_id" uuid REFERENCES "purchase_orders"("id"),
    "bill_date" date NOT NULL,
    "due_date" date NOT NULL,
    "received_date" date,
    "status" "vendor_bill_status" NOT NULL DEFAULT 'DRAFT',
    "three_way_match_status" "three_way_match_status" NOT NULL DEFAULT 'NOT_REQUIRED',
    "match_variance_amount" decimal(15, 2),
    "match_override_reason" text,
    "match_override_by" uuid,
    "match_override_at" timestamp with time zone,
    "subtotal" decimal(15, 2) NOT NULL DEFAULT 0,
    "tax_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "shipping_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "total_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "paid_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "balance_due" decimal(15, 2) NOT NULL DEFAULT 0,
    "discount_date" date,
    "discount_percent" decimal(5, 2),
    "discount_amount" decimal(15, 2),
    "discount_taken" decimal(15, 2) NOT NULL DEFAULT 0,
    "ap_account_id" uuid REFERENCES "accounts"("id"),
    "payment_terms" varchar(100),
    "memo" text,
    "internal_notes" text,
    "current_approver_id" uuid,
    "approved_at" timestamp with time zone,
    "approved_by" uuid,
    "currency_code" varchar(3) DEFAULT 'USD',
    "exchange_rate" decimal(15, 6) DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "voided_at" timestamp with time zone,
    "voided_by" uuid,
    "void_reason" text
);

-- Vendor Bills indexes
CREATE INDEX IF NOT EXISTS "vb_organization_idx" ON "vendor_bills" ("organization_id");
CREATE INDEX IF NOT EXISTS "vb_subsidiary_idx" ON "vendor_bills" ("subsidiary_id");
CREATE INDEX IF NOT EXISTS "vb_vendor_idx" ON "vendor_bills" ("vendor_id");
CREATE INDEX IF NOT EXISTS "vb_status_idx" ON "vendor_bills" ("status");
CREATE INDEX IF NOT EXISTS "vb_bill_date_idx" ON "vendor_bills" ("bill_date");
CREATE INDEX IF NOT EXISTS "vb_due_date_idx" ON "vendor_bills" ("due_date");
CREATE INDEX IF NOT EXISTS "vb_po_idx" ON "vendor_bills" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "vb_match_status_idx" ON "vendor_bills" ("three_way_match_status");

-- ============================================================================
-- VENDOR BILL LINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "vendor_bill_lines" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "vendor_bill_id" uuid NOT NULL REFERENCES "vendor_bills"("id") ON DELETE CASCADE,
    "line_number" integer NOT NULL,
    "purchase_order_line_id" uuid REFERENCES "purchase_order_lines"("id"),
    "receipt_line_id" uuid REFERENCES "purchase_order_receipt_lines"("id"),
    "item_id" uuid REFERENCES "items"("id"),
    "item_name" varchar(255) NOT NULL,
    "item_description" text,
    "quantity" decimal(15, 4) NOT NULL,
    "unit_of_measure" varchar(50),
    "unit_price" decimal(15, 4) NOT NULL,
    "amount" decimal(15, 2) NOT NULL,
    "tax_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "po_quantity" decimal(15, 4),
    "po_unit_price" decimal(15, 4),
    "received_quantity" decimal(15, 4),
    "quantity_variance" decimal(15, 4),
    "price_variance" decimal(15, 2),
    "match_status" "three_way_match_status" DEFAULT 'NOT_REQUIRED',
    "account_id" uuid REFERENCES "accounts"("id"),
    "department_id" uuid REFERENCES "departments"("id"),
    "location_id" uuid REFERENCES "locations"("id"),
    "class_id" uuid REFERENCES "classes"("id"),
    "project_id" uuid REFERENCES "projects"("id"),
    "memo" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Vendor Bill Lines indexes
CREATE INDEX IF NOT EXISTS "vb_line_bill_idx" ON "vendor_bill_lines" ("vendor_bill_id");
CREATE INDEX IF NOT EXISTS "vb_line_po_line_idx" ON "vendor_bill_lines" ("purchase_order_line_id");
CREATE INDEX IF NOT EXISTS "vb_line_receipt_line_idx" ON "vendor_bill_lines" ("receipt_line_id");
CREATE INDEX IF NOT EXISTS "vb_line_item_idx" ON "vendor_bill_lines" ("item_id");

-- ============================================================================
-- BILL PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "bill_payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
    "payment_number" varchar(50) NOT NULL,
    "vendor_id" uuid NOT NULL REFERENCES "entities"("id"),
    "vendor_name" varchar(255),
    "payment_date" date NOT NULL,
    "payment_method" "vendor_payment_method" NOT NULL,
    "status" "bill_payment_status" NOT NULL DEFAULT 'DRAFT',
    "payment_amount" decimal(15, 2) NOT NULL,
    "applied_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "unapplied_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "discount_taken" decimal(15, 2) NOT NULL DEFAULT 0,
    "bank_account_id" uuid REFERENCES "accounts"("id"),
    "check_number" varchar(50),
    "ach_trace_number" varchar(100),
    "wire_reference" varchar(100),
    "external_ref" varchar(100),
    "payee_name" varchar(255),
    "payee_address" text,
    "memo" text,
    "currency_code" varchar(3) DEFAULT 'USD',
    "exchange_rate" decimal(15, 6) DEFAULT 1,
    "cleared_date" date,
    "cleared_amount" decimal(15, 2),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_by" uuid,
    "voided_at" timestamp with time zone,
    "voided_by" uuid,
    "void_reason" text
);

-- Bill Payments indexes
CREATE INDEX IF NOT EXISTS "bp_organization_idx" ON "bill_payments" ("organization_id");
CREATE INDEX IF NOT EXISTS "bp_subsidiary_idx" ON "bill_payments" ("subsidiary_id");
CREATE INDEX IF NOT EXISTS "bp_vendor_idx" ON "bill_payments" ("vendor_id");
CREATE INDEX IF NOT EXISTS "bp_status_idx" ON "bill_payments" ("status");
CREATE INDEX IF NOT EXISTS "bp_payment_date_idx" ON "bill_payments" ("payment_date");
CREATE INDEX IF NOT EXISTS "bp_check_number_idx" ON "bill_payments" ("check_number");

-- ============================================================================
-- BILL PAYMENT APPLICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "bill_payment_applications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "bill_payment_id" uuid NOT NULL REFERENCES "bill_payments"("id") ON DELETE CASCADE,
    "vendor_bill_id" uuid NOT NULL REFERENCES "vendor_bills"("id"),
    "applied_amount" decimal(15, 2) NOT NULL,
    "discount_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "write_off_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "reversed_at" timestamp with time zone,
    "reversed_by" uuid,
    "reversal_reason" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Bill Payment Applications indexes
CREATE INDEX IF NOT EXISTS "bpa_payment_idx" ON "bill_payment_applications" ("bill_payment_id");
CREATE INDEX IF NOT EXISTS "bpa_bill_idx" ON "bill_payment_applications" ("vendor_bill_id");

-- ============================================================================
-- VENDOR CREDIT MEMOS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "vendor_credit_memos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "subsidiary_id" uuid NOT NULL REFERENCES "subsidiaries"("id"),
    "credit_memo_number" varchar(50) NOT NULL,
    "vendor_credit_number" varchar(100),
    "vendor_id" uuid NOT NULL REFERENCES "entities"("id"),
    "vendor_name" varchar(255),
    "source_type" varchar(50) NOT NULL,
    "source_ref" varchar(100),
    "original_bill_id" uuid REFERENCES "vendor_bills"("id"),
    "credit_date" date NOT NULL,
    "original_amount" decimal(15, 2) NOT NULL,
    "applied_amount" decimal(15, 2) NOT NULL DEFAULT 0,
    "remaining_amount" decimal(15, 2) NOT NULL,
    "status" varchar(50) NOT NULL DEFAULT 'OPEN',
    "memo" text,
    "currency_code" varchar(3) DEFAULT 'USD',
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "voided_at" timestamp with time zone
);

-- Vendor Credit Memos indexes
CREATE INDEX IF NOT EXISTS "vcm_organization_idx" ON "vendor_credit_memos" ("organization_id");
CREATE INDEX IF NOT EXISTS "vcm_vendor_idx" ON "vendor_credit_memos" ("vendor_id");
CREATE INDEX IF NOT EXISTS "vcm_status_idx" ON "vendor_credit_memos" ("status");
CREATE INDEX IF NOT EXISTS "vcm_original_bill_idx" ON "vendor_credit_memos" ("original_bill_id");

-- ============================================================================
-- VENDOR BILL APPROVAL HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "vendor_bill_approval_history" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "vendor_bill_id" uuid NOT NULL REFERENCES "vendor_bills"("id") ON DELETE CASCADE,
    "action" "bill_approval_action_type" NOT NULL,
    "performed_by" uuid NOT NULL,
    "performed_by_name" varchar(255),
    "from_status" "vendor_bill_status",
    "to_status" "vendor_bill_status" NOT NULL,
    "comments" text,
    "performed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Vendor Bill Approval History indexes
CREATE INDEX IF NOT EXISTS "vb_approval_bill_idx" ON "vendor_bill_approval_history" ("vendor_bill_id");
CREATE INDEX IF NOT EXISTS "vb_approval_performed_by_idx" ON "vendor_bill_approval_history" ("performed_by");
CREATE INDEX IF NOT EXISTS "vb_approval_action_idx" ON "vendor_bill_approval_history" ("action");

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE "purchase_orders" IS 'Purchase orders to vendors with approval workflow';
COMMENT ON TABLE "purchase_order_lines" IS 'Line items for purchase orders with accounting dimensions';
COMMENT ON TABLE "purchase_order_receipts" IS 'Goods receipts against purchase orders';
COMMENT ON TABLE "purchase_order_receipt_lines" IS 'Line items for receipts with quality inspection support';
COMMENT ON TABLE "purchase_order_approval_history" IS 'Audit trail for PO approval workflow';
COMMENT ON TABLE "vendor_bills" IS 'Vendor invoices/AP bills with 3-way match support';
COMMENT ON TABLE "vendor_bill_lines" IS 'Line items for vendor bills with 3-way match details';
COMMENT ON TABLE "bill_payments" IS 'Payments to vendors with multiple payment methods';
COMMENT ON TABLE "bill_payment_applications" IS 'Application of payments to vendor bills';
COMMENT ON TABLE "vendor_credit_memos" IS 'Vendor credits for returns, adjustments, or rebates';
COMMENT ON TABLE "vendor_bill_approval_history" IS 'Audit trail for bill approval workflow';

COMMENT ON COLUMN "vendor_bills"."three_way_match_status" IS 'Status of PO-Receipt-Bill matching validation';
COMMENT ON COLUMN "vendor_bills"."match_variance_amount" IS 'Total variance amount from 3-way match';
COMMENT ON COLUMN "vendor_bill_lines"."quantity_variance" IS 'Difference between billed qty and PO/received qty';
COMMENT ON COLUMN "vendor_bill_lines"."price_variance" IS 'Difference between billed price and PO price';
COMMENT ON COLUMN "purchase_order_receipt_lines"."serial_numbers" IS 'JSON array of serial numbers for inventory tracking';
