# Order-to-Cash (O2C) Lifecycle

## Overview

The Order-to-Cash module provides end-to-end transaction lifecycle management for sales orders, from initial creation through invoicing and revenue recognition. It integrates with the GL Posting Engine for automatic journal entries and provides a comprehensive approval workflow.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Sales Order   │────▶│    Invoice      │────▶│   GL Posting    │
│   Service       │     │    Service      │     │    Engine       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  State Machine  │     │  Revenue Recog  │     │ Journal Entries │
│  & Approvals    │     │  Integration    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Sales Order State Machine

### Status Values

| Status | Description |
|--------|-------------|
| `DRAFT` | Initial state, order can be edited |
| `SUBMITTED` | Submitted for approval, pending review |
| `APPROVED` | Approved, ready for fulfillment |
| `REJECTED` | Rejected, requires revision |
| `PARTIALLY_FULFILLED` | Some items have been fulfilled |
| `FULFILLED` | All items fulfilled |
| `CLOSED` | Order completed and closed |
| `CANCELLED` | Order cancelled |
| `ON_HOLD` | Temporarily on hold |

### Valid State Transitions

```
DRAFT → SUBMITTED, CANCELLED
SUBMITTED → APPROVED, REJECTED, CANCELLED
REJECTED → DRAFT (for revision)
APPROVED → PARTIALLY_FULFILLED, FULFILLED, ON_HOLD, CANCELLED
PARTIALLY_FULFILLED → FULFILLED, ON_HOLD, CANCELLED
FULFILLED → CLOSED, ON_HOLD
ON_HOLD → APPROVED, PARTIALLY_FULFILLED, FULFILLED (returns to previous status)
CLOSED → (terminal state)
CANCELLED → (terminal state)
```

## API Reference

### SalesOrderService

#### Creating a Sales Order

```typescript
const order = await salesOrderService.createSalesOrder({
  subsidiaryId: 'sub-123',
  entityId: 'customer-456',
  orderDate: new Date(),
  requiresApproval: true,
  approvalThreshold: 10000, // Orders >= $10,000 require approval
  lines: [
    {
      itemId: 'item-789',
      description: 'Professional Services',
      quantity: 10,
      unitPrice: 150.00,
      revenueAccountId: 'acct-revenue',
    },
  ],
});
```

#### Submitting for Approval

```typescript
const submittedOrder = await salesOrderService.submitForApproval(orderId);
// Status changes: DRAFT → SUBMITTED
// Event emitted: SalesOrderSubmitted
```

#### Processing Approval Actions

```typescript
// Approve
await salesOrderService.processApprovalAction(orderId, {
  action: 'APPROVE',
  comments: 'Approved per Q1 budget allocation',
});

// Reject
await salesOrderService.processApprovalAction(orderId, {
  action: 'REJECT',
  reason: 'Pricing requires review',
  comments: 'Please verify discount structure',
});

// Return for Revision
await salesOrderService.processApprovalAction(orderId, {
  action: 'RETURN_FOR_REVISION',
  comments: 'Please update delivery date',
});
```

#### Creating Invoice from Order

```typescript
const result = await salesOrderService.createInvoiceFromOrder({
  salesOrderId: orderId,
  lineIds: ['line-1', 'line-2'], // Optional: specific lines
  quantities: { 'line-1': 5 }, // Optional: partial quantities
  invoiceDate: new Date(),
  dueDate: addDays(new Date(), 30),
  memo: 'Invoice for Phase 1 delivery',
});

// Returns:
// {
//   invoice: { id, invoiceNumber, totalAmount },
//   salesOrder: { id, orderNumber, status, invoicedAmount, remainingAmount },
//   linesInvoiced: 2,
// }
```

#### Hold and Release

```typescript
// Put on hold
await salesOrderService.putOnHold(orderId, 'Pending customer credit review');

// Release from hold (returns to previous status)
await salesOrderService.releaseFromHold(orderId);
```

#### Cancellation

```typescript
await salesOrderService.cancelSalesOrder(orderId, 'Customer requested cancellation');
```

## Database Schema

### Tables

1. **sales_orders** - Main order header
   - Organization and subsidiary context
   - Customer entity reference
   - Order dates and status
   - Financial totals (subtotal, discount, tax, shipping, total)
   - Fulfillment tracking (fulfilled, invoiced, remaining amounts)
   - Approval configuration and history

2. **sales_order_lines** - Order line items
   - Item reference and description
   - Quantity and pricing
   - Fulfillment tracking per line
   - Accounting dimension assignments
   - Revenue account mapping

3. **sales_order_approval_history** - Approval audit trail
   - Action type (SUBMIT, APPROVE, REJECT, RETURN_FOR_REVISION)
   - Status transitions
   - Actor and timestamp
   - Comments and reasons

4. **sales_order_invoices** - Link table for order-to-invoice relationship
   - Tracks which invoices were created from which orders
   - Invoiced amount per link

## Event Integration

The service emits events for all state changes:

| Event Type | Category | Trigger |
|------------|----------|---------|
| `SalesOrderSubmitted` | APPROVAL | Order submitted for approval |
| `SalesOrderApproved` | APPROVAL | Order approved |
| `SalesOrderRejected` | APPROVAL | Order rejected |
| `SalesOrderReturnedForRevision` | APPROVAL | Order returned for revision |
| `SalesOrderOnHold` | APPROVAL | Order put on hold |
| `SalesOrderReleasedFromHold` | APPROVAL | Order released from hold |
| `SalesOrderCancelled` | TRANSACTION | Order cancelled |
| `SalesOrderClosed` | TRANSACTION | Order closed |

## GL Integration

When invoices are created from sales orders, the GL Posting Engine automatically creates journal entries:

```
DR: Accounts Receivable (Entity A/R Account)
CR: Revenue (Line Revenue Account)
CR: Deferred Revenue (if applicable)
CR: Tax Payable (if tax amount > 0)
```

## Listing and Filtering

```typescript
const orders = await salesOrderService.listSalesOrders(
  { page: 1, limit: 20 },
  {
    status: ['APPROVED', 'PARTIALLY_FULFILLED'],
    entityId: 'customer-456',
    orderDateFrom: '2024-01-01',
    orderDateTo: '2024-12-31',
    minAmount: 1000,
    search: 'SO-2024',
    pendingApproval: true,
  }
);
```

## Best Practices

1. **Use approval thresholds** - Set appropriate thresholds to automate low-value orders
2. **Track approval history** - Use comments and reasons for audit trail
3. **Partial invoicing** - Invoice in phases for large orders or milestone-based contracts
4. **Hold management** - Use hold status for credit review, not for rejection
5. **Event subscriptions** - Subscribe to events for downstream integrations

## Related Modules

- [Invoice Service](./invoices.md) - Invoice creation and management
- [GL Posting Engine](./gl-posting-engine.md) - Journal entry automation
- [Revenue Recognition](./revenue-recognition.md) - ASC 606 compliance
- [Accounting Periods](./accounting-periods.md) - Period management and closing
