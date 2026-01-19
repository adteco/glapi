-- Migration: Hybrid Transaction Model
-- Description: Consolidates P2P and O2C transactions into unified core tables with type-specific extensions
-- This enables cross-transaction reporting while preserving type safety via separate enums and extension tables

-- ============================================================================
-- STATUS ENUMS (Separate per transaction type for type safety)
-- ============================================================================

-- Purchase Order Status
CREATE TYPE purchase_order_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED',
    'PARTIALLY_BILLED',
    'FULLY_BILLED',
    'CLOSED',
    'CANCELLED'
);

-- PO Receipt Status
CREATE TYPE po_receipt_status_enum AS ENUM (
    'DRAFT',
    'PENDING',
    'POSTED',
    'CANCELLED'
);

-- Vendor Bill Status
CREATE TYPE vendor_bill_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'PENDING_MATCH',
    'MATCHED',
    'MATCH_EXCEPTION',
    'PARTIALLY_PAID',
    'PAID',
    'VOIDED',
    'CANCELLED'
);

-- Bill Payment Status
CREATE TYPE bill_payment_status_enum AS ENUM (
    'DRAFT',
    'PENDING',
    'POSTED',
    'CLEARED',
    'VOIDED'
);

-- Sales Order Status
CREATE TYPE sales_order_status_enum AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'PARTIALLY_FULFILLED',
    'FULFILLED',
    'PARTIALLY_INVOICED',
    'INVOICED',
    'CLOSED',
    'CANCELLED'
);

-- Invoice Status
CREATE TYPE invoice_status_enum AS ENUM (
    'DRAFT',
    'PENDING',
    'SENT',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'VOIDED',
    'CANCELLED'
);

-- Customer Payment Status
CREATE TYPE customer_payment_status_enum AS ENUM (
    'DRAFT',
    'PENDING',
    'POSTED',
    'DEPOSITED',
    'CLEARED',
    'VOIDED'
);

-- 3-Way Match Status (for vendor bills)
CREATE TYPE three_way_match_status_enum AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'MATCHED',
    'VARIANCE_WITHIN_TOLERANCE',
    'VARIANCE_EXCEPTION',
    'OVERRIDE_APPROVED'
);

-- Line Match Status
CREATE TYPE line_match_status_enum AS ENUM (
    'NOT_REQUIRED',
    'PENDING',
    'MATCHED',
    'QUANTITY_VARIANCE',
    'PRICE_VARIANCE',
    'BOTH_VARIANCE',
    'OVERRIDE_APPROVED'
);

-- Transaction Category
CREATE TYPE transaction_category_enum AS ENUM (
    'P2P',   -- Procure to Pay (vendor transactions)
    'O2C',   -- Order to Cash (customer transactions)
    'GL'     -- General Ledger (journal entries)
);

-- Entity Role
CREATE TYPE entity_role_enum AS ENUM (
    'VENDOR',
    'CUSTOMER',
    'INTERNAL'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Transaction Types Registry (metadata about each transaction type)
CREATE TABLE transaction_types (
    type_code VARCHAR(50) PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    category transaction_category_enum NOT NULL,
    entity_role entity_role_enum NOT NULL,
    header_ext_table VARCHAR(100),
    line_ext_table VARCHAR(100),
    status_enum VARCHAR(100) NOT NULL,
    has_lines BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed transaction types
INSERT INTO transaction_types (type_code, type_name, category, entity_role, header_ext_table, line_ext_table, status_enum, has_lines) VALUES
-- P2P (Vendor transactions)
('PURCHASE_ORDER', 'Purchase Order', 'P2P', 'VENDOR', 'purchase_order_ext', 'purchase_order_line_ext', 'purchase_order_status_enum', TRUE),
('PO_RECEIPT', 'PO Receipt', 'P2P', 'VENDOR', 'po_receipt_ext', 'po_receipt_line_ext', 'po_receipt_status_enum', TRUE),
('VENDOR_BILL', 'Vendor Bill', 'P2P', 'VENDOR', 'vendor_bill_ext', 'vendor_bill_line_ext', 'vendor_bill_status_enum', TRUE),
('BILL_PAYMENT', 'Bill Payment', 'P2P', 'VENDOR', 'bill_payment_ext', NULL, 'bill_payment_status_enum', FALSE),
-- O2C (Customer transactions)
('SALES_ORDER', 'Sales Order', 'O2C', 'CUSTOMER', 'sales_order_ext', 'sales_order_line_ext', 'sales_order_status_enum', TRUE),
('INVOICE', 'Invoice', 'O2C', 'CUSTOMER', 'invoice_ext', 'invoice_line_ext', 'invoice_status_enum', TRUE),
('CUSTOMER_PAYMENT', 'Customer Payment', 'O2C', 'CUSTOMER', 'customer_payment_ext', NULL, 'customer_payment_status_enum', FALSE);

-- Transaction Headers (common fields for all transactions)
CREATE TABLE transaction_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),

    -- Type discriminator
    transaction_type VARCHAR(50) NOT NULL REFERENCES transaction_types(type_code),
    transaction_number VARCHAR(50) NOT NULL,

    -- Entity reference (vendor or customer)
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),

    -- Timing
    transaction_date DATE NOT NULL,

    -- Status (stored as text, validated by application layer per type)
    status VARCHAR(50) NOT NULL,

    -- Financial totals
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) DEFAULT 0,

    -- Currency
    currency_code VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) DEFAULT 1,

    -- Notes
    memo TEXT,
    internal_notes TEXT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by TEXT,

    -- Unique transaction number per org and type
    CONSTRAINT transaction_headers_number_unique UNIQUE (organization_id, transaction_type, transaction_number)
);

-- Transaction Lines (common fields for all line items)
CREATE TABLE transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transaction_headers(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Item reference
    item_id UUID REFERENCES items(id),
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,

    -- Quantities & amounts
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(50),
    unit_price DECIMAL(18,4) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    tax_amount DECIMAL(18,4) DEFAULT 0,

    -- Accounting dimensions
    account_id UUID REFERENCES accounts(id),
    department_id UUID REFERENCES departments(id),
    location_id UUID REFERENCES locations(id),
    class_id UUID REFERENCES classes(id),
    project_id UUID REFERENCES projects(id),

    -- Notes
    memo TEXT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Unique line number per transaction
    CONSTRAINT transaction_lines_number_unique UNIQUE (transaction_id, line_number)
);

-- ============================================================================
-- P2P EXTENSION TABLES
-- ============================================================================

-- Purchase Order Extension
CREATE TABLE purchase_order_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- Delivery
    expected_delivery_date DATE,
    ship_to_location_id UUID REFERENCES locations(id),
    shipping_address TEXT,
    shipping_method VARCHAR(100),
    shipping_amount DECIMAL(18,4) DEFAULT 0,

    -- Terms
    payment_terms VARCHAR(100),

    -- Fulfillment tracking
    received_amount DECIMAL(18,4) DEFAULT 0,
    billed_amount DECIMAL(18,4) DEFAULT 0,

    -- Approval workflow
    current_approver_id TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,

    -- Lifecycle
    closed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT
);

-- Purchase Order Line Extension
CREATE TABLE purchase_order_line_ext (
    line_id UUID PRIMARY KEY REFERENCES transaction_lines(id) ON DELETE CASCADE,

    -- Line-level delivery date
    expected_delivery_date DATE,

    -- Fulfillment tracking
    quantity_received DECIMAL(18,4) DEFAULT 0,
    quantity_billed DECIMAL(18,4) DEFAULT 0,

    -- Status
    is_closed BOOLEAN DEFAULT FALSE
);

-- PO Receipt Extension
CREATE TABLE po_receipt_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- Link to Purchase Order
    purchase_order_id UUID REFERENCES transaction_headers(id),

    -- Receipt details
    receipt_location_id UUID REFERENCES locations(id),
    shipping_ref VARCHAR(100),
    carrier_name VARCHAR(100),

    -- Posting
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by TEXT,

    -- Cancellation
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- PO Receipt Line Extension
CREATE TABLE po_receipt_line_ext (
    line_id UUID PRIMARY KEY REFERENCES transaction_lines(id) ON DELETE CASCADE,

    -- Link to PO line
    purchase_order_line_id UUID REFERENCES transaction_lines(id),

    -- Quality inspection
    quantity_accepted DECIMAL(18,4),
    quantity_rejected DECIMAL(18,4),
    rejection_reason TEXT,

    -- Warehouse tracking
    bin_location VARCHAR(100),
    lot_number VARCHAR(100),
    serial_numbers JSONB  -- Array of serial numbers
);

-- Vendor Bill Extension
CREATE TABLE vendor_bill_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- Vendor reference
    vendor_invoice_number VARCHAR(100),

    -- Link to PO
    purchase_order_id UUID REFERENCES transaction_headers(id),

    -- Payment terms
    due_date DATE NOT NULL,
    received_date DATE,
    shipping_amount DECIMAL(18,4) DEFAULT 0,

    -- 3-way match
    three_way_match_status three_way_match_status_enum DEFAULT 'NOT_REQUIRED',
    match_variance_amount DECIMAL(18,4),
    match_override_reason TEXT,
    match_override_by TEXT,
    match_override_at TIMESTAMP WITH TIME ZONE,

    -- Payment tracking
    paid_amount DECIMAL(18,4) DEFAULT 0,
    balance_due DECIMAL(18,4) DEFAULT 0,

    -- Discounts
    discount_date DATE,
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(18,4),
    discount_taken DECIMAL(18,4) DEFAULT 0,

    -- AP account
    ap_account_id UUID REFERENCES accounts(id),

    -- Approval workflow
    current_approver_id TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,

    -- Voiding
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by TEXT,
    void_reason TEXT
);

-- Vendor Bill Line Extension
CREATE TABLE vendor_bill_line_ext (
    line_id UUID PRIMARY KEY REFERENCES transaction_lines(id) ON DELETE CASCADE,

    -- 3-way match references
    purchase_order_line_id UUID REFERENCES transaction_lines(id),
    receipt_line_id UUID REFERENCES transaction_lines(id),

    -- Original PO values for variance calculation
    po_quantity DECIMAL(18,4),
    po_unit_price DECIMAL(18,4),
    received_quantity DECIMAL(18,4),

    -- Variances
    quantity_variance DECIMAL(18,4),
    price_variance DECIMAL(18,4),

    -- Line match status
    match_status line_match_status_enum DEFAULT 'NOT_REQUIRED'
);

-- Bill Payment Extension
CREATE TABLE bill_payment_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- Payment method
    payment_method VARCHAR(50) NOT NULL,
    payment_amount DECIMAL(18,4) NOT NULL,

    -- Application tracking
    applied_amount DECIMAL(18,4) DEFAULT 0,
    unapplied_amount DECIMAL(18,4) DEFAULT 0,
    discount_taken DECIMAL(18,4) DEFAULT 0,

    -- Bank account
    bank_account_id UUID REFERENCES accounts(id),

    -- Payment details by method
    check_number VARCHAR(50),
    ach_trace_number VARCHAR(100),
    wire_reference VARCHAR(100),
    external_ref VARCHAR(100),

    -- Payee info (for printing checks)
    payee_name VARCHAR(255),
    payee_address TEXT,

    -- Bank reconciliation
    cleared_date DATE,
    cleared_amount DECIMAL(18,4),

    -- Voiding
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by TEXT,
    void_reason TEXT
);

-- Bill Payment Applications (junction table - kept separate)
CREATE TABLE bill_payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,

    -- Payment reference
    payment_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Bill reference
    bill_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Application details
    applied_amount DECIMAL(18,4) NOT NULL,
    discount_taken DECIMAL(18,4) DEFAULT 0,
    application_date DATE NOT NULL,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL,

    CONSTRAINT bill_payment_applications_unique UNIQUE (payment_id, bill_id)
);

-- ============================================================================
-- O2C EXTENSION TABLES
-- ============================================================================

-- Sales Order Extension
CREATE TABLE sales_order_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- External reference
    external_reference VARCHAR(100),

    -- Addresses
    billing_address_id UUID,
    shipping_address_id UUID,

    -- Delivery dates
    requested_delivery_date DATE,
    promised_delivery_date DATE,
    expiration_date DATE,

    -- Status tracking
    previous_status VARCHAR(50),

    -- Discounts
    discount_amount DECIMAL(18,4) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,

    -- Shipping
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    shipping_method VARCHAR(100),

    -- Fulfillment tracking
    fulfilled_amount DECIMAL(18,4) DEFAULT 0,
    invoiced_amount DECIMAL(18,4) DEFAULT 0,
    remaining_amount DECIMAL(18,4) DEFAULT 0,

    -- Payment terms
    payment_terms VARCHAR(50),

    -- Approval workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_threshold DECIMAL(18,4),
    current_approver_id TEXT,
    approval_level INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,

    -- Lifecycle
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by TEXT,
    cancellation_reason TEXT
);

-- Sales Order Line Extension
CREATE TABLE sales_order_line_ext (
    line_id UUID PRIMARY KEY REFERENCES transaction_lines(id) ON DELETE CASCADE,

    -- SKU
    sku VARCHAR(100),

    -- Fulfillment tracking
    fulfilled_quantity DECIMAL(18,4) DEFAULT 0,
    invoiced_quantity DECIMAL(18,4) DEFAULT 0,
    cancelled_quantity DECIMAL(18,4) DEFAULT 0,
    remaining_quantity DECIMAL(18,4) DEFAULT 0,

    -- Discounts
    discount_amount DECIMAL(18,4) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,

    -- Tax
    tax_code VARCHAR(50),
    line_total DECIMAL(18,4),

    -- Delivery dates
    requested_delivery_date DATE,
    promised_delivery_date DATE,

    -- Revenue recognition
    revenue_account_id UUID REFERENCES accounts(id),
    deferred_revenue_account_id UUID REFERENCES accounts(id)
);

-- Invoice Extension
CREATE TABLE invoice_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- Source references
    subscription_id UUID,
    sales_order_id UUID REFERENCES transaction_headers(id),

    -- Payment terms
    due_date DATE,

    -- Billing period (for subscriptions)
    billing_period_start DATE,
    billing_period_end DATE,

    -- Payment tracking
    paid_amount DECIMAL(18,4) DEFAULT 0,
    balance_due DECIMAL(18,4) DEFAULT 0,

    -- AR account
    ar_account_id UUID REFERENCES accounts(id),

    -- Voiding
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by TEXT,
    void_reason TEXT
);

-- Invoice Line Extension
CREATE TABLE invoice_line_ext (
    line_id UUID PRIMARY KEY REFERENCES transaction_lines(id) ON DELETE CASCADE,

    -- Subscription reference
    subscription_item_id UUID,

    -- Source line references
    sales_order_line_id UUID REFERENCES transaction_lines(id),

    -- Revenue recognition
    revenue_account_id UUID REFERENCES accounts(id),
    deferred_revenue_account_id UUID REFERENCES accounts(id)
);

-- Customer Payment Extension
CREATE TABLE customer_payment_ext (
    transaction_id UUID PRIMARY KEY REFERENCES transaction_headers(id) ON DELETE CASCADE,

    -- External reference
    external_reference VARCHAR(100),

    -- Payment method
    payment_method VARCHAR(50) NOT NULL,

    -- Check details
    check_number VARCHAR(50),
    bank_routing_number VARCHAR(20),
    bank_account_last4 VARCHAR(4),

    -- Amounts
    payment_amount DECIMAL(18,4) NOT NULL,
    applied_amount DECIMAL(18,4) DEFAULT 0,
    unapplied_amount DECIMAL(18,4) DEFAULT 0,

    -- Accounts
    cash_account_id UUID REFERENCES accounts(id),
    ar_account_id UUID REFERENCES accounts(id),

    -- GL posting
    gl_transaction_id UUID,
    posted_at TIMESTAMP WITH TIME ZONE,

    -- Bank deposit
    bank_deposit_id UUID,  -- References bank_deposits table

    -- Voiding
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by TEXT,
    void_reason TEXT
);

-- Customer Payment Applications (junction table)
CREATE TABLE customer_payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,

    -- Payment reference
    payment_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Invoice reference
    invoice_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Application details
    applied_amount DECIMAL(18,4) NOT NULL,
    discount_taken DECIMAL(18,4) DEFAULT 0,
    application_date DATE NOT NULL,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL,

    CONSTRAINT customer_payment_applications_unique UNIQUE (payment_id, invoice_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Transaction Headers indexes
CREATE INDEX transaction_headers_org_idx ON transaction_headers(organization_id);
CREATE INDEX transaction_headers_type_idx ON transaction_headers(transaction_type);
CREATE INDEX transaction_headers_entity_idx ON transaction_headers(entity_id);
CREATE INDEX transaction_headers_date_idx ON transaction_headers(transaction_date);
CREATE INDEX transaction_headers_status_idx ON transaction_headers(status);
CREATE INDEX transaction_headers_org_type_date_idx ON transaction_headers(organization_id, transaction_type, transaction_date);

-- Transaction Lines indexes
CREATE INDEX transaction_lines_transaction_idx ON transaction_lines(transaction_id);
CREATE INDEX transaction_lines_item_idx ON transaction_lines(item_id);
CREATE INDEX transaction_lines_account_idx ON transaction_lines(account_id);

-- PO Extension indexes
CREATE INDEX purchase_order_ext_delivery_idx ON purchase_order_ext(expected_delivery_date);
CREATE INDEX po_receipt_ext_po_idx ON po_receipt_ext(purchase_order_id);

-- Vendor Bill indexes
CREATE INDEX vendor_bill_ext_po_idx ON vendor_bill_ext(purchase_order_id);
CREATE INDEX vendor_bill_ext_due_date_idx ON vendor_bill_ext(due_date);
CREATE INDEX vendor_bill_ext_match_status_idx ON vendor_bill_ext(three_way_match_status);

-- Bill Payment indexes
CREATE INDEX bill_payment_ext_method_idx ON bill_payment_ext(payment_method);
CREATE INDEX bill_payment_ext_cleared_idx ON bill_payment_ext(cleared_date);
CREATE INDEX bill_payment_applications_payment_idx ON bill_payment_applications(payment_id);
CREATE INDEX bill_payment_applications_bill_idx ON bill_payment_applications(bill_id);

-- Sales Order indexes
CREATE INDEX sales_order_ext_delivery_idx ON sales_order_ext(requested_delivery_date);

-- Invoice indexes
CREATE INDEX invoice_ext_due_date_idx ON invoice_ext(due_date);
CREATE INDEX invoice_ext_subscription_idx ON invoice_ext(subscription_id);
CREATE INDEX invoice_ext_sales_order_idx ON invoice_ext(sales_order_id);

-- Customer Payment indexes
CREATE INDEX customer_payment_ext_method_idx ON customer_payment_ext(payment_method);
CREATE INDEX customer_payment_ext_deposit_idx ON customer_payment_ext(bank_deposit_id);
CREATE INDEX customer_payment_applications_payment_idx ON customer_payment_applications(payment_id);
CREATE INDEX customer_payment_applications_invoice_idx ON customer_payment_applications(invoice_id);

-- ============================================================================
-- APPROVAL HISTORY TABLES (kept separate - audit trails)
-- ============================================================================

-- Purchase Order Approval History
CREATE TABLE purchase_order_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Approval action
    action VARCHAR(50) NOT NULL,  -- SUBMITTED, APPROVED, REJECTED, RECALLED
    from_status VARCHAR(50),
    to_status VARCHAR(50),

    -- Actor
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Comments
    comments TEXT,

    -- Approval level
    approval_level INTEGER,
    next_approver_id TEXT
);

-- Vendor Bill Approval History
CREATE TABLE vendor_bill_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    vendor_bill_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Approval action
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),

    -- Actor
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Comments
    comments TEXT,

    -- Match override
    is_match_override BOOLEAN DEFAULT FALSE,
    override_variance_amount DECIMAL(18,4)
);

-- Sales Order Approval History
CREATE TABLE sales_order_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    sales_order_id UUID NOT NULL REFERENCES transaction_headers(id),

    -- Approval action
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),

    -- Actor
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Comments
    comments TEXT,

    -- Approval level
    approval_level INTEGER,
    next_approver_id TEXT
);

-- Indexes for approval history
CREATE INDEX po_approval_history_po_idx ON purchase_order_approval_history(purchase_order_id);
CREATE INDEX vendor_bill_approval_history_bill_idx ON vendor_bill_approval_history(vendor_bill_id);
CREATE INDEX sales_order_approval_history_so_idx ON sales_order_approval_history(sales_order_id);

-- ============================================================================
-- CREDIT MEMO TABLES (kept separate - reference tables)
-- ============================================================================

-- Vendor Credit Memos
CREATE TABLE vendor_credit_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),

    -- Vendor reference
    vendor_id UUID NOT NULL,
    vendor_name VARCHAR(255),

    -- Credit memo details
    credit_memo_number VARCHAR(50) NOT NULL,
    credit_memo_date DATE NOT NULL,

    -- Source reference
    vendor_bill_id UUID REFERENCES transaction_headers(id),

    -- Amounts
    subtotal DECIMAL(18,4) NOT NULL,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,
    applied_amount DECIMAL(18,4) DEFAULT 0,
    remaining_amount DECIMAL(18,4) NOT NULL,

    -- Currency
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',  -- OPEN, PARTIALLY_APPLIED, APPLIED, VOIDED

    -- Notes
    memo TEXT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by TEXT,

    CONSTRAINT vendor_credit_memos_number_unique UNIQUE (organization_id, credit_memo_number)
);

-- Customer Credit Memos
CREATE TABLE customer_credit_memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id),

    -- Customer reference
    customer_id UUID NOT NULL,
    customer_name VARCHAR(255),

    -- Credit memo details
    credit_memo_number VARCHAR(50) NOT NULL,
    credit_memo_date DATE NOT NULL,

    -- Source reference
    invoice_id UUID REFERENCES transaction_headers(id),

    -- Amounts
    subtotal DECIMAL(18,4) NOT NULL,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,
    applied_amount DECIMAL(18,4) DEFAULT 0,
    remaining_amount DECIMAL(18,4) NOT NULL,

    -- Currency
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',

    -- Notes
    memo TEXT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by TEXT,

    CONSTRAINT customer_credit_memos_number_unique UNIQUE (organization_id, credit_memo_number)
);

-- Credit memo indexes
CREATE INDEX vendor_credit_memos_vendor_idx ON vendor_credit_memos(vendor_id);
CREATE INDEX vendor_credit_memos_bill_idx ON vendor_credit_memos(vendor_bill_id);
CREATE INDEX customer_credit_memos_customer_idx ON customer_credit_memos(customer_id);
CREATE INDEX customer_credit_memos_invoice_idx ON customer_credit_memos(invoice_id);
