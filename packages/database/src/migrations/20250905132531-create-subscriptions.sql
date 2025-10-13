-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM ('draft', 'active', 'suspended', 'cancelled', 'expired');

-- Create billing frequency enum
CREATE TYPE billing_frequency AS ENUM ('monthly', 'quarterly', 'semi_annual', 'annual', 'custom');

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  subscription_number VARCHAR(100) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE,
  contract_value DECIMAL(12,2),
  billing_frequency billing_frequency,
  auto_renew BOOLEAN DEFAULT false,
  renewal_term_months INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT subscription_number_unique UNIQUE (organization_id, subscription_number),
  CONSTRAINT subscription_dates_valid CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT contract_value_positive CHECK (contract_value IS NULL OR contract_value >= 0)
);

-- Create subscription_items table
CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,4) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT discount_percentage_valid CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT subscription_item_dates_valid CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create indexes for better query performance
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_entity_id ON subscriptions(entity_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_start_date ON subscriptions(start_date);
CREATE INDEX idx_subscriptions_number ON subscriptions(subscription_number);
CREATE INDEX idx_subscription_items_organization_id ON subscription_items(organization_id);
CREATE INDEX idx_subscription_items_subscription_id ON subscription_items(subscription_id);
CREATE INDEX idx_subscription_items_item_id ON subscription_items(item_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_items_updated_at BEFORE UPDATE ON subscription_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();