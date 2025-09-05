# TASK-002: Invoice and Payment Database Schema

## Description
Create invoice and payment database schemas, migrations, and repositories to track billing and cash collection events for revenue recognition.

## Acceptance Criteria
- [ ] Invoice table schema created with header information
- [ ] Invoice line items table schema created
- [ ] Payment table schema created for cash collection
- [ ] Database migration scripts created and tested
- [ ] Repository classes implemented with CRUD operations
- [ ] Proper relationships established with subscriptions
- [ ] Zod validation schemas created
- [ ] Unit tests for all repository operations
- [ ] Integration tests with database

## Dependencies
- TASK-001: Subscription schema must be completed

## Estimated Effort
2 days

## Technical Implementation

### Database Schema
```sql
-- invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_number VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL REFERENCES entities(id),
  subscription_id UUID REFERENCES subscriptions(id),
  sales_order_id UUID, -- Future reference
  invoice_date DATE NOT NULL,
  due_date DATE,
  billing_period_start DATE,
  billing_period_end DATE,
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- invoice_line_items table
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_item_id UUID REFERENCES subscription_items(id),
  item_id UUID REFERENCES items(id),
  description TEXT,
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID REFERENCES invoices(id),
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(255),
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Test Requirements

#### Unit Tests
1. **Invoice Repository Tests**
   - Test invoice creation with line items
   - Test invoice retrieval with relationships
   - Test invoice status updates
   - Test invoice list filtering by customer/period
   - Test invoice total calculations

2. **Payment Repository Tests**
   - Test payment creation and invoice linking
   - Test payment status updates
   - Test payment retrieval by invoice
   - Test payment amount validation

3. **Validation Tests**
   - Test invoice number uniqueness within organization
   - Test payment amount cannot exceed invoice total
   - Test billing period validation
   - Test required field validation

#### Integration Tests
1. **Cross-Entity Relationships**
   - Test invoice to subscription relationship
   - Test payment to invoice relationship
   - Test cascade delete behaviors
   - Test foreign key constraints

2. **Business Logic Tests**
   - Test invoice total calculation from line items
   - Test payment allocation to invoices
   - Test subscription billing cycle creation

### Files to Create
- `packages/database/src/db/schema/invoices.ts`
- `packages/database/src/db/schema/invoice-line-items.ts`
- `packages/database/src/db/schema/payments.ts`
- `packages/database/src/repositories/invoice-repository.ts`
- `packages/database/src/repositories/payment-repository.ts`
- `packages/database/src/migrations/YYYY-MM-DD-create-invoices-payments.sql`
- `packages/database/src/repositories/__tests__/invoice-repository.test.ts`
- `packages/database/src/repositories/__tests__/payment-repository.test.ts`

### Definition of Done
- [ ] All repository tests pass
- [ ] Migration runs successfully
- [ ] Complex queries tested (invoice with line items)
- [ ] Performance validated with sample data
- [ ] Code follows established patterns
- [ ] Type safety verified
- [ ] Documentation complete