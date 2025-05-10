# Revenue Recognition Data Model and Architecture

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Customer/Client Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    customer_id VARCHAR(100) UNIQUE NOT NULL,
    billing_address JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product/Service Catalog
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_type ENUM('software_license', 'saas_subscription', 'professional_services', 'support') NOT NULL,
    default_ssp DECIMAL(12,2),
    ssp_source ENUM('internal_analysis', 'third_party_pricing', 'observable_evidence') DEFAULT 'internal_analysis',
    recognition_type ENUM('point_in_time', 'over_time', 'hybrid') NOT NULL,
    default_recognition_pattern_id UUID REFERENCES revenue_recognition_patterns(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contracts/Agreements
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    contract_date DATE NOT NULL,
    effective_date DATE NOT NULL,
    contract_value DECIMAL(12,2) NOT NULL,
    contract_status ENUM('draft', 'signed', 'active', 'completed', 'terminated') NOT NULL,
    ssp_allocation_method ENUM('observable_evidence', 'residual', 'proportional') DEFAULT 'proportional',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract Line Items
CREATE TABLE contract_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    line_item_number INT NOT NULL,
    description TEXT,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    list_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL,
    ssp DECIMAL(12,2),
    allocated_transaction_price DECIMAL(12,2),
    performance_obligation_id UUID REFERENCES performance_obligations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contract_id, line_item_number)
);
```

### Revenue Recognition Tables

```sql
-- Performance Obligations
CREATE TABLE performance_obligations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) NOT NULL,
    description TEXT NOT NULL,
    obligation_type ENUM('single_point', 'over_time', 'series') NOT NULL,
    allocated_price DECIMAL(12,2) NOT NULL,
    satisfaction_method ENUM('input_method', 'output_method', 'time_based') DEFAULT 'time_based',
    start_date DATE NOT NULL,
    end_date DATE,
    total_units DECIMAL(10,2),
    completed_units DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Recognition Patterns (templates)
CREATE TABLE revenue_recognition_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type ENUM('straight_line', 'proportional', 'milestone', 'custom') NOT NULL,
    pattern_config JSONB, -- Stores pattern-specific configuration
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Schedules
CREATE TABLE revenue_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_obligation_id UUID REFERENCES performance_obligations(id) NOT NULL,
    schedule_date DATE NOT NULL,
    scheduled_amount DECIMAL(12,2) NOT NULL,
    recognized_amount DECIMAL(12,2) DEFAULT 0,
    recognition_source ENUM('automatic', 'manual_adjustment', 'milestone_achievement'),
    recognition_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### SSP and Reporting Tables

```sql
-- SSP Evidence and Adjustments
CREATE TABLE ssp_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) NOT NULL,
    evidence_type ENUM('customer_pricing', 'comparable_sales', 'market_research', 'cost_plus') NOT NULL,
    evidence_date DATE NOT NULL,
    ssp_amount DECIMAL(12,2) NOT NULL,
    confidence_level ENUM('high', 'medium', 'low') NOT NULL,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract SSP Allocations (for waterfall reports)
CREATE TABLE contract_ssp_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) NOT NULL,
    line_item_id UUID REFERENCES contract_line_items(id) NOT NULL,
    allocated_amount DECIMAL(12,2) NOT NULL,
    allocation_method ENUM('proportional', 'residual', 'specific_evidence') NOT NULL,
    allocation_percentage DECIMAL(5,2),
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Revenue Recognition Journal Entries
CREATE TABLE revenue_journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL,
    contract_id UUID REFERENCES contracts(id) NOT NULL,
    performance_obligation_id UUID REFERENCES performance_obligations(id),
    debit_account VARCHAR(100) NOT NULL,
    credit_account VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    entry_type ENUM('revenue_recognition', 'contract_asset', 'deferred_revenue', 'refund_liability') NOT NULL,
    description TEXT,
    is_posted BOOLEAN DEFAULT false,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Architecture (Lambda Functions)

### Core Lambda Functions

1. **Contract Processing Lambda**
   - Create/update contracts
   - Allocate transaction price using SSP
   - Create performance obligations
   - Generate initial revenue schedules

2. **Revenue Recognition Lambda**
   - Process monthly revenue recognition
   - Update completed units/milestones
   - Create journal entries
   - Handle manual adjustments

3. **SSP Management Lambda**
   - Update SSP evidence
   - Recalculate SSP for products
   - Trigger contract reallocation when SSP changes

4. **Reporting Lambda**
   - Generate waterfall reports
   - Create revenue recognition schedules
   - Export data for external systems

### Lambda Function Structures

```typescript
// Contract Processing Lambda
export const processContract = async (event: APIGatewayEvent) => {
  const contract = JSON.parse(event.body);
  
  // 1. Validate contract data
  // 2. Allocate transaction price
  // 3. Create performance obligations
  // 4. Generate initial schedules
  
  return {
    statusCode: 200,
    body: JSON.stringify({ contractId: contract.id })
  };
};

// Revenue Recognition Lambda
export const recognizeRevenue = async (event: APIGatewayEvent) => {
  const { date, performanceObligationId } = JSON.parse(event.body);
  
  // 1. Get performance obligation
  // 2. Calculate recognition amount
  // 3. Create journal entries
  // 4. Update schedules
  
  return {
    statusCode: 200,
    body: JSON.stringify({ recognized: true })
  };
};
```

## Next.js Frontend Components

### Key Pages/Components

1. **Contract Management**
   - Contract creation and editing
   - Line item management
   - SSP allocation review
   - Performance obligation definition

2. **Revenue Dashboard**
   - Current month revenue summary
   - Upcoming revenue schedules
   - Waterfall visualization
   - Performance obligation status

3. **SSP Management**
   - Product SSP maintenance
   - Evidence tracking
   - SSP adjustment history

4. **Reporting Suite**
   - Waterfall reports
   - Revenue recognition schedules
   - Deferred revenue analysis
   - Custom report builder

### Sample Next.js Component

```tsx
// Contract Waterfall Component
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const ContractWaterfall = ({ contractId }: { contractId: string }) => {
  const [waterfall, setWaterfall] = useState([]);
  
  useEffect(() => {
    fetchWaterfallData();
  }, [contractId]);
  
  const fetchWaterfallData = async () => {
    const { data } = await supabase
      .from('contract_ssp_allocations')
      .select(`
        *,
        contract_line_items(id, description, total_price, ssp),
        products(product_name)
      `)
      .eq('contract_id', contractId)
      .order('allocation_date', { ascending: false });
    
    setWaterfall(data);
  };
  
  return (
    <div className="waterfall-container">
      <h2>SSP Allocation Waterfall</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>List Price</th>
            <th>SSP</th>
            <th>Allocated Amount</th>
            <th>Allocation %</th>
          </tr>
        </thead>
        <tbody>
          {waterfall.map(item => (
            <tr key={item.id}>
              <td>{item.products.product_name}</td>
              <td>{item.contract_line_items.total_price}</td>
              <td>{item.contract_line_items.ssp}</td>
              <td>{item.allocated_amount}</td>
              <td>{item.allocation_percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Key Reports and Views

### 1. Revenue Recognition Waterfall
```sql
CREATE VIEW revenue_waterfall AS
SELECT 
    c.contract_number,
    c.customer_id,
    cust.company_name,
    cli.description as line_item,
    p.product_name,
    cli.total_price as contract_price,
    cli.ssp,
    csa.allocated_amount,
    csa.allocation_percentage,
    po.description as performance_obligation,
    po.allocated_price as obligation_amount
FROM contracts c
JOIN customers cust ON c.customer_id = cust.id
JOIN contract_line_items cli ON c.id = cli.contract_id
JOIN products p ON cli.product_id = p.id
JOIN contract_ssp_allocations csa ON cli.id = csa.line_item_id
JOIN performance_obligations po ON cli.performance_obligation_id = po.id
ORDER BY c.contract_date DESC, cli.line_item_number;
```

### 2. Monthly Revenue Recognition Schedule
```sql
CREATE VIEW monthly_revenue_schedule AS
SELECT 
    DATE_TRUNC('month', rs.schedule_date) as month,
    c.customer_id,
    cust.company_name,
    p.product_name,
    po.description as performance_obligation,
    SUM(rs.scheduled_amount) as scheduled_revenue,
    SUM(rs.recognized_amount) as recognized_revenue,
    SUM(rs.scheduled_amount - rs.recognized_amount) as remaining_revenue
FROM revenue_schedules rs
JOIN performance_obligations po ON rs.performance_obligation_id = po.id
JOIN contracts c ON po.contract_id = c.id
JOIN customers cust ON c.customer_id = cust.id
JOIN contract_line_items cli ON c.id = cli.contract_id AND cli.performance_obligation_id = po.id
JOIN products p ON cli.product_id = p.id
GROUP BY month, c.customer_id, cust.company_name, p.product_name, po.description
ORDER BY month, cust.company_name;
```

## Implementation Flow

1. **Contract Creation**
   - User creates contract in Next.js interface
   - Lambda validates and processes contract
   - SSP allocation is automatically calculated
   - Performance obligations are created
   - Initial revenue schedules are generated

2. **Monthly Revenue Recognition**
   - Scheduled Lambda runs monthly recognition process
   - Updates completed units/progress
   - Creates journal entries
   - Updates deferred revenue balances

3. **SSP Adjustments**
   - User updates SSP evidence
   - Lambda recalculates affected contracts
   - New allocations are created
   - Impact reports are generated

4. **Reporting**
   - Users access pre-built reports in Next.js
   - Custom reports can be generated
   - Data can be exported for external systems
   - Real-time dashboard updates

This architecture provides flexibility for both point-in-time and over-time revenue recognition while maintaining audit trails and supporting complex SSP calculations and waterfall reports.