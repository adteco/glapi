# Client-to-Cash (C2C) Workflow

## Overview

The Client-to-Cash workflow provides end-to-end management of the client relationship lifecycle, from client onboarding through project execution, invoicing, payment collection, and bank reconciliation. This workflow integrates with the Order-to-Cash module and extends it with client-focused features including project time tracking, statement generation, and bank deposit reconciliation.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Clients     │────▶│    Projects     │────▶│  Time Tracking  │
│   (Customers)   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Estimates     │────▶│  Sales Orders   │────▶│    Invoices     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
        ┌───────────────────────────────────────────────┘
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Payments     │────▶│   Statements    │     │     Banking     │
│                 │     │                 │     │ Reconciliation  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Workflow Stages

### 1. Client Management

Clients are managed through the `/clients` page, which provides an alias to the existing Customer entity with client-focused terminology.

**Navigation:** Client to Cash → Clients

**Features:**
- List all clients with search and filtering
- Create new clients via dialog form
- View client details including contact info and billing address
- Edit client information
- Track client status (active, inactive, archived)

**TRPC Endpoints:**
- `customers.list` - List clients with pagination
- `customers.get` - Get client by ID
- `customers.create` - Create new client
- `customers.update` - Update client
- `customers.delete` - Delete client

### 2. Project Management

Projects track work performed for clients, supporting both time-and-materials and fixed-price billing models.

**Navigation:** Client to Cash → Projects

**Features:**
- Create and manage client projects
- Track project status and progress
- Associate team members with projects
- Link projects to estimates and contracts
- Budget tracking and variance analysis

**TRPC Endpoints:**
- `projects.list` - List projects with filtering
- `projects.get` - Get project details
- `projects.create` - Create new project
- `projects.update` - Update project
- `projects.getStats` - Get project statistics

### 3. Time Tracking

Time entries capture billable and non-billable work performed on projects.

**Navigation:** Client to Cash → Time Tracking

**Page:** `/projects/time`

**Features:**
- Record time entries with description and duration
- Categorize as billable or non-billable
- Entry types: Regular, Overtime, Holiday, PTO, Training, Administrative
- Weekly summary dashboard with statistics
- Approval workflow (Draft → Submitted → Approved)
- Filter by project, employee, date range
- Bulk actions for time entry management

**Time Entry States:**

| Status | Description |
|--------|-------------|
| `DRAFT` | Entry created, can be edited |
| `SUBMITTED` | Submitted for approval |
| `APPROVED` | Approved, ready for invoicing |
| `INVOICED` | Included on an invoice |

**TRPC Endpoints:**
- `timeEntries.list` - List time entries with filtering
- `timeEntries.create` - Create new time entry
- `timeEntries.update` - Update draft entry
- `timeEntries.delete` - Delete draft entry
- `timeEntries.submit` - Submit for approval
- `timeEntries.approve` - Approve entry
- `timeEntries.reject` - Reject entry
- `timeEntries.getSummaryByProject` - Get time summary by project

### 4. Estimates

Estimates provide quotes to clients before work begins.

**Navigation:** Client to Cash → Estimates

**Page:** `/transactions/sales/estimates`

**Features:**
- Create detailed estimates with line items
- Convert approved estimates to sales orders
- Track estimate status and expiration
- PDF generation for client delivery

### 5. Sales Orders

Sales orders formalize client agreements and track fulfillment.

**Navigation:** Client to Cash → Sales Orders

**Page:** `/transactions/sales/sales-orders`

**Features:**
- Create orders from estimates or directly
- Multi-level approval workflow
- Partial fulfillment tracking
- Invoice generation from orders

See [Order-to-Cash Documentation](./order-to-cash.md) for detailed sales order workflows.

### 6. Invoices

Invoices request payment from clients for delivered goods or services.

**Navigation:** Client to Cash → Invoices

**Page:** `/transactions/sales/invoices`

**Features:**
- Create invoices from sales orders
- Send invoices to clients via email
- Void invoices with reason tracking
- Track invoice status (Draft, Sent, Paid, Voided, Overdue)
- Partial payment support
- Aging report integration

**Invoice States:**

| Status | Description |
|--------|-------------|
| `DRAFT` | Invoice created, not yet sent |
| `SENT` | Invoice sent to client |
| `PARTIAL` | Partial payment received |
| `PAID` | Fully paid |
| `OVERDUE` | Past due date, unpaid |
| `VOIDED` | Cancelled |

**TRPC Endpoints:**
- `invoices.list` - List invoices with filtering
- `invoices.get` - Get invoice details
- `invoices.create` - Create invoice
- `invoices.send` - Mark invoice as sent
- `invoices.void` - Void invoice with reason
- `invoices.aging` - Get aging summary
- `salesOrders.createInvoice` - Create invoice from sales order

### 7. Payments

Payments record cash collection from clients against invoices.

**Navigation:** Client to Cash → Payments

**Page:** `/payments`

**Features:**
- Record payments against invoices
- Support multiple payment methods (Check, ACH, Wire, Credit Card, Cash)
- Partial payment support
- Refund processing
- Payment statistics dashboard:
  - Total payments received
  - Net after refunds
  - Total refunded amount
- Filter by date range, payment method, client

**Payment Methods:**

| Method | Description |
|--------|-------------|
| `CHECK` | Paper check |
| `ACH` | Electronic bank transfer |
| `WIRE` | Wire transfer |
| `CREDIT_CARD` | Credit card payment |
| `CASH` | Cash payment |

**TRPC Endpoints:**
- `payments.list` - List payments with filtering
- `payments.create` - Record new payment
- `payments.refund` - Process refund
- `payments.statistics` - Get payment statistics

### 8. Statements

Statements provide clients with a summary of their account activity.

**Navigation:** Client to Cash → Statements

**Page:** `/statements`

**Features:**
- Generate statement of account per client
- Transaction history (invoices and payments)
- Running balance calculation
- Aging summary (Current, 1-30, 31-60, 61-90, 90+ days)
- Print-ready format for PDF/paper delivery
- Date range filtering

**Statement Components:**
- Client information header
- Transaction list with dates and amounts
- Running balance column
- Aging breakdown by period
- Total balance due

**TRPC Endpoints:**
- `customers.list` - Get clients for selection
- `invoices.list` - Get client invoices
- `invoices.aging` - Get aging summary
- `payments.list` - Get client payments

### 9. Bank Reconciliation

Bank reconciliation matches received payments to bank deposits.

**Navigation:** Client to Cash → Bank Reconciliation

**Page:** `/banking/reconciliation`

**Features:**
- Dashboard statistics:
  - Pending count and amount
  - Reconciled today count and amount
  - Exception count
- Three-tab interface:
  - **Pending**: Deposits awaiting reconciliation
  - **All Deposits**: Complete deposit history
  - **Exceptions**: Deposits requiring manual review
- Match deposits to recorded payments
- Handle exceptions with resolution workflow
- Filter by bank account, date range, status

**Deposit States:**

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting reconciliation |
| `MATCHED` | Matched to payments |
| `RECONCILED` | Fully reconciled |
| `EXCEPTION` | Requires manual review |

**Exception Types:**
- Amount mismatch
- Duplicate deposit
- Missing payment record
- Bank error

**TRPC Endpoints:**
- `bankDeposits.dashboardStats` - Get reconciliation statistics
- `bankDeposits.list` - List all deposits
- `bankDeposits.pendingReconciliation` - Get pending deposits
- `bankDeposits.listExceptions` - Get exception deposits
- `bankDeposits.reconcile` - Reconcile deposit
- `bankDeposits.resolveException` - Resolve exception

## Sidebar Navigation

The Client-to-Cash section appears in the main navigation sidebar:

```
Client to Cash (expandable)
├── Clients (/clients)
├── Projects (/projects)
├── Time Tracking (/projects/time)
├── Estimates (/transactions/sales/estimates)
├── Sales Orders (/transactions/sales/sales-orders)
├── Invoices (/transactions/sales/invoices)
├── Payments (/payments)
├── Statements (/statements)
└── Bank Reconciliation (/banking/reconciliation)
```

## Data Model

### Entity Relationships

```
Client (Customer)
    │
    ├──▶ Projects
    │       │
    │       └──▶ Time Entries
    │
    ├──▶ Estimates
    │       │
    │       └──▶ Sales Orders
    │               │
    │               └──▶ Invoices
    │                       │
    │                       └──▶ Payments
    │                               │
    │                               └──▶ Bank Deposits
    │
    └──▶ Statements (generated from Invoices + Payments)
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `customers` | Client master data |
| `projects` | Project tracking |
| `time_entries` | Time tracking records |
| `estimates` | Estimate headers |
| `estimate_lines` | Estimate line items |
| `sales_orders` | Sales order headers |
| `sales_order_lines` | Sales order line items |
| `invoices` | Invoice headers |
| `invoice_lines` | Invoice line items |
| `payments` | Payment records |
| `bank_deposits` | Bank deposit records |

## UI Components

All pages follow consistent patterns using ShadCN/UI components:

- **Tables**: DataTable with sorting, filtering, pagination
- **Forms**: Dialog-based forms with react-hook-form + zod validation
- **Cards**: Statistics cards with icons and values
- **Badges**: Status badges with color coding
- **Tabs**: Multi-view tab interfaces
- **Alerts**: Confirmation dialogs for destructive actions

## Test IDs

Each page includes `data-testid` attributes for E2E testing:

### Payments Page

| Element | Test ID |
|---------|---------|
| New Payment Button | `new-payment-btn` |
| Payment Row | `payment-row-{id}` |
| Status Badge | `status-{id}` |
| Refund Button | `refund-btn-{id}` |

### Time Tracking Page

| Element | Test ID |
|---------|---------|
| New Entry Button | `new-time-entry-btn` |
| Entry Row | `time-entry-row-{id}` |
| Submit Button | `submit-btn-{id}` |
| Approve Button | `approve-btn-{id}` |

### Statements Page

| Element | Test ID |
|---------|---------|
| Client Select | `client-select` |
| Date From | `date-from-input` |
| Date To | `date-to-input` |
| Generate Button | `generate-statement-btn` |
| Print Button | `print-statement-btn` |

### Bank Reconciliation Page

| Element | Test ID |
|---------|---------|
| Pending Tab | `tab-pending` |
| All Tab | `tab-all` |
| Exceptions Tab | `tab-exceptions` |
| Reconcile Button | `reconcile-btn-{id}` |
| Resolve Button | `resolve-btn-{id}` |

## Best Practices

1. **Client-First Design**: Always start from the client perspective when navigating the workflow
2. **Approval Workflows**: Use approval thresholds for time entries and invoices above certain amounts
3. **Partial Payments**: Support multiple partial payments per invoice for flexible collection
4. **Regular Statements**: Generate statements monthly for active clients with outstanding balances
5. **Daily Reconciliation**: Reconcile bank deposits daily to maintain accurate cash position
6. **Exception Handling**: Address reconciliation exceptions promptly to avoid aging issues

## Related Documentation

- [Order-to-Cash](./order-to-cash.md) - Detailed sales order workflows
- [Cash Application](./cash-application.md) - Payment matching strategies
- [Procure-to-Pay](./procure-to-pay.md) - Vendor payment workflows
- [Time Tracking Design](./design/features/jobs-and-time-tracking.md) - Time tracking architecture
