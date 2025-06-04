# General Ledger Data Model Design Document - Event-Driven Architecture

## Executive Summary

This document outlines the data model structure for a multi-currency, GAAP-compliant general ledger system designed to handle 1,000,000+ transactions monthly with real-time balance calculations, audit trails, and comprehensive financial reporting capabilities. The system implements an **event-driven architecture** within a **mono-repo structure** to enable surgical extensibility and maintain strong auditability.

## Architectural Principles

- **Event-Driven Design**: All state changes captured as immutable events for complete auditability
- **Mono-repo with Microservice Modularity**: Isolated apps/packages with shared data layer
- **Pub/Sub Event Architecture**: Loosely coupled components communicating via events
- **Event Sourcing**: Core business entities built from event streams
- **CQRS Pattern**: Command/Query separation for optimal read/write performance
- **Real-time Performance**: Optimized for high-volume transaction processing
- **GAAP Compliance**: Structured to support all GAAP reporting requirements

## Event-Driven Architecture Overview

### Core Event Types

```typescript
// Base Event Interface
interface BaseEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: Date;
  userId: string;
  sessionId: string;
  correlationId: string;
  causationId?: string;
  metadata: Record<string, any>;
}

// Business Event Categories
enum EventCategory {
  TRANSACTION = 'TRANSACTION',
  APPROVAL = 'APPROVAL', 
  PAYMENT = 'PAYMENT',
  ACCOUNTING = 'ACCOUNTING',
  SUBSCRIPTION = 'SUBSCRIPTION',
  PROJECT = 'PROJECT',
  CONTRACT = 'CONTRACT'
}
```

### Event Store Schema

```sql
-- Core Event Store
EVENT_STORE
├── event_id (UUID, PK) -- Unique event identifier
├── event_type (VARCHAR(100), NOT NULL) -- Specific event type
├── event_category (VARCHAR(50), NOT NULL) -- High-level category
├── aggregate_id (VARCHAR(100), NOT NULL) -- Entity being changed
├── aggregate_type (VARCHAR(50), NOT NULL) -- Type of entity
├── event_version (BIGINT, NOT NULL) -- Version within aggregate
├── global_sequence (BIGINT, AUTO_INCREMENT, UNIQUE) -- Global ordering
├── event_data (JSON, NOT NULL) -- Event payload
├── metadata (JSON) -- Additional context
├── timestamp (TIMESTAMP(6), NOT NULL) -- High precision timestamp
├── user_id (INT, FK -> USERS.user_id)
├── session_id (VARCHAR(100))
├── correlation_id (UUID, NOT NULL) -- Request correlation
├── causation_id (UUID) -- Parent event that caused this
├── tenant_id (INT, FK -> SUBSIDIARIES.subsidiary_id) -- Multi-tenancy
├── created_at (TIMESTAMP(6), DEFAULT CURRENT_TIMESTAMP(6))
└── INDEX idx_aggregate (aggregate_type, aggregate_id, event_version)
└── INDEX idx_correlation (correlation_id)
└── INDEX idx_timestamp (timestamp)
└── INDEX idx_global_sequence (global_sequence)
```

### Event Projections (Read Models)

```sql
-- Event Projections track current state
EVENT_PROJECTIONS
├── projection_id (UUID, PK)
├── projection_name (VARCHAR(100), NOT NULL) -- 'AccountBalance', 'ProjectStatus'
├── aggregate_id (VARCHAR(100), NOT NULL)
├── aggregate_type (VARCHAR(50), NOT NULL)
├── last_event_version (BIGINT, NOT NULL) -- Last processed event
├── last_global_sequence (BIGINT, NOT NULL) -- Last processed global sequence
├── projection_data (JSON, NOT NULL) -- Current state
├── updated_at (TIMESTAMP(6), NOT NULL)
├── created_at (TIMESTAMP(6), DEFAULT CURRENT_TIMESTAMP(6))
└── UNIQUE KEY uk_projection (projection_name, aggregate_id)
└── INDEX idx_last_sequence (last_global_sequence)
```

### Outbox Pattern for Reliable Publishing

```sql
-- Ensures reliable event publishing
EVENT_OUTBOX
├── outbox_id (UUID, PK)
├── event_id (UUID, FK -> EVENT_STORE.event_id)
├── topic (VARCHAR(100), NOT NULL) -- Pub/sub topic
├── partition_key (VARCHAR(100)) -- For ordered processing
├── payload (JSON, NOT NULL) -- Published message
├── status (ENUM('PENDING', 'PUBLISHED', 'FAILED'), DEFAULT 'PENDING')
├── created_at (TIMESTAMP(6), DEFAULT CURRENT_TIMESTAMP(6))
├── published_at (TIMESTAMP(6))
├── retry_count (INT, DEFAULT 0)
├── error_message (TEXT)
└── INDEX idx_status_created (status, created_at)
```

## Mono-repo Package Structure

### Core Packages
```
packages/
├── @gl/domain-events/          # Event definitions and schemas
├── @gl/event-store/            # Event storage and retrieval
├── @gl/shared-types/           # Common TypeScript interfaces
├── @gl/database/               # Database schemas and migrations  
├── @gl/audit-logging/          # Centralized audit functionality
├── @gl/pub-sub/                # Event publishing infrastructure
├── @gl/projections/            # Read model projections
└── @gl/testing-utils/          # Shared testing utilities
```

### Application Modules
```
apps/
├── gl-core/                    # Core GL transaction processing
├── accounts-receivable/        # AR module with invoice management
├── accounts-payable/           # AP module with vendor management
├── project-management/         # Project tracking and time entry
├── subscription-billing/       # Recurring revenue management
├── contract-management/        # Contract lifecycle management
├── financial-reporting/        # Report generation and analytics
├── api-gateway/               # External API interface
└── event-processor/           # Background event processing
```

## Business Transaction Framework

The system supports two types of transactions:
1. **Source Transactions**: Business documents (Sales Orders, Purchase Orders, Invoices, etc.)
2. **GL Transactions**: Accounting entries generated from source transactions

### Transaction Type Hierarchy

```
Business Transactions
├── Pre-Sales Cycle
│   ├── Opportunities (OP) -- Lead/Pipeline Management
│   ├── RFQs (RFQ) -- Request for Quotes
│   ├── Estimates (ES) -- Quotes/Proposals
│   └── Contracts (CT) -- Master Service Agreements
├── Sales Cycle
│   ├── Sales Orders (SO) -- Confirmed Orders
│   ├── Customer Invoices (CI) -- Billing
│   ├── Customer Payments (CP) -- Cash Receipt
│   ├── Credit Memos (CM) -- Returns/Adjustments
│   └── Customer Refunds (CR) -- Cash Refunds
├── Purchase Cycle  
│   ├── Purchase Orders (PO)
│   ├── Item Receipts (IR)
│   ├── Vendor Bills (VB)
│   ├── Bill Payments (BP)
│   └── Bill Credits (BC)
├── Project Management
│   ├── Project Setup (PS) -- Project initiation
│   ├── Time Entries (TE) -- Labor tracking
│   ├── Expense Reports (ER) -- Project expenses
│   └── Project Invoices (PI) -- Project billing
├── Subscription Management
│   ├── Subscription Setup (SS) -- Recurring revenue setup
│   ├── Subscription Invoices (SI) -- Recurring billing
│   ├── Subscription Changes (SC) -- Upgrades/downgrades
│   └── Subscription Cancellations (SX) -- Terminations
└── Inventory
    ├── Inventory Adjustments (IA)
    ├── Transfers (IT)
    └── Assemblies (AS)
```

## Traditional Database Schema (Read Models)

*Note: These tables now serve as projections/read models built from events*

### Core Entity Tables

### Transaction Lifecycle Events

```typescript
// Transaction Created
interface TransactionCreatedEvent extends BaseEvent {
  eventType: 'TransactionCreated';
  data: {
    transactionId: string;
    transactionNumber: string;
    transactionType: string;
    subsidiaryId: number;
    amount: number;
    currency: string;
    description: string;
    lines: TransactionLine[];
  };
}

// Transaction Posted (Immutable)
interface TransactionPostedEvent extends BaseEvent {
  eventType: 'TransactionPosted';
  data: {
    transactionId: string;
    postingDate: Date;
    periodId: number;
    glTransactionId: string;
    balanceUpdates: BalanceUpdate[];
  };
}

// Balance Updated
interface BalanceUpdatedEvent extends BaseEvent {
  eventType: 'BalanceUpdated';
  data: {
    accountId: number;
    subsidiaryId: number;
    periodId: number;
    previousBalance: number;
    newBalance: number;
    delta: number;
    transactionId: string;
  };
}
```

### Subscription Events

```typescript
// Subscription Activated
interface SubscriptionActivatedEvent extends BaseEvent {
  eventType: 'SubscriptionActivated';
  data: {
    subscriptionId: string;
    customerId: string;
    planDetails: SubscriptionPlan;
    billingSchedule: BillingSchedule;
    activationDate: Date;
    firstBillingDate: Date;
  };
}

// Subscription Billed
interface SubscriptionBilledEvent extends BaseEvent {
  eventType: 'SubscriptionBilled';
  data: {
    subscriptionId: string;
    invoiceId: string;
    billingPeriod: { start: Date; end: Date };
    amount: number;
    currency: string;
    nextBillingDate: Date;
  };
}

// Usage Recorded (for usage-based billing)
interface UsageRecordedEvent extends BaseEvent {
  eventType: 'UsageRecorded';
  data: {
    subscriptionId: string;
    usageType: string;
    quantity: number;
    recordedAt: Date;
    meteringPeriod: { start: Date; end: Date };
  };
}
```

### Project Events

```typescript
// Time Entry Submitted
interface TimeEntrySubmittedEvent extends BaseEvent {
  eventType: 'TimeEntrySubmitted';
  data: {
    entryId: string;
    projectId: string;
    employeeId: number;
    activityCodeId: number;
    hours: number;
    workDate: Date;
    description: string;
    billableFlag: boolean;
    costRate: number;
    billingRate: number;
  };
}

// Project Budget Exceeded
interface ProjectBudgetExceededEvent extends BaseEvent {
  eventType: 'ProjectBudgetExceeded';
  data: {
    projectId: string;
    budgetAmount: number;
    actualCost: number;
    overageAmount: number;
    overagePercentage: number;
    triggerTransactionId: string;
  };
}
```

## Event-Driven Business Logic

### Event Handlers and Projections

```typescript
// Account Balance Projection Handler
class AccountBalanceProjectionHandler {
  async handle(event: BalanceUpdatedEvent): Promise<void> {
    // Update account balance projection
    await this.updateProjection('AccountBalance', {
      accountId: event.data.accountId,
      currentBalance: event.data.newBalance,
      lastUpdated: event.timestamp,
      lastTransactionId: event.data.transactionId
    });
    
    // Trigger alerts if needed
    if (await this.shouldTriggerAlert(event.data.accountId, event.data.newBalance)) {
      await this.publishEvent({
        eventType: 'AccountBalanceAlertTriggered',
        data: { accountId: event.data.accountId, balance: event.data.newBalance }
      });
    }
  }
}

// Subscription Billing Handler
class SubscriptionBillingHandler {
  async handle(event: SubscriptionActivatedEvent): Promise<void> {
    // Schedule first billing
    await this.scheduleEvent({
      eventType: 'SubscriptionBillingDue',
      scheduledFor: event.data.firstBillingDate,
      data: { subscriptionId: event.data.subscriptionId }
    });
    
    // Update subscription projection
    await this.updateProjection('SubscriptionStatus', {
      subscriptionId: event.data.subscriptionId,
      status: 'ACTIVE',
      nextBillingDate: event.data.firstBillingDate,
      activatedAt: event.timestamp
    });
  }
}
```

### Event-Driven Workflows

```typescript
// Transaction Approval Workflow
class TransactionApprovalWorkflow {
  async handle(event: TransactionCreatedEvent): Promise<void> {
    const transaction = event.data;
    
    // Check if approval required
    if (await this.requiresApproval(transaction)) {
      await this.publishEvent({
        eventType: 'ApprovalRequested',
        data: {
          transactionId: transaction.transactionId,
          approvalType: 'TRANSACTION',
          amount: transaction.amount,
          requestedBy: event.userId,
          requiredApprovers: await this.getRequiredApprovers(transaction)
        }
      });
    } else {
      // Auto-approve
      await this.publishEvent({
        eventType: 'TransactionApproved',
        data: {
          transactionId: transaction.transactionId,
          approvedBy: 'SYSTEM',
          approvedAt: new Date()
        }
      });
    }
  }
}
```

## Enhanced Audit Architecture

### Immutable Audit Trail

```sql
-- Every business action creates an immutable event
-- Complete audit trail is reconstructed from event stream
-- No need for separate audit tables - events ARE the audit trail

-- Audit Query Examples:
-- "Who changed transaction X?" -> Query events for that aggregate
-- "What was account balance on date Y?" -> Replay events up to that date  
-- "Show all changes to project Z?" -> Filter events by project aggregate
```

### Compliance and Regulatory Reporting

```sql
-- SOX Compliance View from Events
CREATE VIEW v_sox_audit_trail AS
SELECT 
    es.event_id,
    es.event_type,
    es.aggregate_id,
    es.aggregate_type,
    es.timestamp,
    u.username,
    es.metadata,
    CASE 
        WHEN es.event_type LIKE '%Posted%' THEN 'FINANCIAL_IMPACT'
        WHEN es.event_type LIKE '%Approved%' THEN 'APPROVAL_ACTION'
        WHEN es.event_type LIKE '%Deleted%' THEN 'DATA_REMOVAL'
        ELSE 'STANDARD_OPERATION'
    END as compliance_category,
    JSON_EXTRACT(es.event_data, '$.amount') as financial_impact
FROM EVENT_STORE es
JOIN USERS u ON es.user_id = u.user_id
WHERE es.event_category IN ('TRANSACTION', 'ACCOUNTING', 'APPROVAL')
ORDER BY es.timestamp DESC;
```

### 1. Transaction Types Master (TRANSACTION_TYPES)

```sql
TRANSACTION_TYPES
├── transaction_type_id (INT, PK, AUTO_INCREMENT)
├── type_code (VARCHAR(10), UNIQUE, NOT NULL) -- 'SO', 'PO', 'CI', 'VB', etc.
├── type_name (VARCHAR(50), NOT NULL) -- 'Sales Order', 'Purchase Order', etc.
├── type_category (VARCHAR(20)) -- 'SALES', 'PURCHASE', 'INVENTORY', 'GL'
├── generates_gl (BOOLEAN, DEFAULT TRUE) -- Does this create GL entries?
├── requires_approval (BOOLEAN, DEFAULT FALSE)
├── can_be_reversed (BOOLEAN, DEFAULT TRUE)
├── numbering_sequence (VARCHAR(50)) -- 'SO-{YYYY}-{####}'
├── default_gl_account_id (INT, FK -> ACCOUNTS.account_id)
├── workflow_template (JSON) -- Defines approval workflow
├── sales_stage (VARCHAR(50)) -- For opportunities: 'LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
├── probability (DECIMAL(5,2)) -- Win probability percentage for opportunities
├── expected_close_date (DATE) -- Forecasted close date for opportunities
├── contract_id (BIGINT, FK -> CONTRACTS.contract_id) -- Link to master contract
├── project_id (INT, FK -> PROJECTS.project_id) -- Link to project
├── subscription_id (BIGINT, FK -> SUBSCRIPTIONS.subscription_id) -- Link to subscription
├── rfq_response_due_date (DATE) -- Due date for RFQ responses
├── award_date (DATE) -- Date contract/RFQ was awarded
├── lead_source (VARCHAR(100)) -- How opportunity was generated
├── competitor (VARCHAR(100)) -- Primary competitor for opportunity
├── estimate_valid_until (DATE) -- Expiration date for estimates
├── is_active (BOOLEAN, DEFAULT TRUE)
└── sort_order (INT, DEFAULT 0)
```

### 2. Business Transaction Header (BUSINESS_TRANSACTIONS)

```sql
BUSINESS_TRANSACTIONS
├── business_transaction_id (BIGINT, PK, AUTO_INCREMENT)
├── transaction_number (VARCHAR(50), UNIQUE, NOT NULL)
├── transaction_type_id (INT, FK -> TRANSACTION_TYPES.transaction_type_id)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id)
├── entity_id (BIGINT) -- Customer/Vendor ID (polymorphic)
├── entity_type (VARCHAR(20)) -- 'CUSTOMER', 'VENDOR', 'EMPLOYEE'
├── transaction_date (DATE, NOT NULL)
├── due_date (DATE)
├── terms_id (INT, FK -> PAYMENT_TERMS.terms_id)
├── currency_code (CHAR(3), NOT NULL)
├── exchange_rate (DECIMAL(12,6), DEFAULT 1)
├── subtotal_amount (DECIMAL(18,4), DEFAULT 0)
├── tax_amount (DECIMAL(18,4), DEFAULT 0)
├── discount_amount (DECIMAL(18,4), DEFAULT 0)
├── total_amount (DECIMAL(18,4), NOT NULL)
├── base_total_amount (DECIMAL(18,4), NOT NULL)
├── memo (TEXT)
├── external_reference (VARCHAR(100)) -- PO number, invoice number, etc.
├── status (VARCHAR(20)) -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED', 'CANCELLED'
├── workflow_status (VARCHAR(50)) -- Current approval status
├── ship_date (DATE)
├── shipped_via (VARCHAR(100))
├── tracking_number (VARCHAR(100))
├── billing_address_id (BIGINT, FK -> ADDRESSES.address_id)
├── shipping_address_id (BIGINT, FK -> ADDRESSES.address_id)
├── sales_rep_id (INT, FK -> EMPLOYEES.employee_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── class_id (INT, FK -> CLASSES.class_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── project_id (INT, FK -> PROJECTS.project_id)
├── estimated_hours (DECIMAL(10,2)) -- For service estimates
├── markup_percent (DECIMAL(5,2)) -- Markup over cost for estimates
├── margin_percent (DECIMAL(5,2)) -- Calculated margin percentage
├── parent_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── root_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── gl_transaction_id (BIGINT, FK -> GL_TRANSACTIONS.transaction_id)
├── created_by (INT, FK -> USERS.user_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
├── modified_by (INT, FK -> USERS.user_id)
├── modified_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE)
├── approved_by (INT, FK -> USERS.user_id)
├── approved_date (TIMESTAMP)
├── posted_date (TIMESTAMP)
└── version_number (INT, DEFAULT 1)
```

### 3. Business Transaction Lines (BUSINESS_TRANSACTION_LINES)

```sql
BUSINESS_TRANSACTION_LINES
├── line_id (BIGINT, PK, AUTO_INCREMENT)
├── business_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── line_number (INT, NOT NULL)
├── line_type (VARCHAR(20)) -- 'ITEM', 'SERVICE', 'DISCOUNT', 'TAX', 'SHIPPING'
├── item_id (INT, FK -> ITEMS.item_id)
├── description (TEXT, NOT NULL)
├── quantity (DECIMAL(18,4), DEFAULT 0)
├── unit_of_measure (VARCHAR(20))
├── unit_price (DECIMAL(18,4), DEFAULT 0)
├── discount_percent (DECIMAL(5,2), DEFAULT 0)
├── discount_amount (DECIMAL(18,4), DEFAULT 0)
├── line_amount (DECIMAL(18,4), NOT NULL)
├── tax_code_id (INT, FK -> TAX_CODES.tax_code_id)
├── tax_amount (DECIMAL(18,4), DEFAULT 0)
├── total_line_amount (DECIMAL(18,4), NOT NULL)
├── account_id (INT, FK -> ACCOUNTS.account_id) -- GL account for this line
├── class_id (INT, FK -> CLASSES.class_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── project_id (INT, FK -> PROJECTS.project_id)
├── job_id (INT, FK -> JOBS.job_id)
├── activity_code_id (INT, FK -> ACTIVITY_CODES.activity_code_id) -- Detailed activity tracking
├── billable_flag (BOOLEAN, DEFAULT TRUE) -- Is this line billable to customer?
├── billing_rate (DECIMAL(18,4)) -- Rate for billable items/services
├── hours_worked (DECIMAL(10,2)) -- Labor hours for time tracking
├── employee_id (INT, FK -> EMPLOYEES.employee_id) -- Who performed the work
├── work_date (DATE) -- When work was performed
├── parent_line_id (BIGINT, FK -> BUSINESS_TRANSACTION_LINES.line_id)
├── quantity_received (DECIMAL(18,4), DEFAULT 0) -- For PO tracking
├── quantity_billed (DECIMAL(18,4), DEFAULT 0) -- For PO/SO tracking
├── quantity_shipped (DECIMAL(18,4), DEFAULT 0) -- For SO tracking
├── cost_amount (DECIMAL(18,4), DEFAULT 0) -- For inventory costing
├── serial_numbers (TEXT) -- JSON array of serial numbers
├── lot_numbers (TEXT) -- JSON array of lot numbers
├── estimated_hours (DECIMAL(10,2)) -- For service line items
├── hourly_rate (DECIMAL(18,4)) -- Rate for service items
├── cost_estimate (DECIMAL(18,4)) -- Estimated cost for opportunity analysis
├── margin_amount (DECIMAL(18,4)) -- Calculated margin on line
├── notes (TEXT) -- Line-specific notes
└── custom_fields (JSON) -- Flexible custom field storage
```

### 4. Transaction Relationships (TRANSACTION_RELATIONSHIPS)

```sql
TRANSACTION_RELATIONSHIPS
├── relationship_id (BIGINT, PK, AUTO_INCREMENT)
├── parent_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── child_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── relationship_type (VARCHAR(50)) -- 'FULFILLMENT', 'PAYMENT', 'CREDIT', 'RETURN'
├── applied_amount (DECIMAL(18,4)) -- Amount applied in this relationship
├── parent_line_id (BIGINT, FK -> BUSINESS_TRANSACTION_LINES.line_id)
├── child_line_id (BIGINT, FK -> BUSINESS_TRANSACTION_LINES.line_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── notes (TEXT)
```

### 5. Enhanced GL Transaction Header (GL_TRANSACTIONS)

```sql
GL_TRANSACTIONS
├── transaction_id (BIGINT, PK, AUTO_INCREMENT)
├── transaction_number (VARCHAR(50), UNIQUE, NOT NULL) -- User-friendly reference
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id)
├── transaction_date (DATE, NOT NULL)
├── posting_date (DATE, NOT NULL)
├── period_id (INT, FK -> ACCOUNTING_PERIODS.period_id)
├── transaction_type (VARCHAR(20)) -- 'MANUAL', 'RECURRING', 'ADJUSTMENT', 'CLOSING', 'BUSINESS'
├── source_system (VARCHAR(50)) -- 'GL', 'AP', 'AR', 'PAYROLL', etc.
├── source_transaction_id (BIGINT, FK -> BUSINESS_TRANSACTIONS.business_transaction_id)
├── source_transaction_type (VARCHAR(10)) -- 'SO', 'PO', 'CI', 'VB', etc.
├── description (TEXT)
├── reference_number (VARCHAR(100)) -- External document reference
├── base_currency_code (CHAR(3), NOT NULL)
├── total_debit_amount (DECIMAL(18,4), NOT NULL)
├── total_credit_amount (DECIMAL(18,4), NOT NULL)
├── status (VARCHAR(20)) -- 'DRAFT', 'POSTED', 'REVERSED'
├── recurring_template_id (BIGINT, FK -> GL_RECURRING_TEMPLATES.template_id)
├── reversed_by_transaction_id (BIGINT, FK -> GL_TRANSACTIONS.transaction_id)
├── reversal_reason (TEXT)
├── auto_generated (BOOLEAN, DEFAULT FALSE) -- True if generated from business transaction
├── created_by (INT, FK -> USERS.user_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
├── modified_by (INT, FK -> USERS.user_id)
├── modified_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE)
├── posted_by (INT, FK -> USERS.user_id)
├── posted_date (TIMESTAMP)
└── version_number (INT, DEFAULT 1)
```

### 9. Transaction Lines Table (GL_TRANSACTION_LINES)

```sql
GL_POSTING_RULES
├── rule_id (BIGINT, PK, AUTO_INCREMENT)
├── transaction_type_id (INT, FK -> TRANSACTION_TYPES.transaction_type_id)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id)
├── rule_name (VARCHAR(100), NOT NULL)
├── sequence_number (INT, DEFAULT 10) -- Order of rule execution
├── line_type (VARCHAR(20)) -- 'ITEM', 'TAX', 'DISCOUNT', 'SHIPPING', 'ALL'
├── condition_sql (TEXT) -- SQL WHERE clause for when rule applies
├── debit_account_id (INT, FK -> ACCOUNTS.account_id)
├── credit_account_id (INT, FK -> ACCOUNTS.account_id)
├── amount_formula (VARCHAR(500)) -- Formula for calculating amount
├── description_template (VARCHAR(200)) -- Template for GL line description
├── is_active (BOOLEAN, DEFAULT TRUE)
├── effective_date (DATE, NOT NULL)
├── expiration_date (DATE)
├── created_by (INT, FK -> USERS.user_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── modified_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE)
```

### 16. Payment Terms (PAYMENT_TERMS)

```sql
PAYMENT_TERMS
├── terms_id (INT, PK, AUTO_INCREMENT)
├── terms_code (VARCHAR(20), UNIQUE, NOT NULL) -- 'NET30', '2/10NET30'
├── terms_name (VARCHAR(100), NOT NULL)
├── discount_percent (DECIMAL(5,2), DEFAULT 0)
├── discount_days (INT, DEFAULT 0)
├── net_days (INT, NOT NULL)
├── is_active (BOOLEAN, DEFAULT TRUE)
└── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### 17. Tax Codes (TAX_CODES)

```sql
TAX_CODES
├── tax_code_id (INT, PK, AUTO_INCREMENT)
├── tax_code (VARCHAR(20), UNIQUE, NOT NULL)
├── tax_name (VARCHAR(100), NOT NULL)
├── tax_rate (DECIMAL(8,5), NOT NULL)
├── tax_account_id (INT, FK -> ACCOUNTS.account_id) -- GL account for tax
├── tax_agency_id (INT, FK -> VENDORS.vendor_id) -- Tax authority
├── is_active (BOOLEAN, DEFAULT TRUE)
├── effective_date (DATE, NOT NULL)
├── expiration_date (DATE)
└── jurisdiction (VARCHAR(100)) -- State, country, etc.
```

## Business Transaction Workflows

## Business Transaction Workflows

## Business Transaction Workflows

### Complete Pre-Sales to Delivery Flow

```
1. RFQ Process (RFQ) → Status: 'PUBLISHED'
   ├── Vendor qualification and proposal submission
   ├── Proposal evaluation and scoring
   ├── Vendor selection and award notification
   └── No GL impact (procurement process only)

2. Contract Negotiation (CT) → Status: 'ACTIVE'
   ├── Master Service Agreement establishment
   ├── Terms, rates, and SLA definition
   ├── Renewal and termination clauses
   └── Optional GL impact (commitment accounting)

3. Opportunity (OP) → Status: 'QUALIFIED'
   ├── Lead qualification and pipeline management
   ├── Activity tracking and follow-ups
   ├── Competitor analysis and win probability
   └── No GL impact (CRM function only)

4. Estimate (ES) from Opportunity
   ├── Detailed pricing and service proposals
   ├── Activity-based costing and margin analysis
   ├── Resource allocation and timeline estimates
   └── No GL impact (proposal only)

5. Sales Order (SO) from Estimate
   ├── Customer acceptance of estimate
   ├── Project initiation and resource assignment
   └── Optional GL impact (commitment accounting)

6. Project Execution with Time Tracking
   ├── Time entries with activity codes
   ├── Expense tracking and approval workflows
   ├── WIP (Work in Progress) accumulation
   └── GL Impact: DR WIP, CR Payroll/Expenses

7. Customer Invoice (CI) from Project/SO
   ├── DR: Accounts Receivable
   ├── CR: Revenue (by activity code)
   ├── DR: Cost of Revenue
   └── CR: WIP (clear accumulated costs)

8. Customer Payment (CP) against CI
   ├── DR: Cash/Bank Account
   ├── CR: Accounts Receivable
   └── Discount handling if applicable
```

### Subscription Revenue Recognition Flow

```
1. Subscription Setup (SS) → Status: 'ACTIVE'
   ├── Customer onboarding and service activation
   ├── Billing schedule establishment
   └── No GL impact (setup only)

2. Recurring Subscription Invoice (SI)
   ├── DR: Accounts Receivable
   ├── CR: Deferred Revenue (full amount)
   └── Monthly recognition: DR Deferred Revenue, CR Revenue

3. Subscription Changes (SC) - Upgrades/Downgrades
   ├── Proration calculations for mid-cycle changes
   ├── Adjustment invoices or credits
   └── Deferred revenue adjustments

4. Subscription Cancellation (SX)
   ├── Final billing period calculations
   ├── Remaining deferred revenue recognition
   └── Cancellation fee processing if applicable
```

### Purchase Order to Payment Flow

```
1. Purchase Order (PO) → Status: 'APPROVED'
   └── Optional: DR/CR Encumbrance accounts

2. Item Receipt (IR) from PO
   ├── DR: Inventory (or Expense if service)
   └── CR: Accrued Payables

3. Vendor Bill (VB) from PO/IR
   ├── DR: Expense/Inventory (difference from IR)
   ├── CR: Accounts Payable
   └── CR: Accrued Payables (reverse IR)

4. Bill Payment (BP) against VB
   ├── DR: Accounts Payable
   ├── CR: Cash/Bank Account
   └── Discount handling if applicable

5. Bill Credit (BC) against VB
   ├── DR: Accounts Payable
   └── CR: Expense/Inventory
```

## Sample GL Posting Rule Configurations

### Customer Invoice Posting Rules

```sql
-- Revenue Recognition Rule
INSERT INTO GL_POSTING_RULES VALUES (
    1, 'CI', 1, 'Revenue Recognition', 10, 'ITEM',
    'line_type = "ITEM" AND item_type = "INVENTORY"',
    NULL, 'revenue_account_id', 
    'total_line_amount',
    'Revenue - {item_name}',
    TRUE, '2025-01-01', NULL
);

-- Accounts Receivable Rule  
INSERT INTO GL_POSTING_RULES VALUES (
    2, 'CI', 1, 'Accounts Receivable', 5, 'ALL',
    '1=1', -- Always applies
    'ar_account_id', NULL,
    'total_amount',
    'A/R - Customer Invoice {transaction_number}',
    TRUE, '2025-01-01', NULL
);

-- Cost of Goods Sold Rule
INSERT INTO GL_POSTING_RULES VALUES (
    3, 'CI', 1, 'COGS Recognition', 15, 'ITEM',
    'line_type = "ITEM" AND item_type = "INVENTORY"',
    'cogs_account_id', 'inventory_account_id',
    'cost_amount',
    'COGS - {item_name}',
    TRUE, '2025-01-01', NULL
);
```

### Vendor Bill Posting Rules

```sql
-- Expense Recognition Rule
INSERT INTO GL_POSTING_RULES VALUES (
    4, 'VB', 1, 'Expense Recognition', 10, 'ITEM',
    'line_type IN ("ITEM", "SERVICE")',
    'expense_account_id', NULL,
    'total_line_amount',
    'Expense - {description}',
    TRUE, '2025-01-01', NULL
);

-- Accounts Payable Rule
INSERT INTO GL_POSTING_RULES VALUES (
    5, 'VB', 1, 'Accounts Payable', 5, 'ALL',
    '1=1',
    NULL, 'ap_account_id',
    'total_amount',
    'A/P - Vendor Bill {transaction_number}',
    TRUE, '2025-01-01', NULL
);
```

## Enhanced Performance Strategy

### Additional Indexes for Business Transactions

```sql
-- Business transaction lookup indexes
CREATE INDEX idx_biz_trans_type_date ON BUSINESS_TRANSACTIONS(transaction_type_id, transaction_date);
CREATE INDEX idx_biz_trans_entity ON BUSINESS_TRANSACTIONS(entity_id, entity_type, status);
CREATE INDEX idx_biz_trans_parent ON BUSINESS_TRANSACTIONS(parent_transaction_id);
CREATE INDEX idx_biz_trans_gl ON BUSINESS_TRANSACTIONS(gl_transaction_id);

-- Transaction relationships for audit trails
CREATE INDEX idx_trans_rel_parent ON TRANSACTION_RELATIONSHIPS(parent_transaction_id);
CREATE INDEX idx_trans_rel_child ON TRANSACTION_RELATIONSHIPS(child_transaction_id);

-- Business transaction lines
CREATE INDEX idx_biz_lines_item ON BUSINESS_TRANSACTION_LINES(item_id, business_transaction_id);
CREATE INDEX idx_biz_lines_account ON BUSINESS_TRANSACTION_LINES(account_id);
```

## Sales Pipeline and CRM Views

## Project Management and Activity-Based Costing Views

### Project Profitability Analysis

```sql
-- Project Performance Dashboard
CREATE VIEW v_project_profitability AS
SELECT 
    p.project_id,
    p.project_number,
    p.project_name,
    p.customer_id,
    p.project_status,
    p.budget_amount,
    p.estimated_hours,
    -- Time and Expense Totals
    COALESCE(SUM(CASE WHEN btl.line_type = 'TIME' THEN btl.hours_worked ELSE 0 END), 0) as actual_hours,
    COALESCE(SUM(CASE WHEN btl.line_type = 'TIME' THEN btl.cost_amount ELSE 0 END), 0) as labor_cost,
    COALESCE(SUM(CASE WHEN btl.line_type = 'EXPENSE' THEN btl.cost_amount ELSE 0 END), 0) as expense_cost,
    COALESCE(SUM(btl.cost_amount), 0) as total_cost,
    -- Billing Totals
    COALESCE(billing.total_billed, 0) as total_billed,
    COALESCE(billing.total_collected, 0) as total_collected,
    -- Profitability Calculations
    COALESCE(billing.total_billed, 0) - COALESCE(SUM(btl.cost_amount), 0) as gross_profit,
    CASE 
        WHEN COALESCE(billing.total_billed, 0) > 0 THEN
            ROUND(((COALESCE(billing.total_billed, 0) - COALESCE(SUM(btl.cost_amount), 0)) / billing.total_billed) * 100, 2)
        ELSE 0
    END as gross_margin_percent,
    -- Budget Analysis
    CASE 
        WHEN p.budget_amount > 0 THEN
            ROUND((COALESCE(SUM(btl.cost_amount), 0) / p.budget_amount) * 100, 2)
        ELSE 0
    END as budget_consumed_percent,
    CASE 
        WHEN p.estimated_hours > 0 THEN
            ROUND((COALESCE(SUM(CASE WHEN btl.line_type = 'TIME' THEN btl.hours_worked ELSE 0 END), 0) / p.estimated_hours) * 100, 2)
        ELSE 0
    END as hours_consumed_percent
FROM PROJECTS p
LEFT JOIN BUSINESS_TRANSACTION_LINES btl ON p.project_id = btl.project_id
    AND btl.billable_flag = TRUE
LEFT JOIN (
    SELECT 
        project_id,
        SUM(total_amount) as total_billed,
        SUM(CASE WHEN bt.status = 'PAID' THEN bt.total_amount ELSE 0 END) as total_collected
    FROM BUSINESS_TRANSACTIONS bt
    JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
    WHERE tt.type_code = 'CI' AND bt.project_id IS NOT NULL
    GROUP BY project_id
) billing ON p.project_id = billing.project_id
GROUP BY p.project_id, p.project_number, p.project_name, p.customer_id, 
         p.project_status, p.budget_amount, p.estimated_hours,
         billing.total_billed, billing.total_collected
ORDER BY gross_profit DESC;
```

### Activity Code Performance Analysis

```sql
-- Activity Code Utilization and Profitability
CREATE VIEW v_activity_performance AS
SELECT 
    ac.activity_code,
    ac.activity_name,
    ac.activity_category,
    ac.default_billing_rate,
    ac.default_cost_rate,
    -- Usage Statistics
    COUNT(DISTINCT btl.business_transaction_id) as transaction_count,
    COUNT(DISTINCT btl.employee_id) as unique_employees,
    COUNT(DISTINCT btl.project_id) as unique_projects,
    -- Time and Financial Totals
    SUM(btl.hours_worked) as total_hours,
    AVG(btl.billing_rate) as avg_billing_rate,
    SUM(btl.line_amount) as total_billed_amount,
    SUM(btl.cost_amount) as total_cost_amount,
    -- Profitability
    SUM(btl.line_amount) - SUM(btl.cost_amount) as gross_profit,
    CASE 
        WHEN SUM(btl.line_amount) > 0 THEN
            ROUND(((SUM(btl.line_amount) - SUM(btl.cost_amount)) / SUM(btl.line_amount)) * 100, 2)
        ELSE 0
    END as gross_margin_percent,
    -- Utilization Analysis
    CASE 
        WHEN SUM(btl.hours_worked) > 0 THEN
            ROUND(SUM(btl.line_amount) / SUM(btl.hours_worked), 2)
        ELSE 0
    END as revenue_per_hour,
    CASE 
        WHEN SUM(btl.hours_worked) > 0 THEN
            ROUND(SUM(btl.cost_amount) / SUM(btl.hours_worked), 2)
        ELSE 0
    END as cost_per_hour
FROM ACTIVITY_CODES ac
LEFT JOIN BUSINESS_TRANSACTION_LINES btl ON ac.activity_code_id = btl.activity_code_id
    AND btl.billable_flag = TRUE
WHERE ac.is_active = TRUE
GROUP BY ac.activity_code_id, ac.activity_code, ac.activity_name, 
         ac.activity_category, ac.default_billing_rate, ac.default_cost_rate
ORDER BY total_billed_amount DESC;
```

### Subscription Revenue Management Views

```sql
-- Monthly Recurring Revenue (MRR) Analysis
CREATE VIEW v_mrr_analysis AS
SELECT 
    DATE_FORMAT(s.next_billing_date, '%Y-%m') as billing_month,
    s.subscription_status,
    COUNT(*) as subscription_count,
    SUM(s.mrr_amount) as total_mrr,
    SUM(CASE WHEN s.created_date >= DATE_SUB(s.next_billing_date, INTERVAL 1 MONTH) THEN s.mrr_amount ELSE 0 END) as new_mrr,
    SUM(CASE WHEN s.cancellation_date IS NOT NULL AND s.cancellation_date >= DATE_SUB(s.next_billing_date, INTERVAL 1 MONTH) THEN s.mrr_amount ELSE 0 END) as churned_mrr,
    -- Expansion/Contraction tracking would require subscription change history
    AVG(s.mrr_amount) as avg_mrr_per_customer,
    -- Customer metrics
    COUNT(DISTINCT s.customer_id) as unique_customers
FROM SUBSCRIPTIONS s
WHERE s.subscription_status = 'ACTIVE'
GROUP BY DATE_FORMAT(s.next_billing_date, '%Y-%m'), s.subscription_status
ORDER BY billing_month DESC;
```

### Contract Management Views

```sql
-- Contract Renewal Pipeline
CREATE VIEW v_contract_renewals AS
SELECT 
    c.contract_id,
    c.contract_number,
    c.contract_name,
    c.customer_id,
    c.end_date,
    c.total_contract_value,
    c.auto_renew,
    c.renewal_notice_date,
    DATEDIFF(c.end_date, CURRENT_DATE) as days_to_expiration,
    CASE 
        WHEN c.end_date <= CURRENT_DATE THEN 'EXPIRED'
        WHEN DATEDIFF(c.end_date, CURRENT_DATE) <= 30 THEN 'CRITICAL'
        WHEN DATEDIFF(c.end_date, CURRENT_DATE) <= 90 THEN 'WARNING'
        ELSE 'NORMAL'
    END as renewal_urgency,
    e.employee_name as contract_manager,
    -- Revenue at risk
    COALESCE(sub_revenue.monthly_revenue, 0) as monthly_revenue_at_risk
FROM CONTRACTS c
LEFT JOIN EMPLOYEES e ON c.contract_manager_id = e.employee_id
LEFT JOIN (
    SELECT 
        contract_id,
        SUM(mrr_amount) as monthly_revenue
    FROM SUBSCRIPTIONS 
    WHERE subscription_status = 'ACTIVE'
    GROUP BY contract_id
) sub_revenue ON c.contract_id = sub_revenue.contract_id
WHERE c.contract_status = 'ACTIVE'
AND c.end_date IS NOT NULL
ORDER BY days_to_expiration ASC, total_contract_value DESC;
```

### RFQ Management and Vendor Analysis

```sql
-- RFQ Response Tracking
CREATE VIEW v_rfq_status AS
SELECT 
    rfq.rfq_id,
    rfq.rfq_number,
    rfq.rfq_title,
    rfq.customer_id,
    rfq.estimated_value,
    rfq.response_due_date,
    rfq.rfq_status,
    DATEDIFF(rfq.response_due_date, CURRENT_DATE) as days_until_due,
    COUNT(responses.vendor_id) as response_count,
    AVG(responses.proposal_amount) as avg_proposal_amount,
    MIN(responses.proposal_amount) as lowest_proposal,
    MAX(responses.proposal_amount) as highest_proposal,
    CASE 
        WHEN rfq.response_due_date < CURRENT_DATE AND rfq.rfq_status = 'PUBLISHED' THEN 'OVERDUE'
        WHEN DATEDIFF(rfq.response_due_date, CURRENT_DATE) <= 7 AND rfq.rfq_status = 'PUBLISHED' THEN 'DUE_SOON'
        ELSE rfq.rfq_status
    END as current_status
FROM RFQ_REQUESTS rfq
LEFT JOIN (
    -- This would join to a vendor responses table if implemented
    SELECT rfq_id, vendor_id, proposal_amount 
    FROM rfq_vendor_responses -- Hypothetical table
) responses ON rfq.rfq_id = responses.rfq_id
GROUP BY rfq.rfq_id, rfq.rfq_number, rfq.rfq_title, rfq.customer_id,
         rfq.estimated_value, rfq.response_due_date, rfq.rfq_status
ORDER BY days_until_due ASC;
```

```sql
-- Opportunity Pipeline by Stage
CREATE VIEW v_sales_pipeline AS
SELECT 
    bt.sales_stage,
    COUNT(*) as opportunity_count,
    SUM(bt.total_amount) as total_pipeline_value,
    AVG(bt.probability) as avg_probability,
    SUM(bt.total_amount * bt.probability / 100) as weighted_pipeline_value,
    AVG(DATEDIFF(bt.expected_close_date, bt.transaction_date)) as avg_sales_cycle_days
FROM BUSINESS_TRANSACTIONS bt
JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code = 'OP'
AND bt.status NOT IN ('CLOSED_LOST', 'CANCELLED')
AND bt.sales_stage IS NOT NULL
GROUP BY bt.sales_stage
ORDER BY 
    CASE bt.sales_stage
        WHEN 'LEAD' THEN 1
        WHEN 'QUALIFIED' THEN 2
        WHEN 'PROPOSAL' THEN 3
        WHEN 'NEGOTIATION' THEN 4
        WHEN 'CLOSED_WON' THEN 5
    END;
```

### Sales Performance Tracking

```sql
-- Sales Rep Performance View
CREATE VIEW v_sales_rep_performance AS
SELECT 
    e.employee_id,
    e.employee_name as sales_rep_name,
    COUNT(CASE WHEN tt.type_code = 'OP' THEN 1 END) as total_opportunities,
    COUNT(CASE WHEN tt.type_code = 'OP' AND bt.sales_stage = 'CLOSED_WON' THEN 1 END) as won_opportunities,
    COUNT(CASE WHEN tt.type_code = 'ES' THEN 1 END) as estimates_created,
    COUNT(CASE WHEN tt.type_code = 'SO' THEN 1 END) as orders_closed,
    COALESCE(ROUND(
        COUNT(CASE WHEN tt.type_code = 'OP' AND bt.sales_stage = 'CLOSED_WON' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN tt.type_code = 'OP' AND bt.sales_stage IN ('CLOSED_WON', 'CLOSED_LOST') THEN 1 END), 0), 2
    ), 0) as win_rate_percent,
    SUM(CASE WHEN tt.type_code = 'OP' AND bt.sales_stage = 'CLOSED_WON' THEN bt.total_amount ELSE 0 END) as total_won_value,
    SUM(CASE WHEN tt.type_code = 'SO' THEN bt.total_amount ELSE 0 END) as total_sales_value
FROM EMPLOYEES e
LEFT JOIN BUSINESS_TRANSACTIONS bt ON e.employee_id = bt.sales_rep_id
LEFT JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE e.department = 'SALES' OR bt.business_transaction_id IS NOT NULL
GROUP BY e.employee_id, e.employee_name
ORDER BY total_sales_value DESC;
```

### Estimate to Order Conversion Tracking

```sql
-- Estimate Conversion Analysis
CREATE VIEW v_estimate_conversion AS
SELECT 
    est.business_transaction_id as estimate_id,
    est.transaction_number as estimate_number,
    est.entity_id as customer_id,
    est.total_amount as estimate_value,
    est.estimate_valid_until,
    est.transaction_date as estimate_date,
    so.business_transaction_id as sales_order_id,
    so.transaction_number as sales_order_number,
    so.total_amount as order_value,
    so.transaction_date as order_date,
    DATEDIFF(so.transaction_date, est.transaction_date) as days_to_convert,
    CASE 
        WHEN so.business_transaction_id IS NOT NULL THEN 'CONVERTED'
        WHEN est.estimate_valid_until < CURRENT_DATE THEN 'EXPIRED'
        ELSE 'OPEN'
    END as conversion_status,
    CASE 
        WHEN so.business_transaction_id IS NOT NULL THEN 
            ROUND((so.total_amount / est.total_amount) * 100, 2)
        ELSE NULL
    END as value_conversion_percent
FROM BUSINESS_TRANSACTIONS est
JOIN TRANSACTION_TYPES est_tt ON est.transaction_type_id = est_tt.transaction_type_id
LEFT JOIN TRANSACTION_RELATIONSHIPS rel ON est.business_transaction_id = rel.parent_transaction_id
    AND rel.relationship_type = 'FULFILLMENT'
LEFT JOIN BUSINESS_TRANSACTIONS so ON rel.child_transaction_id = so.business_transaction_id
LEFT JOIN TRANSACTION_TYPES so_tt ON so.transaction_type_id = so_tt.transaction_type_id
    AND so_tt.type_code = 'SO'
WHERE est_tt.type_code = 'ES'
ORDER BY est.transaction_date DESC;
```

### Lead Source ROI Analysis

```sql
-- Lead Source Performance
CREATE VIEW v_lead_source_roi AS
SELECT 
    ls.source_name,
    ls.source_category,
    COUNT(bt.business_transaction_id) as total_opportunities,
    COUNT(CASE WHEN bt.sales_stage = 'CLOSED_WON' THEN 1 END) as won_opportunities,
    SUM(CASE WHEN bt.sales_stage = 'CLOSED_WON' THEN bt.total_amount ELSE 0 END) as total_revenue,
    COALESCE(ROUND(
        COUNT(CASE WHEN bt.sales_stage = 'CLOSED_WON' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(bt.business_transaction_id), 0), 2
    ), 0) as conversion_rate_percent,
    ls.cost_per_lead,
    CASE 
        WHEN ls.cost_per_lead > 0 AND COUNT(bt.business_transaction_id) > 0 THEN
            ROUND((SUM(CASE WHEN bt.sales_stage = 'CLOSED_WON' THEN bt.total_amount ELSE 0 END) - 
                   (ls.cost_per_lead * COUNT(bt.business_transaction_id))) / 
                  (ls.cost_per_lead * COUNT(bt.business_transaction_id)) * 100, 2)
        ELSE NULL
    END as roi_percent
FROM LEAD_SOURCES ls
LEFT JOIN BUSINESS_TRANSACTIONS bt ON ls.source_code = bt.lead_source
JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code = 'OP'
GROUP BY ls.lead_source_id, ls.source_name, ls.source_category, ls.cost_per_lead
ORDER BY total_revenue DESC;
```

### Activity Tracking and Follow-up Management

```sql
-- Overdue Follow-ups View
CREATE VIEW v_overdue_followups AS
SELECT 
    sa.activity_id,
    bt.transaction_number as opportunity_number,
    bt.entity_id as customer_id,
    sa.next_action,
    sa.next_action_date,
    DATEDIFF(CURRENT_DATE, sa.next_action_date) as days_overdue,
    e.employee_name as sales_rep_name,
    bt.total_amount as opportunity_value,
    bt.sales_stage,
    bt.probability
FROM SALES_ACTIVITIES sa
JOIN BUSINESS_TRANSACTIONS bt ON sa.opportunity_id = bt.business_transaction_id
JOIN EMPLOYEES e ON sa.sales_rep_id = e.employee_id
JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code = 'OP'
AND sa.next_action_date < CURRENT_DATE
AND sa.next_action IS NOT NULL
AND bt.sales_stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')
ORDER BY days_overdue DESC, opportunity_value DESC;
```

```sql
-- Open Sales Orders View
CREATE VIEW v_open_sales_orders AS
SELECT 
    bt.business_transaction_id,
    bt.transaction_number,
    bt.entity_id as customer_id,
    bt.total_amount,
    bt.transaction_date,
    COALESCE(SUM(rel.applied_amount), 0) as invoiced_amount,
    bt.total_amount - COALESCE(SUM(rel.applied_amount), 0) as open_amount
FROM BUSINESS_TRANSACTIONS bt
LEFT JOIN TRANSACTION_RELATIONSHIPS rel ON bt.business_transaction_id = rel.parent_transaction_id
    AND rel.relationship_type = 'FULFILLMENT'
JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code = 'SO' 
AND bt.status NOT IN ('CANCELLED', 'CLOSED')
GROUP BY bt.business_transaction_id;

-- Aged Receivables View
CREATE VIEW v_aged_receivables AS
SELECT 
    bt.entity_id as customer_id,
    bt.business_transaction_id,
    bt.transaction_number,
    bt.total_amount,
    bt.due_date,
    DATEDIFF(CURRENT_DATE, bt.due_date) as days_overdue,
    bt.total_amount - COALESCE(SUM(rel.applied_amount), 0) as outstanding_amount,
    CASE 
        WHEN DATEDIFF(CURRENT_DATE, bt.due_date) <= 0 THEN 'CURRENT'
        WHEN DATEDIFF(CURRENT_DATE, bt.due_date) <= 30 THEN '1-30 DAYS'
        WHEN DATEDIFF(CURRENT_DATE, bt.due_date) <= 60 THEN '31-60 DAYS'
        WHEN DATEDIFF(CURRENT_DATE, bt.due_date) <= 90 THEN '61-90 DAYS'
        ELSE 'OVER 90 DAYS'
    END as aging_bucket
FROM BUSINESS_TRANSACTIONS bt
LEFT JOIN TRANSACTION_RELATIONSHIPS rel ON bt.business_transaction_id = rel.parent_transaction_id
    AND rel.relationship_type = 'PAYMENT'
JOIN TRANSACTION_TYPES tt ON bt.transaction_type_id = tt.transaction_type_id
WHERE tt.type_code = 'CI'
AND bt.status = 'POSTED'
GROUP BY bt.business_transaction_id
HAVING outstanding_amount > 0;
```

```sql
GL_TRANSACTION_LINES
├── line_id (BIGINT, PK, AUTO_INCREMENT)
├── transaction_id (BIGINT, FK -> GL_TRANSACTIONS.transaction_id)
├── line_number (INT, NOT NULL) -- Sequence within transaction
├── account_id (INT, FK -> ACCOUNTS.account_id, NOT NULL)
├── class_id (INT, FK -> CLASSES.class_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id)
├── debit_amount (DECIMAL(18,4), DEFAULT 0)
├── credit_amount (DECIMAL(18,4), DEFAULT 0)
├── currency_code (CHAR(3), NOT NULL)
├── exchange_rate (DECIMAL(12,6), DEFAULT 1)
├── base_debit_amount (DECIMAL(18,4), DEFAULT 0) -- Converted to base currency
├── base_credit_amount (DECIMAL(18,4), DEFAULT 0) -- Converted to base currency
├── description (TEXT)
├── reference_1 (VARCHAR(100)) -- Additional reference fields
├── reference_2 (VARCHAR(100))
├── project_id (INT, FK -> PROJECTS.project_id) -- Optional project tracking
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── CONSTRAINT chk_debit_credit CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
```

### 10. Account Balances Table (GL_ACCOUNT_BALANCES)

```sql
GL_ACCOUNT_BALANCES
├── balance_id (BIGINT, PK, AUTO_INCREMENT)
├── account_id (INT, FK -> ACCOUNTS.account_id, NOT NULL)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id, NOT NULL)
├── period_id (INT, FK -> ACCOUNTING_PERIODS.period_id, NOT NULL)
├── class_id (INT, FK -> CLASSES.class_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── currency_code (CHAR(3), NOT NULL)
├── beginning_balance_debit (DECIMAL(18,4), DEFAULT 0)
├── beginning_balance_credit (DECIMAL(18,4), DEFAULT 0)
├── period_debit_amount (DECIMAL(18,4), DEFAULT 0)
├── period_credit_amount (DECIMAL(18,4), DEFAULT 0)
├── ending_balance_debit (DECIMAL(18,4), DEFAULT 0)
├── ending_balance_credit (DECIMAL(18,4), DEFAULT 0)
├── ytd_debit_amount (DECIMAL(18,4), DEFAULT 0)
├── ytd_credit_amount (DECIMAL(18,4), DEFAULT 0)
├── base_beginning_balance_debit (DECIMAL(18,4), DEFAULT 0)
├── base_beginning_balance_credit (DECIMAL(18,4), DEFAULT 0)
├── base_period_debit_amount (DECIMAL(18,4), DEFAULT 0)
├── base_period_credit_amount (DECIMAL(18,4), DEFAULT 0)
├── base_ending_balance_debit (DECIMAL(18,4), DEFAULT 0)
├── base_ending_balance_credit (DECIMAL(18,4), DEFAULT 0)
├── base_ytd_debit_amount (DECIMAL(18,4), DEFAULT 0)
├── base_ytd_credit_amount (DECIMAL(18,4), DEFAULT 0)
├── last_updated (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE)
└── UNIQUE KEY uk_balance (account_id, subsidiary_id, period_id, class_id, department_id, location_id, currency_code)
```

### 11. Accounting Periods Table (ACCOUNTING_PERIODS)

```sql
ACCOUNTING_PERIODS
├── period_id (INT, PK, AUTO_INCREMENT)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id, NOT NULL)
├── period_name (VARCHAR(50), NOT NULL) -- '2025-01', 'Q1-2025', etc.
├── fiscal_year (CHAR(4), NOT NULL)
├── period_number (INT, NOT NULL) -- 1-12 for months, 1-4 for quarters
├── start_date (DATE, NOT NULL)
├── end_date (DATE, NOT NULL)
├── period_type (VARCHAR(20)) -- 'MONTHLY', 'QUARTERLY', 'YEARLY'
├── status (VARCHAR(20)) -- 'OPEN', 'CLOSED', 'LOCKED'
├── closed_by (INT, FK -> USERS.user_id)
├── closed_date (TIMESTAMP)
├── is_adjustment_period (BOOLEAN, DEFAULT FALSE)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── UNIQUE KEY uk_period (subsidiary_id, fiscal_year, period_number, period_type)
```

### 12. Recurring Transaction Templates (GL_RECURRING_TEMPLATES)

```sql
GL_RECURRING_TEMPLATES
├── template_id (BIGINT, PK, AUTO_INCREMENT)
├── template_name (VARCHAR(100), NOT NULL)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id)
├── description (TEXT)
├── frequency (VARCHAR(20)) -- 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'WEEKLY'
├── start_date (DATE, NOT NULL)
├── end_date (DATE)
├── next_run_date (DATE, NOT NULL)
├── last_run_date (DATE)
├── is_active (BOOLEAN, DEFAULT TRUE)
├── auto_post (BOOLEAN, DEFAULT FALSE)
├── created_by (INT, FK -> USERS.user_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── modified_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE)
```

### 13. Recurring Template Lines (GL_RECURRING_TEMPLATE_LINES)

```sql
GL_RECURRING_TEMPLATE_LINES
├── template_line_id (BIGINT, PK, AUTO_INCREMENT)
├── template_id (BIGINT, FK -> GL_RECURRING_TEMPLATES.template_id)
├── line_number (INT, NOT NULL)
├── account_id (INT, FK -> ACCOUNTS.account_id, NOT NULL)
├── class_id (INT, FK -> CLASSES.class_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── debit_amount (DECIMAL(18,4), DEFAULT 0)
├── credit_amount (DECIMAL(18,4), DEFAULT 0)
├── currency_code (CHAR(3), NOT NULL)
├── description (TEXT)
├── reference_1 (VARCHAR(100))
└── reference_2 (VARCHAR(100))
```

### 14. Budget Data (GL_BUDGETS)

```sql
GL_BUDGETS
├── budget_id (BIGINT, PK, AUTO_INCREMENT)
├── budget_name (VARCHAR(100), NOT NULL)
├── subsidiary_id (INT, FK -> SUBSIDIARIES.subsidiary_id, NOT NULL)
├── fiscal_year (CHAR(4), NOT NULL)
├── version_number (INT, DEFAULT 1)
├── status (VARCHAR(20)) -- 'DRAFT', 'APPROVED', 'ACTIVE'
├── created_by (INT, FK -> USERS.user_id)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
├── approved_by (INT, FK -> USERS.user_id)
└── approved_date (TIMESTAMP)
```

### 15. Budget Line Items (GL_BUDGET_LINES)

```sql
GL_BUDGET_LINES
├── budget_line_id (BIGINT, PK, AUTO_INCREMENT)
├── budget_id (BIGINT, FK -> GL_BUDGETS.budget_id)
├── account_id (INT, FK -> ACCOUNTS.account_id, NOT NULL)
├── class_id (INT, FK -> CLASSES.class_id)
├── department_id (INT, FK -> DEPARTMENTS.department_id)
├── location_id (INT, FK -> LOCATIONS.location_id)
├── period_id (INT, FK -> ACCOUNTING_PERIODS.period_id, NOT NULL)
├── budget_amount (DECIMAL(18,4), NOT NULL)
├── currency_code (CHAR(3), NOT NULL)
├── base_budget_amount (DECIMAL(18,4), NOT NULL)
├── notes (TEXT)
└── UNIQUE KEY uk_budget_line (budget_id, account_id, class_id, department_id, location_id, period_id)
```

### 16. Exchange Rates (EXCHANGE_RATES)

```sql
EXCHANGE_RATES
├── rate_id (BIGINT, PK, AUTO_INCREMENT)
├── from_currency (CHAR(3), NOT NULL)
├── to_currency (CHAR(3), NOT NULL)
├── rate_date (DATE, NOT NULL)
├── rate_type (VARCHAR(20)) -- 'DAILY', 'AVERAGE', 'HISTORICAL'
├── exchange_rate (DECIMAL(12,6), NOT NULL)
├── created_date (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── UNIQUE KEY uk_exchange_rate (from_currency, to_currency, rate_date, rate_type)
```

### 17. Audit Trail (GL_AUDIT_TRAIL)

```sql
GL_AUDIT_TRAIL
├── audit_id (BIGINT, PK, AUTO_INCREMENT)
├── table_name (VARCHAR(50), NOT NULL)
├── record_id (BIGINT, NOT NULL) -- ID of the affected record
├── action_type (VARCHAR(20)) -- 'INSERT', 'UPDATE', 'DELETE'
├── field_name (VARCHAR(50))
├── old_value (TEXT)
├── new_value (TEXT)
├── user_id (INT, FK -> USERS.user_id, NOT NULL)
├── session_id (VARCHAR(100))
├── ip_address (VARCHAR(45))
├── timestamp (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
└── INDEX idx_audit_table_record (table_name, record_id)
```

## Chart of Accounts Structure Enhancement

Since you have a COA numbering system, enhance your ACCOUNTS table with these GAAP-specific fields:

```sql
-- Additional fields for ACCOUNTS table
ALTER TABLE ACCOUNTS ADD COLUMN (
    account_number VARCHAR(20) NOT NULL UNIQUE,
    account_category VARCHAR(50), -- 'ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES'
    account_subcategory VARCHAR(50), -- 'CURRENT_ASSETS', 'FIXED_ASSETS', etc.
    normal_balance VARCHAR(10), -- 'DEBIT' or 'CREDIT'
    financial_statement_line VARCHAR(100), -- Maps to specific FS line items
    is_control_account BOOLEAN DEFAULT FALSE,
    rollup_account_id INT, -- For account hierarchies
    gaap_classification VARCHAR(50), -- Specific GAAP classifications
    cash_flow_category VARCHAR(50) -- 'OPERATING', 'INVESTING', 'FINANCING'
);
```

## Performance Optimization Strategy

## Performance and Scalability Considerations

### Event Store Optimization

```sql
-- Partitioning Strategy for High Volume
-- Partition by month for time-series access patterns
CREATE TABLE EVENT_STORE_2025_01 PARTITION OF EVENT_STORE
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Separate hot/cold storage
-- Recent events (last 3 months) on fast SSD
-- Historical events on cheaper storage with compression

-- Read Replica Strategy
-- Event store writes go to primary
-- Projection rebuilds use read replicas
-- Reporting queries use read replicas
```

### Projection Management

```sql
-- Projection Checkpoints for Recovery
PROJECTION_CHECKPOINTS
├── checkpoint_id (UUID, PK)
├── projection_name (VARCHAR(100), NOT NULL)
├── last_processed_sequence (BIGINT, NOT NULL)
├── checkpoint_data (JSON) -- Snapshot for fast recovery
├── created_at (TIMESTAMP(6), DEFAULT CURRENT_TIMESTAMP(6))
└── INDEX idx_projection_latest (projection_name, created_at DESC)

-- Projection Rebuild Capability
-- Can rebuild any projection from event stream
-- Zero-downtime deployment of projection changes
-- A/B testing of projection logic
```

### Pub/Sub Architecture Benefits

```typescript
// Loose Coupling Example
// GL Core publishes events, doesn't know about subscribers

// When transaction posted:
events.publish('transaction.posted', {
  transactionId: 'TXN-001',
  amount: 1000,
  accountId: 'ACC-4000'
});

// Multiple subscribers can react:
// 1. Balance updater updates account balances
// 2. Report generator refreshes dashboards  
// 3. Analytics service updates metrics
// 4. Notification service sends alerts
// 5. Compliance service logs for SOX
// 6. Integration service syncs to external systems
```

## Implementation Roadmap

### Phase 1: Event Infrastructure (Weeks 1-4)
- Event store implementation
- Basic pub/sub messaging
- Core event types
- Outbox pattern for reliability

### Phase 2: Core GL Events (Weeks 5-8)  
- Transaction lifecycle events
- Account balance projections
- Basic audit capabilities
- GL posting automation

### Phase 3: Business Module Events (Weeks 9-12)
- AR/AP event implementations  
- Project management events
- Subscription billing events
- Contract management events

### Phase 4: Advanced Features (Weeks 13-16)
- Complex event workflows
- Advanced projections
- Performance optimization
- Comprehensive reporting

## Event-Driven Benefits Summary

### Superior Auditability
- **Complete History**: Every state change captured as immutable event
- **Temporal Queries**: "What was the state at any point in time?"
- **Causation Tracking**: Full chain of why changes occurred
- **Regulatory Compliance**: Built-in SOX/GAAP audit trails

### Scalability and Performance  
- **Independent Scaling**: Each app scales based on its specific load
- **Async Processing**: Heavy operations don't block user interactions
- **Read Model Optimization**: Each query optimized for its specific use case
- **Event Replay**: Rebuild any state from event history

### Development Velocity
- **Surgical Extensions**: Add new features without touching existing code
- **A/B Testing**: Deploy new business logic alongside existing
- **Zero-Downtime Deployments**: Update projections without service interruption
- **Debugging**: Complete trace of every business operation

### Business Intelligence
- **Real-time Analytics**: Events feed directly into BI systems
- **Behavioral Analysis**: Understand user patterns from event streams
- **Predictive Modeling**: Rich event history enables ML/AI
- **Custom Reporting**: Any business question answerable from events

This event-driven architecture transforms your GL system from a traditional database application into a modern, scalable, and auditable business platform that can adapt to changing requirements while maintaining financial integrity and compliance.

```sql
-- GL_TRANSACTIONS
CREATE INDEX idx_gl_trans_date_sub ON GL_TRANSACTIONS(transaction_date, subsidiary_id);
CREATE INDEX idx_gl_trans_period ON GL_TRANSACTIONS(period_id, status);
CREATE INDEX idx_gl_trans_source ON GL_TRANSACTIONS(source_system, posting_date);

-- GL_TRANSACTION_LINES  
CREATE INDEX idx_gl_lines_account_date ON GL_TRANSACTION_LINES(account_id, transaction_id);
CREATE INDEX idx_gl_lines_dimensions ON GL_TRANSACTION_LINES(class_id, department_id, location_id);

-- GL_ACCOUNT_BALANCES
CREATE INDEX idx_gl_bal_account_period ON GL_ACCOUNT_BALANCES(account_id, period_id);
CREATE INDEX idx_gl_bal_sub_period ON GL_ACCOUNT_BALANCES(subsidiary_id, period_id);
```

### Real-time Balance Updates

Implement triggers or stored procedures to update GL_ACCOUNT_BALANCES immediately upon transaction posting:

```sql
-- Example trigger structure (adapt to your RDBMS)
CREATE TRIGGER trg_update_balances 
AFTER INSERT ON GL_TRANSACTION_LINES
FOR EACH ROW
BEGIN
    -- Update current period balance
    -- Update YTD balances
    -- Handle currency conversion
END;
```

## Financial Statement Views

### Balance Sheet View

```sql
CREATE VIEW v_balance_sheet AS
SELECT 
    a.account_number,
    a.account_name,
    a.account_category,
    a.financial_statement_line,
    ab.subsidiary_id,
    ab.period_id,
    CASE 
        WHEN a.normal_balance = 'DEBIT' THEN ab.base_ending_balance_debit - ab.base_ending_balance_credit
        ELSE ab.base_ending_balance_credit - ab.base_ending_balance_debit 
    END as balance_amount
FROM ACCOUNTS a
JOIN GL_ACCOUNT_BALANCES ab ON a.account_id = ab.account_id
WHERE a.account_category IN ('ASSETS', 'LIABILITIES', 'EQUITY');
```

### Income Statement View

```sql
CREATE VIEW v_income_statement AS
SELECT 
    a.account_number,
    a.account_name,
    a.financial_statement_line,
    ab.subsidiary_id,
    ab.period_id,
    CASE 
        WHEN a.account_category = 'REVENUE' THEN ab.base_period_credit_amount - ab.base_period_debit_amount
        WHEN a.account_category = 'EXPENSES' THEN ab.base_period_debit_amount - ab.base_period_credit_amount
    END as period_amount,
    CASE 
        WHEN a.account_category = 'REVENUE' THEN ab.base_ytd_credit_amount - ab.base_ytd_debit_amount
        WHEN a.account_category = 'EXPENSES' THEN ab.base_ytd_debit_amount - ab.base_ytd_credit_amount
    END as ytd_amount
FROM ACCOUNTS a
JOIN GL_ACCOUNT_BALANCES ab ON a.account_id = ab.account_id
WHERE a.account_category IN ('REVENUE', 'EXPENSES');
```

### Cash Flow Statement Support

```sql
CREATE VIEW v_cash_flow_data AS
SELECT 
    a.account_number,
    a.account_name,
    a.cash_flow_category,
    tl.transaction_id,
    t.transaction_date,
    t.subsidiary_id,
    tl.base_debit_amount - tl.base_credit_amount as net_amount
FROM GL_TRANSACTION_LINES tl
JOIN GL_TRANSACTIONS t ON tl.transaction_id = t.transaction_id
JOIN ACCOUNTS a ON tl.account_id = a.account_id
WHERE a.cash_flow_category IS NOT NULL
AND t.status = 'POSTED';
```

## Data Retention and Archiving

For 1M+ monthly transactions, implement a data lifecycle strategy:

- **Active Data**: Current and prior fiscal year in primary tables
- **Archive Data**: Historical data in separate archive tables
- **Purge Strategy**: Legal retention requirements (typically 7 years)

## Security and Compliance

### SOX Compliance Features
- Immutable transaction records once posted
- Complete audit trail with user attribution
- Period locking prevents backdated entries
- Segregation of duties through user roles

### Data Integrity Constraints
- Transaction must balance (total debits = total credits)
- Period dates must fall within valid accounting periods
- Currency codes must be valid
- Account combinations must be active

## Implementation Recommendations

1. **Phase 1**: Core transaction processing (Transactions, Lines, Balances)
2. **Phase 2**: Reporting infrastructure (Periods, Views, Basic Reports)
3. **Phase 3**: Advanced features (Recurring, Budgets, Multi-currency)
4. **Phase 4**: Performance optimization and archiving

## Monitoring and Maintenance

- Daily balance reconciliation reports
- Monthly transaction volume analysis
- Quarterly performance review and index optimization
- Annual archive and purge processes

This data model provides a robust foundation for your GAAP-compliant general ledger system with the scalability and performance characteristics needed for high-volume transaction processing.