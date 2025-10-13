# TASK-006: Invoice and Payment tRPC Routers

## Description
Implement tRPC routers for invoice and payment management, including invoice generation from subscriptions, payment processing, and integration with revenue recognition triggers.

## Acceptance Criteria
- [ ] Invoice tRPC router with CRUD operations
- [ ] Payment tRPC router with payment processing
- [ ] Invoice generation from subscription logic
- [ ] Payment application to invoices
- [ ] Revenue recognition trigger on payment
- [ ] Invoice status workflow (draft → sent → paid → void)
- [ ] Comprehensive validation and error handling
- [ ] Unit and integration tests
- [ ] Type safety end-to-end

## Dependencies
- TASK-002: Invoice database schema
- TASK-005: Subscription tRPC router

## Estimated Effort
2.5 days

## Technical Implementation

### Invoice tRPC Router
```typescript
// packages/trpc/src/routers/invoices.ts
import { z } from 'zod';
import { authenticatedProcedure, router } from '../trpc';
import { InvoiceService } from '@glapi/api-service';

const invoiceSchema = z.object({
  entityId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.date(),
  dueDate: z.date().optional(),
  billingPeriodStart: z.date().optional(),
  billingPeriodEnd: z.date().optional(),
  lineItems: z.array(z.object({
    subscriptionItemId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    amount: z.number().positive()
  })).min(1),
  metadata: z.record(z.any()).optional()
});

export const invoicesRouter = router({
  // List invoices with filtering
  list: authenticatedProcedure
    .input(z.object({
      entityId: z.string().uuid().optional(),
      subscriptionId: z.string().uuid().optional(),
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.listInvoices(input);
    }),

  // Get invoice with line items
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.getInvoiceById(input.id);
    }),

  // Create invoice manually
  create: authenticatedProcedure
    .input(invoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.createInvoice({
        ...input,
        organizationId: ctx.organizationId
      });
    }),

  // Generate invoice from subscription
  generateFromSubscription: authenticatedProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      billingPeriodStart: z.date(),
      billingPeriodEnd: z.date(),
      invoiceDate: z.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.generateFromSubscription(input);
    }),

  // Update invoice
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: invoiceSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.updateInvoice(input.id, input.data);
    }),

  // Send invoice
  send: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.sendInvoice(input.id);
    }),

  // Void invoice
  void: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.voidInvoice(input.id, input.reason);
    }),

  // Get invoice aging report
  aging: authenticatedProcedure
    .input(z.object({
      asOfDate: z.date().optional()
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new InvoiceService(ctx.serviceContext);
      return service.getAgingReport(input.asOfDate || new Date());
    })
});
```

### Payment tRPC Router
```typescript
// packages/trpc/src/routers/payments.ts
const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentDate: z.date(),
  amount: z.number().positive(),
  paymentMethod: z.string().optional(),
  transactionReference: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const paymentsRouter = router({
  // List payments
  list: authenticatedProcedure
    .input(z.object({
      invoiceId: z.string().uuid().optional(),
      entityId: z.string().uuid().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50)
    }).optional())
    .query(async ({ ctx, input = {} }) => {
      const service = new PaymentService(ctx.serviceContext);
      return service.listPayments(input);
    }),

  // Create payment
  create: authenticatedProcedure
    .input(paymentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext);
      const payment = await service.createPayment({
        ...input,
        organizationId: ctx.organizationId
      });
      
      // Trigger revenue recognition if payment completes invoice
      if (payment.status === 'completed') {
        await service.triggerRevenueRecognition(payment.invoiceId);
      }
      
      return payment;
    }),

  // Process refund
  refund: authenticatedProcedure
    .input(z.object({
      id: z.string().uuid(),
      amount: z.number().positive(),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext);
      return service.processRefund(input.id, input.amount, input.reason);
    }),

  // Get payment details
  get: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new PaymentService(ctx.serviceContext);
      return service.getPaymentById(input.id);
    })
});
```

### Service Classes
```typescript
// Invoice Service key methods
export class InvoiceService {
  async generateFromSubscription(params: GenerateInvoiceParams) {
    // 1. Get subscription with active items for period
    // 2. Calculate prorated amounts for billing period
    // 3. Create invoice header
    // 4. Create line items from subscription items
    // 5. Calculate totals and taxes
    // 6. Return complete invoice
  }

  async sendInvoice(invoiceId: string) {
    // 1. Validate invoice is in draft status
    // 2. Update status to sent
    // 3. Set sent date
    // 4. Trigger any notification systems
  }

  async voidInvoice(invoiceId: string, reason: string) {
    // 1. Validate invoice can be voided
    // 2. Check for payments (cannot void paid invoices)
    // 3. Update status and add reason
    // 4. Reverse any revenue recognition
  }
}

// Payment Service key methods  
export class PaymentService {
  async createPayment(data: CreatePaymentData) {
    // 1. Validate invoice exists and amount valid
    // 2. Check payment doesn't exceed invoice balance
    // 3. Create payment record
    // 4. Update invoice payment status
    // 5. Return payment with updated invoice
  }

  async triggerRevenueRecognition(invoiceId: string) {
    // 1. Check if invoice is fully paid
    // 2. Get related performance obligations
    // 3. Trigger revenue recognition for satisfied obligations
    // 4. Create journal entries
  }
}
```

### Test Requirements

#### Unit Tests - Routers
```typescript
describe('Invoices Router', () => {
  describe('generateFromSubscription', () => {
    it('should generate invoice for subscription billing period', async () => {
      // Test invoice generation logic
    });
    
    it('should prorate amounts for partial periods', async () => {
      // Test proration calculations
    });
    
    it('should fail for invalid subscription', async () => {
      // Test error handling
    });
  });

  describe('send', () => {
    it('should update invoice status to sent', async () => {
      // Test status workflow
    });
    
    it('should fail for non-draft invoices', async () => {
      // Test business rules
    });
  });
});

describe('Payments Router', () => {
  describe('create', () => {
    it('should create payment and update invoice', async () => {
      // Test payment creation
    });
    
    it('should trigger revenue recognition when invoice paid', async () => {
      // Test revenue integration
    });
    
    it('should validate payment amount', async () => {
      // Test amount validation
    });
  });
});
```

#### Integration Tests
```typescript
describe('Invoice-Payment Integration', () => {
  it('should handle complete invoice lifecycle', async () => {
    // 1. Generate invoice from subscription
    // 2. Send invoice
    // 3. Record payment
    // 4. Verify revenue recognition triggered
  });
});
```

### Files to Create
- `packages/trpc/src/routers/invoices.ts`
- `packages/trpc/src/routers/payments.ts`
- `packages/api-service/src/services/invoice-service.ts`
- `packages/api-service/src/services/payment-service.ts`
- `packages/api-service/src/types/invoice-types.ts`
- `packages/api-service/src/types/payment-types.ts`
- Test files for all routers and services

### Definition of Done
- [ ] All router procedures implemented with proper validation
- [ ] Invoice generation from subscriptions works correctly
- [ ] Payment processing updates invoice status
- [ ] Revenue recognition triggers on payment completion
- [ ] Error handling covers all edge cases
- [ ] Integration tests verify end-to-end workflows
- [ ] Performance acceptable for typical invoice volumes
- [ ] Code follows established patterns