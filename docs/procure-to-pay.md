# Procure-to-Pay (P2P) Lifecycle

This document describes the Procure-to-Pay module implemented as part of the P2P lifecycle (glapi-1y4).

## Overview

The Procure-to-Pay module provides comprehensive vendor transaction processing capabilities including:

- **Purchase Orders**: Create, approve, and track purchase orders
- **Goods Receipts**: Track receipt of goods/services against POs
- **Vendor Bills**: Process vendor invoices with 3-way match validation
- **Bill Payments**: Pay vendor bills with discount handling
- **Vendor Credit Memos**: Handle vendor credits and adjustments

## Architecture

### Database Schema

The module introduces tables in two schema files:

- `packages/database/src/db/schema/purchase-orders.ts`
- `packages/database/src/db/schema/vendor-bills.ts`

#### purchase_orders

Primary table for capturing purchase orders to vendors.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| poNumber | VARCHAR(50) | Auto-generated (PO-YYYY-NNNNNN) |
| vendorId | UUID | Reference to vendor entity |
| orderDate | DATE | Date of purchase order |
| expectedDeliveryDate | DATE | Expected delivery date |
| status | ENUM | DRAFT, SUBMITTED, APPROVED, etc. |
| subtotal | DECIMAL(15,2) | Sum of line amounts |
| taxAmount | DECIMAL(15,2) | Total tax |
| shippingAmount | DECIMAL(15,2) | Shipping charges |
| totalAmount | DECIMAL(15,2) | Total order amount |
| receivedAmount | DECIMAL(15,2) | Amount received to date |
| billedAmount | DECIMAL(15,2) | Amount billed to date |
| currentApproverId | UUID | Current approver for workflow |
| approvedAt | TIMESTAMP | When approved |
| approvedBy | UUID | Who approved |

#### purchase_order_lines

Line items for purchase orders.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| purchaseOrderId | UUID | Reference to PO |
| lineNumber | INTEGER | Line sequence |
| itemId | UUID | Optional item reference |
| itemName | VARCHAR(255) | Item description |
| quantity | DECIMAL(15,4) | Order quantity |
| unitPrice | DECIMAL(15,4) | Unit price |
| amount | DECIMAL(15,2) | Line total |
| quantityReceived | DECIMAL(15,4) | Quantity received |
| quantityBilled | DECIMAL(15,4) | Quantity billed |
| accountId | UUID | GL account |
| departmentId | UUID | Department dimension |
| locationId | UUID | Location dimension |
| classId | UUID | Class dimension |
| projectId | UUID | Project dimension |

#### purchase_order_receipts

Tracks goods/services received against purchase orders.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| receiptNumber | VARCHAR(50) | Auto-generated (REC-YYYY-NNNNNN) |
| purchaseOrderId | UUID | Reference to PO |
| vendorId | UUID | Vendor reference |
| receiptDate | DATE | Date received |
| status | ENUM | DRAFT, POSTED, CANCELLED |
| locationId | UUID | Receiving location |
| totalReceivedValue | DECIMAL(15,2) | Total value received |
| shippingRef | VARCHAR(100) | Tracking/packing slip |
| carrierName | VARCHAR(100) | Shipping carrier |

#### purchase_order_receipt_lines

Line items for receipts with quality inspection support.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| receiptId | UUID | Reference to receipt |
| purchaseOrderLineId | UUID | Reference to PO line (3-way match) |
| quantityReceived | DECIMAL(15,4) | Quantity received |
| quantityAccepted | DECIMAL(15,4) | Accepted after inspection |
| quantityRejected | DECIMAL(15,4) | Rejected quantity |
| rejectionReason | TEXT | Reason for rejection |
| binLocation | VARCHAR(100) | Storage location |
| lotNumber | VARCHAR(100) | Lot tracking |
| serialNumbers | TEXT | JSON array of serials |

#### vendor_bills

Vendor invoices/bills for accounts payable.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| billNumber | VARCHAR(50) | Auto-generated (BILL-YYYY-NNNNNN) |
| vendorInvoiceNumber | VARCHAR(100) | Vendor's invoice number |
| vendorId | UUID | Reference to vendor |
| purchaseOrderId | UUID | Optional PO reference |
| billDate | DATE | Invoice date |
| dueDate | DATE | Payment due date |
| status | ENUM | DRAFT, PENDING_APPROVAL, APPROVED, etc. |
| threeWayMatchStatus | ENUM | NOT_REQUIRED, PENDING, MATCHED, EXCEPTION, OVERRIDE |
| matchVarianceAmount | DECIMAL(15,2) | Total variance amount |
| subtotal | DECIMAL(15,2) | Sum of line amounts |
| taxAmount | DECIMAL(15,2) | Total tax |
| totalAmount | DECIMAL(15,2) | Total bill amount |
| paidAmount | DECIMAL(15,2) | Amount paid |
| balanceDue | DECIMAL(15,2) | Remaining balance |
| discountDate | DATE | Early pay discount date |
| discountPercent | DECIMAL(5,2) | Discount percentage |

#### vendor_bill_lines

Line items for vendor bills with 3-way match details.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| vendorBillId | UUID | Reference to bill |
| purchaseOrderLineId | UUID | PO line reference (3-way match) |
| receiptLineId | UUID | Receipt line reference (3-way match) |
| quantity | DECIMAL(15,4) | Billed quantity |
| unitPrice | DECIMAL(15,4) | Billed unit price |
| amount | DECIMAL(15,2) | Line total |
| poQuantity | DECIMAL(15,4) | Original PO quantity |
| poUnitPrice | DECIMAL(15,4) | Original PO price |
| receivedQuantity | DECIMAL(15,4) | Quantity received |
| quantityVariance | DECIMAL(15,4) | Qty difference |
| priceVariance | DECIMAL(15,2) | Price difference |
| matchStatus | ENUM | Line-level match status |

#### bill_payments

Payments made to vendors.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| paymentNumber | VARCHAR(50) | Auto-generated (BP-YYYY-NNNNNN) |
| vendorId | UUID | Reference to vendor |
| paymentDate | DATE | Payment date |
| paymentMethod | ENUM | CHECK, ACH, WIRE, CREDIT_CARD, etc. |
| paymentAmount | DECIMAL(15,2) | Total payment |
| appliedAmount | DECIMAL(15,2) | Amount applied to bills |
| unappliedAmount | DECIMAL(15,2) | Remaining balance |
| discountTaken | DECIMAL(15,2) | Early pay discount taken |
| bankAccountId | UUID | Bank account used |
| checkNumber | VARCHAR(50) | Check number if applicable |
| status | ENUM | DRAFT, PENDING, PROCESSING, COMPLETED, etc. |

#### bill_payment_applications

Junction table linking payments to bills.

| Field | Type | Description |
|-------|------|-------------|
| billPaymentId | UUID | Reference to payment |
| vendorBillId | UUID | Reference to bill |
| appliedAmount | DECIMAL(15,2) | Amount applied |
| discountAmount | DECIMAL(15,2) | Discount taken |
| writeOffAmount | DECIMAL(15,2) | Write-off amount |
| reversedAt | TIMESTAMP | If reversed |

#### vendor_credit_memos

Credits from vendors for returns, adjustments, or rebates.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| creditMemoNumber | VARCHAR(50) | Auto-generated (VCM-YYYY-NNNNNN) |
| vendorId | UUID | Vendor reference |
| sourceType | VARCHAR(50) | RETURN, PRICE_ADJUSTMENT, REBATE, OTHER |
| originalBillId | UUID | Related bill if applicable |
| originalAmount | DECIMAL(15,2) | Credit amount |
| appliedAmount | DECIMAL(15,2) | Amount used |
| remainingAmount | DECIMAL(15,2) | Available balance |
| status | VARCHAR(50) | OPEN, PARTIALLY_APPLIED, APPLIED, VOIDED |

### Enums

**PurchaseOrderStatus**: DRAFT, SUBMITTED, APPROVED, REJECTED, PARTIALLY_RECEIVED, RECEIVED, BILLED, CLOSED, CANCELLED

**ReceiptStatus**: DRAFT, POSTED, CANCELLED

**VendorBillStatus**: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PARTIALLY_PAID, PAID, VOIDED

**BillPaymentStatus**: DRAFT, PENDING, PROCESSING, COMPLETED, FAILED, VOIDED

**VendorPaymentMethod**: CHECK, ACH, WIRE, CREDIT_CARD, VIRTUAL_CARD, CASH, OTHER

**ThreeWayMatchStatus**: NOT_REQUIRED, PENDING, MATCHED, EXCEPTION, OVERRIDE

**POApprovalActionType**: SUBMITTED, APPROVED, REJECTED, RETURNED, ESCALATED, CANCELLED

**BillApprovalActionType**: SUBMITTED, APPROVED, REJECTED, RETURNED, ESCALATED, VOIDED

## Services

### PurchaseOrderService

Located at `packages/api-service/src/services/purchase-order-service.ts`

#### Key Methods

```typescript
// Create a new purchase order
async create(input: CreatePurchaseOrderInput): Promise<PurchaseOrderWithDetails>

// Update a draft purchase order
async update(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithDetails>

// Submit PO for approval
async submitForApproval(input: SubmitPurchaseOrderInput): Promise<PurchaseOrderWithDetails>

// Approve or reject a PO
async processApproval(input: ApprovePurchaseOrderInput): Promise<PurchaseOrderWithDetails>

// Create goods receipt
async createReceipt(input: CreateReceiptInput): Promise<ReceiptWithDetails>

// Post receipt (update PO quantities)
async postReceipt(input: PostReceiptInput): Promise<ReceiptWithDetails>

// Cancel a PO
async cancel(id: string, reason: string): Promise<PurchaseOrderWithDetails>

// Close a PO
async close(id: string): Promise<PurchaseOrderWithDetails>

// Get PO with full details
async getById(id: string): Promise<PurchaseOrderWithDetails>

// List POs with filters
async list(pagination: PaginationParams, filters?: PurchaseOrderFilters): Promise<PaginatedResult<PurchaseOrderWithDetails>>

// Get PO status summary
async getStatusSummary(subsidiaryId?: string): Promise<POStatusSummary>
```

### VendorBillService

Located at `packages/api-service/src/services/vendor-bill-service.ts`

#### Key Methods

```typescript
// Create a vendor bill
async create(input: CreateVendorBillInput): Promise<VendorBillWithDetails>

// Create bill from PO (auto-populate from PO/receipts)
async createFromPO(input: CreateBillFromPOInput): Promise<VendorBillWithDetails>

// Submit bill for approval
async submitForApproval(input: SubmitVendorBillInput): Promise<VendorBillWithDetails>

// Approve or reject a bill
async processApproval(input: ApproveVendorBillInput): Promise<VendorBillWithDetails>

// Perform 3-way match validation
async performThreeWayMatch(vendorBillId: string): Promise<ThreeWayMatchResult>

// Override match exception (manual approval)
async overrideMatchException(input: OverrideMatchExceptionInput): Promise<VendorBillWithDetails>

// Void a vendor bill
async void(id: string, reason: string): Promise<VendorBillWithDetails>

// Get bill with full details
async getById(id: string): Promise<VendorBillWithDetails>

// List bills with filters
async list(pagination: PaginationParams, filters?: VendorBillFilters): Promise<PaginatedResult<VendorBillWithDetails>>

// Get AP aging summary
async getAPAgingSummary(subsidiaryId?: string): Promise<APAgingSummary>

// Get vendor account summary
async getVendorSummary(vendorId: string): Promise<VendorAccountSummary>
```

### BillPaymentService

Located at `packages/api-service/src/services/bill-payment-service.ts`

#### Key Methods

```typescript
// Create a bill payment with applications
async create(input: CreateBillPaymentInput): Promise<BillPaymentWithDetails>

// Process/complete a payment
async process(paymentId: string): Promise<BillPaymentWithDetails>

// Void a payment (reverses applications)
async void(input: VoidBillPaymentInput): Promise<BillPaymentWithDetails>

// Create vendor credit memo
async createVendorCreditMemo(input: CreateVendorCreditMemoInput): Promise<VendorCreditMemoWithDetails>

// Apply credit to a bill
async applyVendorCredit(input: ApplyVendorCreditInput): Promise<VendorCreditMemoWithDetails>

// Get payment with details
async getById(id: string): Promise<BillPaymentWithDetails>

// List payments with filters
async list(pagination: PaginationParams, filters?: BillPaymentFilters): Promise<PaginatedResult<BillPaymentWithDetails>>

// Get payment summary for period
async getPaymentSummary(startDate: string, endDate: string, subsidiaryId?: string): Promise<BillPaymentSummary>
```

## Workflow

### 1. Creating Purchase Orders

```typescript
const poService = new PurchaseOrderService({ organizationId, userId });

// Create PO with lines
const po = await poService.create({
  subsidiaryId: 'sub-123',
  vendorId: 'vendor-456',
  orderDate: '2025-01-15',
  expectedDeliveryDate: '2025-01-30',
  paymentTerms: 'Net 30',
  lines: [
    {
      itemName: 'Widget A',
      quantity: 100,
      unitPrice: 25.00,
      accountId: 'inventory-acct',
      departmentId: 'dept-001',
    },
    {
      itemName: 'Widget B',
      quantity: 50,
      unitPrice: 45.00,
      accountId: 'inventory-acct',
    },
  ],
});

// Submit for approval
await poService.submitForApproval({
  purchaseOrderId: po.id,
  comments: 'Rush order for Q1 inventory',
});

// Approver processes
await poService.processApproval({
  purchaseOrderId: po.id,
  action: 'APPROVE',
  comments: 'Approved within budget',
});
```

### 2. Receiving Goods

```typescript
// Create receipt against PO
const receipt = await poService.createReceipt({
  subsidiaryId: 'sub-123',
  purchaseOrderId: po.id,
  receiptDate: '2025-01-28',
  locationId: 'warehouse-001',
  shippingRef: 'TRACK123456',
  carrierName: 'FedEx',
  lines: [
    {
      purchaseOrderLineId: po.lines[0].id,
      quantityReceived: 100,
      quantityAccepted: 98,
      quantityRejected: 2,
      rejectionReason: 'Damaged in shipping',
      binLocation: 'A-1-2',
    },
    {
      purchaseOrderLineId: po.lines[1].id,
      quantityReceived: 50,
      quantityAccepted: 50,
    },
  ],
});

// Post receipt to update PO quantities
await poService.postReceipt({ receiptId: receipt.id });
```

### 3. Creating Vendor Bills with 3-Way Match

```typescript
const billService = new VendorBillService({ organizationId, userId });

// Create bill from PO (auto-links to PO and receipts)
const bill = await billService.createFromPO({
  purchaseOrderId: po.id,
  vendorInvoiceNumber: 'INV-2025-001',
  billDate: '2025-01-30',
  dueDate: '2025-03-01',
  discountDate: '2025-02-10',
  discountPercent: 2,
});

// Or create bill manually
const bill = await billService.create({
  subsidiaryId: 'sub-123',
  vendorId: 'vendor-456',
  purchaseOrderId: po.id, // Links for 3-way match
  vendorInvoiceNumber: 'INV-2025-001',
  billDate: '2025-01-30',
  dueDate: '2025-03-01',
  lines: [
    {
      purchaseOrderLineId: po.lines[0].id,
      itemName: 'Widget A',
      quantity: 98, // Matches received qty
      unitPrice: 25.00,
      accountId: 'inventory-acct',
    },
  ],
});

// 3-way match is automatically performed
// Check match result
const matchResult = await billService.performThreeWayMatch(bill.id);

if (matchResult.requiresOverride) {
  // Handle exceptions - either fix or override
  await billService.overrideMatchException({
    vendorBillId: bill.id,
    reason: 'Price variance within acceptable tolerance',
  });
}

// Submit for approval
await billService.submitForApproval({
  vendorBillId: bill.id,
  comments: 'Ready for payment',
});
```

### 4. Paying Vendor Bills

```typescript
const paymentService = new BillPaymentService({ organizationId, userId });

// Create payment with applications
const payment = await paymentService.create({
  subsidiaryId: 'sub-123',
  vendorId: 'vendor-456',
  paymentDate: '2025-02-08',
  paymentMethod: 'ACH',
  paymentAmount: 2401.00, // After 2% discount
  bankAccountId: 'checking-acct',
  applications: [
    {
      vendorBillId: bill.id,
      appliedAmount: 2401.00,
      discountAmount: 49.00, // 2% discount taken
    },
  ],
});

// Process the payment
await paymentService.process(payment.id);
```

### 5. Handling Vendor Credits

```typescript
// Create vendor credit memo
const credit = await paymentService.createVendorCreditMemo({
  subsidiaryId: 'sub-123',
  vendorId: 'vendor-456',
  creditDate: '2025-02-15',
  sourceType: 'RETURN',
  originalBillId: bill.id,
  originalAmount: 50.00,
  memo: 'Return of damaged widgets',
});

// Apply credit to a new bill
await paymentService.applyVendorCredit({
  creditMemoId: credit.id,
  vendorBillId: newBill.id,
  amount: 50.00,
});
```

## 3-Way Match Validation

The system performs automatic 3-way matching between:
1. **Purchase Order** - What was ordered
2. **Receipt** - What was received
3. **Vendor Bill** - What is being invoiced

### Match Criteria

- **Quantity Match**: Bill qty vs. PO qty vs. Received qty
- **Price Match**: Bill unit price vs. PO unit price
- **Tolerance Thresholds**: Configurable variance tolerances

### Match Status Flow

```
NOT_REQUIRED (direct bill, no PO)
    |
    v
PENDING (awaiting validation)
    |
    +---> MATCHED (all within tolerance)
    |
    +---> EXCEPTION (variance detected)
              |
              v
          OVERRIDE (manually approved)
```

### Match Result Structure

```typescript
interface ThreeWayMatchResult {
  vendorBillId: string;
  overallStatus: ThreeWayMatchStatusValue;
  totalVariance: string;
  lineResults: ThreeWayMatchLineResult[];
  canApprove: boolean;       // True if MATCHED or OVERRIDE
  requiresOverride: boolean; // True if EXCEPTION
}

interface ThreeWayMatchLineResult {
  vendorBillLineId: string;
  purchaseOrderLineId?: string;
  receiptLineId?: string;
  matchStatus: ThreeWayMatchStatusValue;
  poQuantity?: string;
  billedQuantity: string;
  quantityVariance?: string;
  poUnitPrice?: string;
  billedUnitPrice: string;
  priceVariance?: string;
  receivedQuantity?: string;
  receivedVariance?: string;
  totalVariance: string;
  exceptions: string[];
}
```

## Status Flows

### Purchase Order Status Flow

```
DRAFT
    |
    v
SUBMITTED -----> REJECTED -----> DRAFT (rework)
    |                |
    v                v
APPROVED         CANCELLED
    |
    +---> PARTIALLY_RECEIVED (some items received)
    |         |
    |         v
    +---> RECEIVED (all items received)
              |
              v
          BILLED (vendor bill created)
              |
              v
          CLOSED

Any status except CLOSED/CANCELLED ---> CANCELLED
```

### Vendor Bill Status Flow

```
DRAFT
    |
    v
PENDING_APPROVAL -----> REJECTED -----> DRAFT (rework)
    |                       |
    v                       v
APPROVED                 VOIDED
    |
    +---> PARTIALLY_PAID (partial payment)
    |         |
    |         v
    +---> PAID (fully paid)

Any status ---> VOIDED (with reversals if paid)
```

### Bill Payment Status Flow

```
DRAFT
    |
    v
PENDING (ready to process)
    |
    +---> PROCESSING (ACH pending, etc.)
    |         |
    |         v
    +---> COMPLETED (cleared)
    |
    +---> FAILED (payment rejected)

PENDING/PROCESSING/COMPLETED ---> VOIDED
```

## Event Emissions

The services emit events for audit and integration:

| Event Type | Category | Description |
|------------|----------|-------------|
| PurchaseOrderCreated | PROCUREMENT | New PO created |
| PurchaseOrderSubmitted | PROCUREMENT | PO submitted for approval |
| PurchaseOrderApproved | PROCUREMENT | PO approved |
| PurchaseOrderRejected | PROCUREMENT | PO rejected |
| PurchaseOrderCancelled | PROCUREMENT | PO cancelled |
| PurchaseOrderClosed | PROCUREMENT | PO closed |
| ReceiptCreated | PROCUREMENT | Goods receipt created |
| ReceiptPosted | PROCUREMENT | Receipt posted |
| VendorBillCreated | PROCUREMENT | Vendor bill created |
| VendorBillSubmitted | PROCUREMENT | Bill submitted for approval |
| VendorBillApproved | PROCUREMENT | Bill approved |
| VendorBillRejected | PROCUREMENT | Bill rejected |
| VendorBillVoided | PROCUREMENT | Bill voided |
| ThreeWayMatchCompleted | PROCUREMENT | 3-way match performed |
| MatchExceptionOverridden | PROCUREMENT | Match exception manually approved |
| BillPaymentCreated | PAYMENT | Payment created |
| BillPaymentProcessed | PAYMENT | Payment processed/completed |
| BillPaymentVoided | PAYMENT | Payment voided |
| VendorCreditMemoCreated | PAYMENT | Vendor credit created |
| VendorCreditApplied | PAYMENT | Credit applied to bill |

## Type Definitions

All TypeScript types are defined in `packages/api-service/src/types/procure-to-pay.types.ts`:

### Input Types
- CreatePurchaseOrderInput
- CreatePurchaseOrderLineInput
- UpdatePurchaseOrderInput
- SubmitPurchaseOrderInput
- ApprovePurchaseOrderInput
- CreateReceiptInput
- CreateReceiptLineInput
- PostReceiptInput
- CreateVendorBillInput
- CreateVendorBillLineInput
- CreateBillFromPOInput
- SubmitVendorBillInput
- ApproveVendorBillInput
- OverrideMatchExceptionInput
- CreateBillPaymentInput
- BillPaymentApplicationInput
- VoidBillPaymentInput
- CreateVendorCreditMemoInput
- ApplyVendorCreditInput

### Output Types
- PurchaseOrderWithDetails
- PurchaseOrderLineWithDetails
- PurchaseOrderApprovalEntry
- ReceiptWithDetails
- ReceiptLineWithDetails
- ReceiptSummary
- VendorBillWithDetails
- VendorBillLineWithDetails
- VendorBillApprovalEntry
- BillPaymentWithDetails
- BillPaymentApplicationWithDetails
- VendorCreditMemoWithDetails
- ThreeWayMatchResult
- ThreeWayMatchLineResult

### Summary Types
- VendorAccountSummary
- APAgingSummary
- POStatusSummary
- BillPaymentSummary

### Filter Types
- PurchaseOrderFilters
- ReceiptFilters
- VendorBillFilters
- BillPaymentFilters

## Integration Points

### With Order-to-Cash (O2C)

The P2P module mirrors the O2C module structure:
- PurchaseOrder ↔ SalesOrder
- Receipt ↔ Shipment
- VendorBill ↔ Invoice
- BillPayment ↔ CustomerPayment

### With GL Posting

Future: GL posting engine integration for:

**Vendor Bill Entry:**
- Debit: Expense/Inventory Account
- Credit: Accounts Payable

**Bill Payment:**
- Debit: Accounts Payable
- Credit: Cash/Bank Account

**Discount Taken:**
- Debit: Accounts Payable
- Credit: Purchase Discount Account
- Credit: Cash (net amount)

### With Reporting

- AP aging reports by vendor
- PO status and fulfillment reports
- 3-way match exception reports
- Cash disbursement summaries
- Vendor spend analysis
