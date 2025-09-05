-- Create invoice status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void');

-- Create payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'partial_refund');

-- Create payment method enum
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'ach', 'wire', 'check', 'cash', 'other');

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT invoice_number_unique UNIQUE (organization_id, invoice_number),
  CONSTRAINT invoice_dates_valid CHECK (due_date IS NULL OR due_date >= invoice_date),
  CONSTRAINT billing_period_valid CHECK (
    (billing_period_start IS NULL AND billing_period_end IS NULL) OR
    (billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL AND billing_period_end >= billing_period_start)
  ),
  CONSTRAINT invoice_amounts_valid CHECK (
    subtotal >= 0 AND 
    tax_amount >= 0 AND 
    total_amount >= 0 AND
    total_amount = subtotal + tax_amount
  )
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_item_id UUID REFERENCES subscription_items(id),
  item_id UUID REFERENCES items(id),
  description TEXT,
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT amount_calculation CHECK (ABS(amount - (quantity * unit_price)) < 0.01)
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID REFERENCES invoices(id),
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method payment_method,
  transaction_reference VARCHAR(255),
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints (allow negative amounts for refunds)
  CONSTRAINT payment_amount_non_zero CHECK (amount != 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_subscription_item_id ON invoice_line_items(subscription_item_id);
CREATE INDEX idx_invoice_line_items_item_id ON invoice_line_items(item_id);

CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_method ON payments(payment_method);

-- Create triggers for updated_at
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate invoice balance
CREATE OR REPLACE FUNCTION get_invoice_balance(invoice_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  invoice_total DECIMAL(12,2);
  paid_amount DECIMAL(12,2);
BEGIN
  SELECT total_amount INTO invoice_total
  FROM invoices
  WHERE id = invoice_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM payments
  WHERE invoice_id = invoice_id
    AND status = 'completed';
  
  RETURN COALESCE(invoice_total, 0) - COALESCE(paid_amount, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total DECIMAL(12,2);
  paid_amount DECIMAL(12,2);
  invoice_due_date DATE;
  new_status invoice_status;
BEGIN
  -- Only process if payment is for an invoice
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get invoice details
  SELECT total_amount, due_date INTO invoice_total, invoice_due_date
  FROM invoices
  WHERE id = NEW.invoice_id;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0) INTO paid_amount
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'completed';
  
  -- Determine new status
  IF paid_amount >= invoice_total THEN
    new_status := 'paid';
  ELSIF paid_amount > 0 THEN
    new_status := 'partial';
  ELSIF invoice_due_date IS NOT NULL AND invoice_due_date < CURRENT_DATE THEN
    new_status := 'overdue';
  ELSE
    -- Don't change status
    RETURN NEW;
  END IF;
  
  -- Update invoice status
  UPDATE invoices
  SET status = new_status,
      updated_at = NOW()
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update invoice status when payment is created or updated
CREATE TRIGGER update_invoice_status_on_payment
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_invoice_payment_status();