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

## Web UI

### Sales Orders Page

The sales orders UI is available at `/transactions/sales/sales-orders` and provides:

- **List View**: Table showing all orders with status badges, amounts, and action buttons
- **Create Dialog**: Modal form for creating new sales orders with line items
- **View Dialog**: Modal showing order details and line items
- **Workflow Actions**: Context-aware action buttons based on order status

### Status-Based Actions

| Status | Available Actions |
|--------|------------------|
| DRAFT | Submit for Approval, Cancel |
| SUBMITTED | Approve, Reject, Cancel |
| APPROVED | Create Invoice, Create Fulfillment, Cancel |
| PARTIALLY_FULFILLED | Create Invoice, Create Fulfillment, Cancel |
| REJECTED | (Edit and resubmit) |
| CANCELLED | (No actions) |
| CLOSED | (No actions) |

### UI Test IDs

The UI includes `data-testid` attributes for E2E testing:

| Element | Test ID Pattern |
|---------|----------------|
| New Order Button | `new-sales-order-btn` |
| Order Row | `sales-order-row-{orderNumber}` |
| Status Badge | `status-{orderNumber}` |
| View Button | `view-btn-{orderNumber}` |
| Submit Button | `submit-btn-{orderNumber}` |
| Approve Button | `approve-btn-{orderNumber}` |
| Reject Button | `reject-btn-{orderNumber}` |
| Invoice Button | `invoice-btn-{orderNumber}` |
| Fulfill Button | `fulfill-btn-{orderNumber}` |
| Cancel Button | `cancel-btn-{orderNumber}` |

### Form Test IDs

| Element | Test ID |
|---------|---------|
| Subsidiary Select | `subsidiary-select` |
| Customer Select | `customer-select` |
| Order Date | `order-date-input` |
| Delivery Date | `delivery-date-input` |
| Memo | `memo-input` |
| Line Item | `line-item-{index}` |
| Line Description | `line-description-{index}` |
| Line Quantity | `line-quantity-{index}` |
| Line Price | `line-price-{index}` |
| Add Line | `add-line-btn` |
| Create Order | `create-order-btn` |

## E2E Testing

### Running Tests

```bash
# Run all O2C tests
npx playwright test tests/transactions/order-to-cash.spec.ts

# Run with UI mode
npx playwright test tests/transactions/order-to-cash.spec.ts --ui

# Run specific test
npx playwright test -g "should display sales orders page"
```

### Test Coverage

The E2E tests cover:

1. **Page Load**: Verifies page renders with header, table, and create button
2. **Create Dialog**: Tests form fields, line items, and validation
3. **Workflow Actions**: Verifies correct buttons appear for each status
4. **View Dialog**: Tests order detail display
5. **Approve/Reject/Cancel**: Tests confirmation dialogs and reason inputs
6. **Responsive Design**: Tests mobile viewport adaptation

### Complete O2C Flow Test

The `order-to-cash.spec.ts` file includes a skipped complete workflow test that demonstrates the full happy path:

1. Create sales order (DRAFT)
2. Submit for approval (SUBMITTED)
3. Approve order (APPROVED)
4. Create invoice
5. Verify invoice created

Enable this test when a seeded test database is available.

## TRPC Router

### Available Endpoints

| Endpoint | Type | Description |
|----------|------|-------------|
| `salesOrders.list` | Query | List orders with filtering and pagination |
| `salesOrders.get` | Query | Get order by ID |
| `salesOrders.getByOrderNumber` | Query | Get order by order number |
| `salesOrders.create` | Mutation | Create new order |
| `salesOrders.update` | Mutation | Update draft/rejected order |
| `salesOrders.submit` | Mutation | Submit for approval |
| `salesOrders.approve` | Mutation | Approve order |
| `salesOrders.reject` | Mutation | Reject order with reason |
| `salesOrders.returnForRevision` | Mutation | Return for revision |
| `salesOrders.hold` | Mutation | Put order on hold |
| `salesOrders.release` | Mutation | Release from hold |
| `salesOrders.cancel` | Mutation | Cancel order with reason |
| `salesOrders.close` | Mutation | Close fulfilled order |
| `salesOrders.createInvoice` | Mutation | Create invoice from order |
| `salesOrders.summary` | Query | Get order statistics |
| `salesOrders.pendingApproval` | Query | Get orders pending approval |

## Related Modules

- [Invoice Service](./invoices.md) - Invoice creation and management
- [GL Posting Engine](./gl-posting-engine.md) - Journal entry automation
- [Revenue Recognition](./revenue-recognition.md) - ASC 606 compliance
- [Accounting Periods](./accounting-periods.md) - Period management and closing
