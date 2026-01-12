# Cash Application & Customer Payments

This document describes the Cash Application module implemented as part of the Order-to-Cash lifecycle (glapi-t0b).

## Overview

The Cash Application module provides comprehensive customer payment processing capabilities including:

- **Payment Capture**: Receive and record customer payments
- **Cash Application**: Apply payments to invoices (manual or auto-apply)
- **Bank Deposit Batching**: Group payments into deposits
- **Reconciliation**: Match deposits to bank statements
- **Credit Memo Management**: Handle overpayments and adjustments

## Architecture

### Database Schema

The module introduces five new tables in `packages/database/src/db/schema/customer-payments.ts`:

#### customer_payments
Primary table for capturing incoming customer payments.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| paymentNumber | VARCHAR(50) | Auto-generated (PMT-YYYY-NNNNNN) |
| entityId | UUID | Reference to customer entity |
| paymentDate | DATE | Date payment received |
| paymentMethod | ENUM | CHECK, ACH, WIRE, CREDIT_CARD, etc. |
| paymentAmount | DECIMAL(15,2) | Total payment amount |
| appliedAmount | DECIMAL(15,2) | Amount applied to invoices |
| unappliedAmount | DECIMAL(15,2) | Remaining balance |
| status | ENUM | RECEIVED, PARTIALLY_APPLIED, FULLY_APPLIED, etc. |
| bankDepositId | UUID | Link to bank deposit batch |

#### customer_payment_applications
Junction table linking payments to invoices with application details.

| Field | Type | Description |
|-------|------|-------------|
| customerPaymentId | UUID | Reference to payment |
| invoiceId | UUID | Reference to invoice |
| appliedAmount | DECIMAL(15,2) | Amount applied |
| discountAmount | DECIMAL(15,2) | Early payment discount |
| writeOffAmount | DECIMAL(15,2) | Small balance write-off |
| reversedAt | TIMESTAMP | If application was reversed |

#### bank_deposits
Batch deposits for grouped payments.

| Field | Type | Description |
|-------|------|-------------|
| depositNumber | VARCHAR(50) | Auto-generated (DEP-YYYY-NNNNNN) |
| depositDate | DATE | Date of deposit |
| bankAccountId | UUID | Target bank account |
| totalAmount | DECIMAL(15,2) | Sum of all payments |
| paymentCount | INTEGER | Number of payments |
| status | ENUM | OPEN, SUBMITTED, DEPOSITED, RECONCILED, CANCELLED |
| reconciliationStatus | ENUM | PENDING, MATCHED, EXCEPTION, RESOLVED |

#### bank_reconciliation_exceptions
Track discrepancies between system and bank records.

| Field | Type | Description |
|-------|------|-------------|
| bankDepositId | UUID | Related deposit |
| exceptionType | VARCHAR | Type of exception (AMOUNT_VARIANCE, etc.) |
| bankStatementAmount | DECIMAL | Amount from bank |
| systemAmount | DECIMAL | Amount in system |
| varianceAmount | DECIMAL | Difference |
| status | ENUM | PENDING, MATCHED, EXCEPTION, RESOLVED |

#### customer_credit_memos
Customer credits from overpayments or adjustments.

| Field | Type | Description |
|-------|------|-------------|
| creditMemoNumber | VARCHAR(50) | Auto-generated (CM-YYYY-NNNNNN) |
| entityId | UUID | Customer reference |
| sourceType | VARCHAR | OVERPAYMENT, RETURN, ADJUSTMENT |
| originalAmount | DECIMAL(15,2) | Credit amount |
| appliedAmount | DECIMAL(15,2) | Amount used |
| remainingAmount | DECIMAL(15,2) | Available balance |

### Enums

- **CustomerPaymentStatus**: RECEIVED, PARTIALLY_APPLIED, FULLY_APPLIED, ON_ACCOUNT, DEPOSITED, RECONCILED, VOIDED
- **PaymentMethodType**: CHECK, ACH, WIRE, CREDIT_CARD, CASH, LOCKBOX, ONLINE, OTHER
- **BankDepositStatus**: OPEN, SUBMITTED, DEPOSITED, RECONCILED, CANCELLED
- **ReconciliationStatus**: PENDING, MATCHED, EXCEPTION, RESOLVED
- **ApplicationMethod**: OLDEST_FIRST, SPECIFIC, PROPORTIONAL, LARGEST_FIRST, MANUAL

## Services

### CustomerPaymentService

Located at `packages/api-service/src/services/customer-payment-service.ts`

#### Key Methods

```typescript
// Receive a new payment
async receivePayment(input: ReceiveCustomerPaymentInput): Promise<CustomerPaymentWithDetails>

// Apply payment to specific invoices
async applyPaymentToInvoices(paymentId: string, applications: PaymentApplicationInput[]): Promise<PaymentApplicationWithDetails[]>

// Auto-apply payment using specified method
async autoApplyPayment(paymentId: string, method: 'OLDEST_FIRST' | 'LARGEST_FIRST' | 'PROPORTIONAL'): Promise<AutoApplyResult>

// Reverse a payment application
async unapplyPayment(applicationId: string): Promise<void>

// Void a payment (reverses all applications first)
async voidPayment(paymentId: string, reason: string): Promise<CustomerPaymentWithDetails>

// Create credit memo from overpayment
async createCreditMemo(input: CreateCreditMemoInput): Promise<CreditMemoWithDetails>

// Apply credit memo to invoice
async applyCreditMemo(input: ApplyCreditMemoInput): Promise<CreditMemoWithDetails>

// Get customer A/R summary
async getCustomerAccountSummary(entityId: string): Promise<CustomerAccountSummary>
```

### BankDepositService

Located at `packages/api-service/src/services/bank-deposit-service.ts`

#### Key Methods

```typescript
// Create a new deposit batch
async createDeposit(input: CreateBankDepositInput): Promise<BankDepositWithDetails>

// Add payments to deposit
async addPaymentsToDeposit(input: AddPaymentsToDepositInput): Promise<BankDepositWithDetails>

// Remove payments from deposit
async removePaymentsFromDeposit(depositId: string, paymentIds: string[]): Promise<BankDepositWithDetails>

// Submit deposit for reconciliation
async submitDeposit(input: SubmitDepositInput): Promise<BankDepositWithDetails>

// Cancel a deposit
async cancelDeposit(depositId: string, reason: string): Promise<BankDepositWithDetails>

// Reconcile deposit against bank statement
async reconcileDeposit(input: ReconcileDepositInput): Promise<BankDepositWithDetails>

// Create reconciliation exception
async createReconciliationException(input: CreateReconciliationExceptionInput): Promise<ReconciliationExceptionWithDetails>

// Resolve exception
async resolveException(input: ResolveExceptionInput): Promise<ReconciliationExceptionWithDetails>

// Get unassigned payments available for deposit
async getUnassignedPayments(subsidiaryId: string): Promise<CustomerPaymentWithDetails[]>

// Get deposit batch summary
async getDepositBatchSummary(subsidiaryId?: string): Promise<DepositBatchSummary>
```

## Workflow

### 1. Receiving Payments

```typescript
const paymentService = new CustomerPaymentService({ organizationId, userId });

// Receive payment with auto-apply
const payment = await paymentService.receivePayment({
  subsidiaryId: 'sub-123',
  entityId: 'customer-456',
  paymentDate: '2025-01-15',
  paymentMethod: 'CHECK',
  paymentAmount: 5000.00,
  checkNumber: '12345',
  autoApply: true,
  applicationMethod: 'OLDEST_FIRST'
});

// Or receive with specific applications
const payment = await paymentService.receivePayment({
  subsidiaryId: 'sub-123',
  entityId: 'customer-456',
  paymentDate: '2025-01-15',
  paymentMethod: 'ACH',
  paymentAmount: 5000.00,
  applications: [
    { invoiceId: 'inv-001', appliedAmount: 3000.00 },
    { invoiceId: 'inv-002', appliedAmount: 2000.00 }
  ]
});
```

### 2. Auto-Apply Methods

- **OLDEST_FIRST**: Applies payment to oldest invoices first (by invoice date)
- **LARGEST_FIRST**: Applies payment to largest invoices first (by amount)
- **PROPORTIONAL**: Distributes payment proportionally across all open invoices

### 3. Bank Deposit Batching

```typescript
const depositService = new BankDepositService({ organizationId, userId });

// Create deposit batch
const deposit = await depositService.createDeposit({
  subsidiaryId: 'sub-123',
  depositDate: '2025-01-15',
  bankAccountId: 'bank-acct-001',
  paymentIds: ['pmt-001', 'pmt-002']
});

// Add more payments
await depositService.addPaymentsToDeposit({
  depositId: deposit.id,
  paymentIds: ['pmt-003']
});

// Submit for deposit
await depositService.submitDeposit({
  depositId: deposit.id,
  memo: 'Daily deposit batch'
});

// Reconcile against bank statement
await depositService.reconcileDeposit({
  depositId: deposit.id,
  bankStatementDate: '2025-01-16',
  bankStatementRef: 'DEP-001234',
  bankStatementAmount: 15000.00
});
```

### 4. Handling Exceptions

When the bank statement amount differs from the system amount, an exception is automatically created:

```typescript
// List exceptions
const exceptions = await depositService.listExceptions(
  { page: 1, limit: 20 },
  { depositId: deposit.id, status: 'EXCEPTION' }
);

// Resolve exception
await depositService.resolveException({
  exceptionId: 'exc-001',
  resolutionNotes: 'Bank fee of $5.00 applied'
});
```

## Status Flows

### Payment Status Flow

```
RECEIVED
    |
    +---> PARTIALLY_APPLIED (some amount applied)
    |         |
    |         v
    +---> FULLY_APPLIED (all amount applied)
    |
    +---> DEPOSITED (added to bank deposit)
              |
              v
          RECONCILED (matched to bank statement)

Any status except RECONCILED ---> VOIDED
```

### Bank Deposit Status Flow

```
OPEN (accepting payments)
    |
    v
SUBMITTED (ready for deposit)
    |
    v
DEPOSITED (at bank)
    |
    v
RECONCILED (matched to statement)

OPEN/SUBMITTED ---> CANCELLED
```

## Event Emissions

The services emit events for audit and integration:

| Event Type | Category | Description |
|------------|----------|-------------|
| CustomerPaymentReceived | PAYMENT | New payment recorded |
| PaymentApplied | PAYMENT | Payment applied to invoices |
| PaymentApplicationReversed | PAYMENT | Application reversed |
| CustomerPaymentVoided | PAYMENT | Payment voided |
| CreditMemoCreated | PAYMENT | Credit memo created |
| BankDepositCreated | PAYMENT | New deposit batch |
| PaymentsAddedToDeposit | PAYMENT | Payments added to batch |
| BankDepositSubmitted | PAYMENT | Deposit submitted |
| BankDepositReconciled | PAYMENT | Deposit reconciled |
| BankDepositCancelled | PAYMENT | Deposit cancelled |
| ReconciliationExceptionCreated | PAYMENT | Exception flagged |
| ReconciliationExceptionResolved | PAYMENT | Exception resolved |

## Type Definitions

All TypeScript types are defined in `packages/api-service/src/types/customer-payments.types.ts`:

### Input Types
- ReceiveCustomerPaymentInput
- PaymentApplicationInput
- CreateBankDepositInput
- AddPaymentsToDepositInput
- SubmitDepositInput
- ReconcileDepositInput
- CreateReconciliationExceptionInput
- ResolveExceptionInput
- CreateCreditMemoInput
- ApplyCreditMemoInput

### Output Types
- CustomerPaymentWithDetails
- PaymentApplicationWithDetails
- BankDepositWithDetails
- ReconciliationExceptionWithDetails
- CreditMemoWithDetails
- AutoApplyResult
- CustomerAccountSummary
- CashReceiptsSummary
- DepositBatchSummary

### Filter Types
- CustomerPaymentFilters
- BankDepositFilters

## Integration Points

### With Sales Orders
Payments can be linked to invoices generated from sales orders.

### With GL Posting
Future: GL posting engine integration for cash receipt journal entries:
- Debit: Cash/Bank Account
- Credit: Accounts Receivable

### With Reporting
- Cash receipts summaries by period
- Customer account summaries
- Aging reports for unapplied balances
