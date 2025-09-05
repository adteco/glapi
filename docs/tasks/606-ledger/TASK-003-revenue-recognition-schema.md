# TASK-003: Revenue Recognition Database Schema

## Description
Create comprehensive database schemas for ASC 606 revenue recognition including performance obligations, revenue schedules, and SSP management.

## Acceptance Criteria
- [ ] Performance obligations table created
- [ ] Revenue schedules table created with period tracking
- [ ] SSP evidence table for standalone selling price tracking
- [ ] Contract SSP allocations table for price allocation
- [ ] Revenue journal entries table for accounting integration
- [ ] All proper relationships and constraints established
- [ ] Repository classes with complex queries implemented
- [ ] Unit and integration tests for all entities
- [ ] Migration scripts tested

## Dependencies
- TASK-001: Subscription schema
- TASK-002: Invoice schema

## Estimated Effort
3 days

## Technical Implementation

### Database Schema
```sql
-- performance_obligations table
CREATE TABLE performance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  item_id UUID NOT NULL REFERENCES items(id),
  obligation_type obligation_type NOT NULL,
  allocated_amount DECIMAL(12,2) NOT NULL,
  satisfaction_method satisfaction_method NOT NULL,
  satisfaction_period_months INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  status po_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- revenue_schedules table
CREATE TABLE revenue_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  performance_obligation_id UUID NOT NULL REFERENCES performance_obligations(id),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  scheduled_amount DECIMAL(12,2) NOT NULL,
  recognized_amount DECIMAL(12,2) DEFAULT 0,
  recognition_date DATE,
  recognition_pattern recognition_pattern NOT NULL,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ssp_evidence table
CREATE TABLE ssp_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  item_id UUID NOT NULL REFERENCES items(id),
  evidence_type evidence_type NOT NULL,
  evidence_date DATE NOT NULL,
  ssp_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  evidence_source VARCHAR(255),
  confidence_level confidence_level NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- contract_ssp_allocations table
CREATE TABLE contract_ssp_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  performance_obligation_id UUID NOT NULL REFERENCES performance_obligations(id),
  ssp_amount DECIMAL(10,2) NOT NULL,
  allocated_amount DECIMAL(12,2) NOT NULL,
  allocation_percentage DECIMAL(7,4) NOT NULL,
  allocation_method allocation_method NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- revenue_journal_entries table
CREATE TABLE revenue_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  revenue_schedule_id UUID NOT NULL REFERENCES revenue_schedules(id),
  accounting_period_id UUID REFERENCES accounting_periods(id),
  entry_date DATE NOT NULL,
  deferred_revenue_amount DECIMAL(12,2),
  recognized_revenue_amount DECIMAL(12,2),
  journal_entry_reference VARCHAR(255),
  status journal_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Enums to Create
```sql
-- Revenue recognition enums
CREATE TYPE obligation_type AS ENUM (
  'product_license',
  'maintenance_support', 
  'professional_services',
  'hosting_services',
  'other'
);

CREATE TYPE satisfaction_method AS ENUM (
  'point_in_time',
  'over_time'
);

CREATE TYPE recognition_pattern AS ENUM (
  'straight_line',
  'proportional',
  'milestone_based',
  'usage_based'
);

CREATE TYPE evidence_type AS ENUM (
  'standalone_sale',
  'competitor_pricing',
  'cost_plus_margin',
  'market_assessment'
);

CREATE TYPE confidence_level AS ENUM (
  'high',
  'medium', 
  'low'
);

CREATE TYPE allocation_method AS ENUM (
  'ssp_proportional',
  'residual',
  'specified_percentage'
);
```

### Test Requirements

#### Unit Tests
1. **Performance Obligations Repository**
   - Test creation with subscription relationship
   - Test allocation amount calculations
   - Test status transitions
   - Test filtering by subscription/item

2. **Revenue Schedules Repository**
   - Test schedule generation for different patterns
   - Test recognition amount updates
   - Test period-based queries
   - Test cumulative recognition calculations

3. **SSP Evidence Repository**
   - Test evidence creation and updates
   - Test historical SSP lookups
   - Test confidence level filtering
   - Test currency handling

#### Integration Tests
1. **Complex Relationship Queries**
   - Test subscription to revenue schedule rollup
   - Test performance obligation to schedule generation
   - Test SSP allocation calculations
   - Test journal entry creation

2. **Revenue Recognition Workflow**
   - Test end-to-end schedule creation from subscription
   - Test monthly recognition processing
   - Test modification impact calculations

### Files to Create
- `packages/database/src/db/schema/performance-obligations.ts`
- `packages/database/src/db/schema/revenue-schedules.ts`
- `packages/database/src/db/schema/ssp-evidence.ts`
- `packages/database/src/db/schema/contract-ssp-allocations.ts`
- `packages/database/src/db/schema/revenue-journal-entries.ts`
- `packages/database/src/db/schema/revenue-enums.ts`
- `packages/database/src/repositories/performance-obligation-repository.ts`
- `packages/database/src/repositories/revenue-schedule-repository.ts`
- `packages/database/src/repositories/ssp-evidence-repository.ts`
- `packages/database/src/migrations/YYYY-MM-DD-create-revenue-recognition.sql`
- Unit test files for each repository

### Definition of Done
- [ ] All migration scripts run successfully
- [ ] Repository tests achieve >90% coverage
- [ ] Complex queries perform adequately (<100ms)
- [ ] Referential integrity maintained
- [ ] TypeScript types properly generated
- [ ] Sample data can be created and queried
- [ ] Documentation complete with examples